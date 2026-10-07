import { prisma } from "@/lib/prisma";

/**
 * Involve Family (member app: web/src/lib/family-flow.ts). The admin panel edits the reminder
 * thresholds and notification copy, and offers QA tools for test matches. Both apps share the
 * database, so the settings row written here is what the member app reads.
 */

export type FamilySettings = {
  minDaysMatched: number;
  minTotalMessages: number;
  minMessagesEach: number;
  minActiveDaysEach: number;
  recentActivityHours: number;
  finalReminderAfterDays: number;
  requestCooldownDays: number;
  contactPromptAfterHours: number;
  contactFollowupAfterDays: number;
  pushTitle: string;
  pushBody: string;
  finalPushTitle: string;
  finalPushBody: string;
};

// Keep in sync with FAMILY_DEFAULTS in web/src/lib/family-flow.ts.
export const FAMILY_DEFAULTS: FamilySettings = {
  minDaysMatched: 6,
  minTotalMessages: 55,
  minMessagesEach: 18,
  minActiveDaysEach: 3,
  recentActivityHours: 48,
  finalReminderAfterDays: 7,
  requestCooldownDays: 7,
  contactPromptAfterHours: 24,
  contactFollowupAfterDays: 3,
  pushTitle: "Ready to involve family? ❤️",
  pushBody: "You've been getting to know {code} for a while. Take the next step when you're ready.",
  finalPushTitle: "Still getting to know {code}? ❤️",
  finalPushBody: "If things are progressing, you can involve family whenever you're ready.",
};

let ensured = false;

/** Same idempotent DDL as the member app, so the admin tools work whichever deploys first. */
export async function ensureFamilySchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    ALTER TABLE match_requests
      ADD COLUMN IF NOT EXISTS family_request_state VARCHAR(16),
      ADD COLUMN IF NOT EXISTS family_requested_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_requested_via VARCHAR(8),
      ADD COLUMN IF NOT EXISTS family_declined_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_shared_via VARCHAR(8),
      ADD COLUMN IF NOT EXISTS family_contact_action_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_contact_not_yet_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS family_contact_not_yet_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_auto_eligible_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_auto_cancelled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_auto_dismiss_sender INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS family_auto_dismissed_sender_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_auto_final_sender_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_auto_dismiss_receiver INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS family_auto_dismissed_receiver_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_auto_final_receiver_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS family_force_eligible BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS family_flow_settings (
      id INT PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  ensured = true;
}

export async function loadFamilySettings(): Promise<{ settings: FamilySettings; updatedAt: Date | null }> {
  await ensureFamilySchema();
  const rows = await prisma.$queryRawUnsafe<{ data: Record<string, unknown> | null; updated_at: Date }[]>(
    `SELECT data, updated_at FROM family_flow_settings WHERE id = 1`
  );
  const data = rows[0]?.data ?? {};
  const settings = { ...FAMILY_DEFAULTS };
  for (const key of Object.keys(FAMILY_DEFAULTS) as (keyof FamilySettings)[]) {
    const raw = data[key];
    if (typeof FAMILY_DEFAULTS[key] === "number") {
      const n = Number(raw);
      if (raw != null && raw !== "" && Number.isFinite(n) && n >= 0) (settings[key] as number) = n;
    } else if (typeof raw === "string" && raw.trim()) {
      (settings[key] as string) = raw.trim();
    }
  }
  return { settings, updatedAt: rows[0]?.updated_at ?? null };
}

/**
 * QA tools (force-eligible, reset) only act on test matches: both members must be test accounts.
 * A test account has an @example.com address or a mailbox starting with "test" / "qa"; set
 * FAMILY_QA_ALLOW_ALL=1 on the admin deployment to lift the restriction during a QA round.
 */
export function isTestAccountEmail(email: string | null | undefined) {
  if (process.env.FAMILY_QA_ALLOW_ALL === "1") return true;
  const e = (email || "").toLowerCase();
  return e.endsWith("@example.com") || /^(test|qa)[._+\-\d]/.test(e) || /\+(test|qa)/.test(e);
}

export type FamilyStatusRow = {
  family_request_state: string | null;
  family_requested_at: Date | null;
  family_declined_at: Date | null;
  wali_details_shared_at: Date | null;
  wali_contact_confirmed_at: Date | null;
  family_auto_eligible_at: Date | null;
  family_auto_cancelled_at: Date | null;
  family_force_eligible: boolean;
};

export async function loadFamilyStatus(requestId: bigint): Promise<FamilyStatusRow | null> {
  await ensureFamilySchema();
  const rows = await prisma.$queryRawUnsafe<FamilyStatusRow[]>(
    `SELECT family_request_state, family_requested_at, family_declined_at, wali_details_shared_at,
            wali_contact_confirmed_at, family_auto_eligible_at, family_auto_cancelled_at,
            family_force_eligible
       FROM match_requests WHERE id = $1`,
    requestId
  );
  return rows[0] ?? null;
}
