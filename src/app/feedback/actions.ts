"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

/** Mark a feedback item resolved / reopen it, with an optional internal note. */
export async function setFeedbackStatus(formData: FormData) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  const id = BigInt(String(formData.get("id") || "0"));
  const status = String(formData.get("status")) === "resolved" ? "resolved" : "new";
  const note = String(formData.get("note") ?? "").slice(0, 2000);
  await prisma.$executeRawUnsafe(
    `UPDATE member_feedback SET status = $2, resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE NULL END,
            admin_note = COALESCE(NULLIF($3, ''), admin_note) WHERE id = $1`,
    id,
    status,
    note
  );
  revalidatePath("/feedback");
}
