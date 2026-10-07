"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { ensureFamilySchema, isTestAccountEmail } from "@/lib/family-flow";

async function testMatch(formData: FormData) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  const raw = String(formData.get("request_id") || "");
  if (!/^\d+$/.test(raw)) return null;
  const requestId = BigInt(raw);

  const match = await prisma.match_requests.findUnique({
    where: { id: requestId },
    select: {
      users_match_requests_sender_idTousers: { select: { email: true } },
      users_match_requests_receiver_idTousers: { select: { email: true } },
    },
  });
  if (!match) return null;
  const bothTest =
    isTestAccountEmail(match.users_match_requests_sender_idTousers?.email) &&
    isTestAccountEmail(match.users_match_requests_receiver_idTousers?.email);
  if (!bothTest) return null;

  await ensureFamilySchema();
  return { requestId, adminId: BigInt(session.adminId) };
}

async function logAction(adminId: bigint, action: string, requestId: bigint) {
  const max = await prisma.moderation_log.aggregate({ _max: { id: true } });
  await prisma.moderation_log.create({
    data: {
      id: (max._max.id ?? BigInt(0)) + BigInt(1),
      admin_id: adminId,
      action,
      note: `request #${requestId}`,
      created_at: new Date(),
    },
  });
}

/**
 * QA: make a test match eligible for the automatic "Ready to involve family?" reminder without
 * waiting six days or sending 55+ messages. The member app sends the push and shows the in-chat
 * card the next time either member opens the chat (or on the next scheduled run).
 */
export async function forceFamilyEligible(formData: FormData) {
  const ctx = await testMatch(formData);
  if (!ctx) return;
  await prisma.$executeRawUnsafe(
    `UPDATE match_requests SET family_force_eligible = TRUE WHERE id = $1 AND status = 'accepted'`,
    ctx.requestId
  );
  await logAction(ctx.adminId, "family_force_eligible", ctx.requestId);
  revalidatePath(`/chats/${ctx.requestId}`);
}

/** QA: put a test match back to the very start of the Involve Family flow, wali card included. */
export async function resetFamilyFlow(formData: FormData) {
  const ctx = await testMatch(formData);
  if (!ctx) return;
  await prisma.$executeRawUnsafe(
    `UPDATE match_requests
        SET family_request_state = NULL, family_requested_at = NULL, family_requested_via = NULL,
            family_declined_at = NULL, family_shared_via = NULL, family_contact_action_at = NULL,
            family_contact_not_yet_count = 0, family_contact_not_yet_at = NULL,
            family_auto_eligible_at = NULL, family_auto_cancelled_at = NULL,
            family_auto_dismiss_sender = 0, family_auto_dismissed_sender_at = NULL,
            family_auto_final_sender_at = NULL,
            family_auto_dismiss_receiver = 0, family_auto_dismissed_receiver_at = NULL,
            family_auto_final_receiver_at = NULL,
            family_force_eligible = FALSE,
            wali_handover_status = NULL, wali_details_requested_at = NULL,
            wali_details_shared_at = NULL, wali_contact_attempted_at = NULL,
            wali_contact_confirmed_at = NULL, wali_handover_note = NULL
      WHERE id = $1`,
    ctx.requestId
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM messages WHERE request_id = $1 AND message_type = 'contact_card'`,
    ctx.requestId
  );
  await logAction(ctx.adminId, "family_flow_reset", ctx.requestId);
  revalidatePath(`/chats/${ctx.requestId}`);
}
