import { prisma } from "@/lib/prisma";

/**
 * Tables behind Match Tokens and billing history. Same lazy, idempotent pattern as the other
 * ensure*Schema helpers — the admin panel keeps an identical copy (admin/src/lib/billing-schema.ts)
 * so either app can create them first.
 *
 *   token_settings      one row: allowances, rollover, top-up pack, grace, reminders
 *   token_lots          every grant (basic / gold / rollover / purchased / admin / refund) with its
 *                       own expiry; the balance is the sum of live lots' `remaining`
 *   token_spends        which lot each Match Request spent, so a refund goes back where it came from
 *   billing_events      payments, renewals, cancellations, refunds, disputes — the member's timeline
 *   admin_alerts        things a human must look at (paid without credit, Stripe mismatch, …)
 *   member_usage_events Advanced Filter / AI Match Insights usage counts (no content)
 */
export const BILLING_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS token_settings (
    id INT PRIMARY KEY DEFAULT 1,
    basic_monthly INT NOT NULL DEFAULT 3,
    gold_monthly INT NOT NULL DEFAULT 10,
    rollover_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rollover_max INT NOT NULL DEFAULT 5,
    rollover_cycles INT NOT NULL DEFAULT 1,
    gold_max_total INT NOT NULL DEFAULT 15,
    topup_tokens INT NOT NULL DEFAULT 5,
    topup_price_pence INT NOT NULL DEFAULT 699,
    topup_price_id VARCHAR(255),
    grace_days INT NOT NULL DEFAULT 3,
    reminder_days INT NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by BIGINT
  )`,
  `INSERT INTO token_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS token_lots (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    source VARCHAR(16) NOT NULL,
    amount INT NOT NULL,
    remaining INT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    cycle_key VARCHAR(255),
    idempotency_key VARCHAR(200) UNIQUE,
    payment_id BIGINT,
    stripe_ref VARCHAR(255),
    admin_id BIGINT,
    note TEXT,
    rolled_over BOOLEAN NOT NULL DEFAULT FALSE,
    closed_at TIMESTAMPTZ,
    close_reason VARCHAR(32),
    closed_remaining INT,
    reminded_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS token_lots_user_idx ON token_lots (user_id, granted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS token_lots_live_idx ON token_lots (expires_at) WHERE remaining > 0`,
  `CREATE TABLE IF NOT EXISTS token_spends (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    lot_id BIGINT NOT NULL,
    request_id BIGINT,
    amount INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refunded_at TIMESTAMPTZ,
    refund_lot_id BIGINT
  )`,
  `CREATE INDEX IF NOT EXISTS token_spends_request_idx ON token_spends (request_id)`,
  `CREATE INDEX IF NOT EXISTS token_spends_user_idx ON token_spends (user_id, created_at DESC)`,
  `ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS lot_id BIGINT`,
  // Older code inserted MAX(id)+1 by hand; bring the sequence past it so inserts can rely on it.
  `SELECT setval('credit_ledger_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_ledger), 1))`,
  `ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS note TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_lots_migrated_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_grace_until TIMESTAMPTZ`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255)`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255)`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_pence INT NOT NULL DEFAULT 0`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_reason TEXT`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS billing_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    kind VARCHAR(40) NOT NULL,
    amount_pence INT,
    currency VARCHAR(8),
    stripe_ref VARCHAR(255),
    reason TEXT,
    data JSONB,
    dedupe_key VARCHAR(200) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS billing_events_user_idx ON billing_events (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS billing_events_kind_idx ON billing_events (kind, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS admin_alerts (
    id BIGSERIAL PRIMARY KEY,
    kind VARCHAR(40) NOT NULL,
    severity VARCHAR(12) NOT NULL DEFAULT 'warning',
    user_id BIGINT,
    message TEXT NOT NULL,
    data JSONB,
    dedupe_key VARCHAR(200) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by BIGINT
  )`,
  `CREATE INDEX IF NOT EXISTS admin_alerts_open_idx ON admin_alerts (created_at DESC) WHERE resolved_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS member_usage_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    kind VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS member_usage_events_user_idx ON member_usage_events (user_id, kind, created_at)`,
];

let ensured: Promise<void> | null = null;
export function ensureBillingSchema(): Promise<void> {
  ensured ??= (async () => {
    for (const sql of BILLING_SCHEMA_SQL) await prisma.$executeRawUnsafe(sql);
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

/** Fire-and-forget usage counter (Advanced Filter searches, AI Match Insights opens). */
export async function recordUsage(userId: bigint, kind: "advanced_filter" | "ai_insight") {
  try {
    await ensureBillingSchema();
    await prisma.$executeRaw`INSERT INTO member_usage_events (user_id, kind) VALUES (${userId}, ${kind})`;
  } catch (err) {
    console.error("[usage] record failed", err);
  }
}
