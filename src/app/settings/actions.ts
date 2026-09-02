"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

async function nextModerationId() {
  const max = await prisma.moderation_log.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function updatePlanSettings(formData: FormData) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  const adminId = BigInt(session.adminId);

  const plan = String(formData.get("plan") || "").toLowerCase();
  if (plan !== "free" && plan !== "gold") return;

  const num = (name: string) => Math.max(0, Math.floor(Number(formData.get(name)) || 0));
  const savedRaw = String(formData.get("saved_profile_limit") || "").trim();

  await prisma.plan_settings.update({
    where: { plan },
    data: {
      monthly_credits: num("monthly_credits"),
      rollover_cap: num("rollover_cap"),
      max_balance: num("max_balance"),
      pending_request_limit: num("pending_request_limit"),
      request_expiry_days: num("request_expiry_days"),
      saved_profile_limit: savedRaw === "" ? null : Math.max(0, Math.floor(Number(savedRaw))),
      updated_at: new Date(),
    },
  });

  await prisma.moderation_log.create({
    data: {
      id: await nextModerationId(),
      admin_id: adminId,
      action: "plan_settings_updated",
      note: plan,
      created_at: new Date(),
    },
  });

  revalidatePath("/settings");
}
