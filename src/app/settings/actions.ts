"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { FAMILY_DEFAULTS, ensureFamilySchema, type FamilySettings } from "@/lib/family-flow";

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

/** Involve Family: reminder thresholds and notification copy, read live by the member app. */
export async function updateFamilySettings(formData: FormData) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");

  const data: Record<string, number | string> = {};
  for (const key of Object.keys(FAMILY_DEFAULTS) as (keyof FamilySettings)[]) {
    const raw = String(formData.get(key) ?? "").trim();
    if (typeof FAMILY_DEFAULTS[key] === "number") {
      const n = Number(raw);
      data[key] = raw !== "" && Number.isFinite(n) && n >= 0 ? n : FAMILY_DEFAULTS[key];
    } else {
      data[key] = raw.slice(0, 300) || FAMILY_DEFAULTS[key];
    }
  }

  await ensureFamilySchema();
  await prisma.$executeRawUnsafe(
    `INSERT INTO family_flow_settings (id, data, updated_at) VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    JSON.stringify(data)
  );

  await prisma.moderation_log.create({
    data: {
      id: await nextModerationId(),
      admin_id: BigInt(session.adminId),
      action: "family_settings_updated",
      created_at: new Date(),
    },
  });

  revalidatePath("/settings");
}
