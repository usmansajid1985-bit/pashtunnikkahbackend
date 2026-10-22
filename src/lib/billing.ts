import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ensureBillingSchema } from "@/lib/billing-schema";
import type { AdminSessionPayload } from "@/lib/session";

/**
 * Admin side of Match Tokens & billing. Reads the tables the member app's token engine writes
 * (token_lots, token_spends, billing_events, admin_alerts, …). Grants and removals are NOT done
 * here — they go to the web app's signed /api/internal/tokens so the one engine applies them.
 */

/** BILLING_ADMIN_EMAILS (comma-separated) limits who may change billing; unset = every admin. */
export function canManageBilling(session: AdminSessionPayload | null) {
  if (!session) return false;
  const allowed = (process.env.BILLING_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(session.email.toLowerCase());
}

export async function callWebTokens(
  userId: bigint,
  op: { op: "grant" | "remove"; amount: number; reason: string; adminId: string; expiresAt?: string | null }
): Promise<{ ok: boolean; error?: string; balance?: number; removed?: number }> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return { ok: false, error: "INTERNAL_API_SECRET is not set on the admin app." };
  const origin = (process.env.WEB_PUBLIC_URL || "http://localhost:3001").replace(/\/$/, "");
  const status = JSON.stringify({ ...op, key: randomBytes(12).toString("hex") });
  const ts = String(Date.now());
  const id = userId.toString();
  const signature = createHmac("sha256", secret).update(`${id}.${status}.${ts}`).digest("hex");
  try {
    const res = await fetch(`${origin}/api/internal/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pn-signature": signature },
      body: JSON.stringify({ userId: id, status, ts }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; balance?: number; removed?: number };
    if (!res.ok) return { ok: false, error: data.error || `Member app returned ${res.status}` };
    return { ok: true, balance: data.balance, removed: data.removed };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach the member app." };
  }
}

export type TokenSettingsRow = {
  basic_monthly: number;
  gold_monthly: number;
  rollover_enabled: boolean;
  rollover_max: number;
  rollover_cycles: number;
  gold_max_total: number;
  topup_tokens: number;
  topup_price_pence: number;
  topup_price_id: string | null;
  grace_days: number;
  reminder_days: number;
  updated_at: Date;
  updated_by: bigint | null;
};

export async function loadTokenSettings(): Promise<TokenSettingsRow> {
  await ensureBillingSchema();
  const rows = await prisma.$queryRaw<TokenSettingsRow[]>`SELECT * FROM token_settings WHERE id = 1`;
  return rows[0];
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export type LotRow = {
  id: bigint;
  source: string;
  amount: number;
  remaining: number;
  granted_at: Date;
  expires_at: Date | null;
  closed_at: Date | null;
  close_reason: string | null;
  closed_remaining: number | null;
  stripe_ref: string | null;
  note: string | null;
};

export type BillingEventRow = {
  id: bigint;
  kind: string;
  amount_pence: number | null;
  currency: string | null;
  stripe_ref: string | null;
  reason: string | null;
  data: Record<string, unknown> | null;
  created_at: Date;
};

export type PaymentRow = {
  id: bigint;
  type: string;
  plan_or_pack: string;
  amount_pence: number;
  currency: string;
  status: string;
  created_at: Date;
  stripe_session_id: string;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  period_start: Date | null;
  period_end: Date | null;
  refunded_pence: number;
  refund_reason: string | null;
  disputed_at: Date | null;
};

export type LedgerRow = {
  id: bigint;
  amount: number;
  balance_type: string;
  reason: string;
  previous_balance: number;
  new_balance: number;
  related_request_id: bigint | null;
  created_at: Date;
  note: string | null;
  admin_email: string | null;
};

export type Usage = {
  tokensSpent: number;
  requestsSent: number;
  conversations: number;
  messagesSent: number;
  advancedFilter: number;
  aiInsight: number;
};

export async function usageBetween(userId: bigint, from: Date, to: Date): Promise<Usage> {
  const rows = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT
      (SELECT COUNT(*) FROM token_spends WHERE user_id = ${userId} AND created_at BETWEEN ${from} AND ${to}) AS tokens_spent,
      (SELECT COUNT(*) FROM match_requests WHERE sender_id = ${userId} AND created_at BETWEEN ${from} AND ${to}) AS requests_sent,
      (SELECT COUNT(*) FROM match_requests WHERE status IN ('accepted', 'ended')
         AND (sender_id = ${userId} OR receiver_id = ${userId}) AND updated_at BETWEEN ${from} AND ${to}) AS conversations,
      (SELECT COUNT(*) FROM messages WHERE sender_id = ${userId} AND created_at BETWEEN ${from} AND ${to}) AS messages_sent,
      (SELECT COUNT(*) FROM member_usage_events WHERE user_id = ${userId} AND kind = 'advanced_filter' AND created_at BETWEEN ${from} AND ${to}) AS advanced_filter,
      (SELECT COUNT(*) FROM member_usage_events WHERE user_id = ${userId} AND kind = 'ai_insight' AND created_at BETWEEN ${from} AND ${to}) AS ai_insight
  `;
  const r = rows[0] ?? {};
  return {
    tokensSpent: n(r.tokens_spent),
    requestsSent: n(r.requests_sent),
    conversations: n(r.conversations),
    messagesSent: n(r.messages_sent),
    advancedFilter: n(r.advanced_filter),
    aiInsight: n(r.ai_insight),
  };
}

/** Everything the member detail page's Billing & Usage section shows. */
export async function loadMemberBilling(userId: bigint) {
  await ensureBillingSchema();
  const [user, payments, events, lots, ledger, reqSent, reqReceived, convos, usage, firstSub] = await Promise.all([
    prisma.$queryRaw<
      {
        plan: string | null;
        subscription_status: string | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        subscription_cancel_at: Date | null;
        payment_grace_until: Date | null;
        requests_remaining: number;
      }[]
    >`SELECT plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_cancel_at,
             payment_grace_until, requests_remaining FROM users WHERE id = ${userId}`,
    prisma.$queryRaw<PaymentRow[]>`
      SELECT id, type, plan_or_pack, amount_pence, currency, status, created_at, stripe_session_id, stripe_invoice_id,
        stripe_payment_intent_id, stripe_subscription_id, period_start, period_end, refunded_pence, refund_reason, disputed_at
      FROM payments WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`,
    prisma.$queryRaw<BillingEventRow[]>`
      SELECT id, kind, amount_pence, currency, stripe_ref, reason, data, created_at
      FROM billing_events WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 200`,
    prisma.$queryRaw<LotRow[]>`
      SELECT id, source, amount, remaining, granted_at, expires_at, closed_at, close_reason, closed_remaining, stripe_ref, note
      FROM token_lots WHERE user_id = ${userId} ORDER BY granted_at DESC LIMIT 100`,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT l.id, l.amount, l.balance_type, l.reason, l.previous_balance, l.new_balance, l.related_request_id,
        l.created_at, l.note, a.email AS admin_email
      FROM credit_ledger l LEFT JOIN users a ON a.id = l.admin_id
      WHERE l.user_id = ${userId} AND NOT (l.amount = 0 AND l.reason = 'admin_operation')
      ORDER BY l.created_at DESC, l.id DESC LIMIT 300`,
    prisma.$queryRaw<{ status: string; n: bigint }[]>`
      SELECT status, COUNT(*) AS n FROM match_requests WHERE sender_id = ${userId} GROUP BY status`,
    prisma.$queryRaw<{ status: string; n: bigint }[]>`
      SELECT status, COUNT(*) AS n FROM match_requests WHERE receiver_id = ${userId} GROUP BY status`,
    prisma.$queryRaw<{ total: bigint; open: bigint }[]>`
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'accepted') AS open
      FROM match_requests WHERE status IN ('accepted', 'ended') AND (sender_id = ${userId} OR receiver_id = ${userId})`,
    prisma.$queryRaw<{ kind: string; total: bigint; last30: bigint }[]>`
      SELECT kind, COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS last30
      FROM member_usage_events WHERE user_id = ${userId} GROUP BY kind`,
    prisma.subscriptions.findFirst({ where: { user_id: userId }, orderBy: { subscription_started_at: "asc" } }),
  ]);

  const statusCounts = (rows: { status: string; n: bigint }[]) => {
    const m = Object.fromEntries(rows.map((r) => [r.status, n(r.n)])) as Record<string, number>;
    return {
      total: rows.reduce((s, r) => s + n(r.n), 0),
      pending: m.pending ?? 0,
      accepted: (m.accepted ?? 0) + (m.ended ?? 0),
      declined: m.declined ?? 0,
      withdrawn: m.cancelled ?? 0,
      expired: m.expired ?? 0,
    };
  };

  const now = Date.now();
  const live = lots.filter((l) => !l.closed_at && l.remaining > 0 && (!l.expires_at || l.expires_at.getTime() > now));
  const buckets: Record<string, { remaining: number; nextExpiry: Date | null }> = {};
  for (const l of live) {
    const b = (buckets[l.source] ??= { remaining: 0, nextExpiry: null });
    b.remaining += l.remaining;
    if (l.expires_at && (!b.nextExpiry || l.expires_at < b.nextExpiry)) b.nextExpiry = l.expires_at;
  }

  const goldPayments = payments.filter((p) => p.type === "subscription" && p.status !== "pending");
  const goldStart =
    events.filter((e) => e.kind === "gold_started").at(-1)?.created_at ??
    firstSub?.subscription_started_at ??
    goldPayments.at(-1)?.created_at ??
    null;
  const currentPeriodEnd = goldPayments.find((p) => p.period_end)?.period_end ?? null;

  // Usage since the latest completed payment — what a refund request would be judged on.
  const lastPaid = payments.find((p) => p.status === "completed" || p.status === "partially_refunded");
  const sinceLastPayment = lastPaid ? await usageBetween(userId, lastPaid.created_at, new Date()) : null;

  const usageMap = Object.fromEntries(usage.map((u) => [u.kind, { total: n(u.total), last30: n(u.last30) }]));

  return {
    user: user[0] ?? null,
    goldStart,
    currentPeriodEnd,
    payments,
    events,
    cancellations: events.filter((e) => e.kind === "cancellation_scheduled" || e.kind === "cancellation_reverted" || e.kind === "gold_ended"),
    refunds: events.filter((e) => e.kind === "refund" || e.kind.startsWith("dispute")),
    lots,
    buckets,
    liveTotal: live.reduce((s, l) => s + l.remaining, 0),
    ledger,
    sent: statusCounts(reqSent),
    received: statusCounts(reqReceived),
    conversations: { total: n(convos[0]?.total), open: n(convos[0]?.open) },
    advancedFilter: usageMap.advanced_filter ?? { total: 0, last30: 0 },
    aiInsight: usageMap.ai_insight ?? { total: 0, last30: 0 },
    lastPaid,
    sinceLastPayment,
  };
}

export type RangeKey = "7" | "30" | "90" | "custom";

export function resolveRange(params: { range?: string; from?: string; to?: string }) {
  const range = (["7", "30", "90", "custom"].includes(params.range || "") ? params.range : "30") as RangeKey;
  const to = range === "custom" && params.to ? endOfDay(new Date(params.to)) : new Date();
  const from =
    range === "custom" && params.from
      ? new Date(`${params.from}T00:00:00Z`)
      : new Date(to.getTime() - Number(range === "custom" ? 30 : range) * 86400000);
  return {
    range,
    from: Number.isNaN(from.getTime()) ? new Date(Date.now() - 30 * 86400000) : from,
    to: Number.isNaN(to.getTime()) ? new Date() : to,
  };
}

function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Billing report for a date range (Admin → Billing, dashboard summary, CSV). */
export async function loadBillingReport(from: Date, to: Date) {
  await ensureBillingSchema();
  const [money, eventsByKind, tokens, goldNow, zero, expiring, alerts] = await Promise.all([
    prisma.$queryRaw<{ type: string; n: bigint; pence: bigint }[]>`
      SELECT type, COUNT(*) AS n, COALESCE(SUM(amount_pence), 0) AS pence FROM payments
      WHERE status IN ('completed', 'refunded', 'partially_refunded') AND created_at BETWEEN ${from} AND ${to}
      GROUP BY type`,
    prisma.$queryRaw<{ kind: string; n: bigint; pence: bigint }[]>`
      SELECT kind, COUNT(*) AS n, COALESCE(SUM(amount_pence), 0) AS pence FROM billing_events
      WHERE created_at BETWEEN ${from} AND ${to} GROUP BY kind`,
    prisma.$queryRaw<
      { granted: bigint; spent: bigint; expired: bigint; refunded: bigint; admin_granted: bigint; admin_removed: bigint }[]
    >`
      SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM token_lots WHERE granted_at BETWEEN ${from} AND ${to} AND source <> 'refund') AS granted,
        (SELECT COUNT(*) FROM token_spends WHERE created_at BETWEEN ${from} AND ${to}) AS spent,
        (SELECT COALESCE(-SUM(amount), 0) FROM credit_ledger WHERE reason IN ('token_expired', 'gold_ended', 'gold_upgrade_reconciled') AND created_at BETWEEN ${from} AND ${to}) AS expired,
        (SELECT COUNT(*) FROM credit_ledger WHERE reason IN ('request_withdrawn_refund', 'request_expired_refund', 'request_blocked_refund') AND created_at BETWEEN ${from} AND ${to}) AS refunded,
        (SELECT COALESCE(SUM(amount), 0) FROM credit_ledger WHERE reason = 'admin_grant' AND created_at BETWEEN ${from} AND ${to}) AS admin_granted,
        (SELECT COALESCE(-SUM(amount), 0) FROM credit_ledger WHERE reason = 'admin_remove' AND created_at BETWEEN ${from} AND ${to}) AS admin_removed`,
    prisma.$queryRaw<{ gold: bigint; past_due: bigint; cancelling: bigint }[]>`
      SELECT COUNT(*) FILTER (WHERE LOWER(plan) = 'gold') AS gold,
             COUNT(*) FILTER (WHERE LOWER(plan) = 'gold' AND subscription_status = 'past_due') AS past_due,
             COUNT(*) FILTER (WHERE LOWER(plan) = 'gold' AND subscription_cancel_at IS NOT NULL) AS cancelling
      FROM users`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM users WHERE account_status = 'active' AND role = 'user' AND COALESCE(requests_remaining, 0) = 0`,
    prisma.$queryRaw<{ members: bigint; tokens: bigint }[]>`
      SELECT COUNT(DISTINCT user_id) AS members, COALESCE(SUM(remaining), 0) AS tokens FROM token_lots
      WHERE closed_at IS NULL AND remaining > 0 AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM admin_alerts WHERE resolved_at IS NULL`,
  ]);
  const ev = Object.fromEntries(eventsByKind.map((e) => [e.kind, { n: n(e.n), pence: n(e.pence) }])) as Record<string, { n: number; pence: number }>;
  const pay = Object.fromEntries(money.map((m) => [m.type, { n: n(m.n), pence: n(m.pence) }])) as Record<string, { n: number; pence: number }>;
  const gross = Object.values(pay).reduce((s, p) => s + p.pence, 0);
  const refunds = ev.refund ?? { n: 0, pence: 0 };
  const t = tokens[0];
  return {
    from,
    to,
    goldMembers: n(goldNow[0]?.gold),
    pastDue: n(goldNow[0]?.past_due),
    cancelling: n(goldNow[0]?.cancelling),
    newGold: ev.gold_started?.n ?? 0,
    renewals: ev.renewal?.n ?? 0,
    revenueGross: gross,
    revenueNet: gross - refunds.pence,
    goldRevenue: pay.subscription?.pence ?? 0,
    topups: pay.topup ?? { n: 0, pence: 0 },
    cancellations: ev.cancellation_scheduled?.n ?? 0,
    goldEnded: ev.gold_ended?.n ?? 0,
    failedPayments: ev.payment_failed?.n ?? 0,
    refunds,
    disputes: ev.dispute_opened?.n ?? 0,
    tokens: {
      granted: n(t?.granted),
      spent: n(t?.spent),
      expired: n(t?.expired),
      refunded: n(t?.refunded),
      adminGranted: n(t?.admin_granted),
      adminRemoved: n(t?.admin_removed),
    },
    zeroBalance: n(zero[0]?.n),
    expiringSoon: { members: n(expiring[0]?.members), tokens: n(expiring[0]?.tokens) },
    openAlerts: n(alerts[0]?.n),
  };
}

export type AlertRow = {
  id: bigint;
  kind: string;
  severity: string;
  user_id: bigint | null;
  message: string;
  created_at: Date;
  resolved_at: Date | null;
};

export async function loadAlerts(includeResolved = false) {
  await ensureBillingSchema();
  return includeResolved
    ? prisma.$queryRaw<AlertRow[]>`SELECT id, kind, severity, user_id, message, created_at, resolved_at FROM admin_alerts ORDER BY created_at DESC LIMIT 100`
    : prisma.$queryRaw<AlertRow[]>`SELECT id, kind, severity, user_id, message, created_at, resolved_at FROM admin_alerts WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 100`;
}

export async function loadZeroBalanceMembers(limit = 50) {
  return prisma.$queryRaw<{ id: bigint; email: string; plan: string | null; profile_code: string | null; last_seen_at: Date | null }[]>`
    SELECT u.id, u.email, u.plan, p.profile_code, u.last_seen_at FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.account_status = 'active' AND u.role = 'user' AND COALESCE(u.requests_remaining, 0) = 0
    ORDER BY u.last_seen_at DESC NULLS LAST LIMIT ${limit}`;
}

export const LEDGER_REASON_LABELS: Record<string, string> = {
  monthly_free_allowance: "Basic monthly allowance",
  monthly_gold_allowance: "Gold monthly allowance",
  gold_rollover: "Gold rollover",
  request_sent: "Match Request sent",
  request_withdrawn_refund: "Refund — request withdrawn",
  request_expired_refund: "Refund — request expired",
  request_blocked_refund: "Refund — blocked",
  topup_purchased: "Top-up purchased",
  admin_adjustment: "Admin adjustment (old)",
  admin_grant: "Admin grant",
  admin_remove: "Admin removal",
  token_expired: "Expired",
  gold_ended: "Gold ended — tokens closed",
  gold_upgrade_reconciled: "Upgrade — Basic tokens replaced",
  balance_migrated: "Balance carried over to token lots",
};

export const EVENT_LABELS: Record<string, string> = {
  gold_started: "Gold started",
  renewal: "Renewal paid",
  payment_failed: "Payment failed",
  topup_purchased: "Top-up purchased",
  cancellation_scheduled: "Cancellation scheduled",
  cancellation_reverted: "Cancellation reverted",
  gold_ended: "Gold ended",
  refund: "Refund",
  dispute_opened: "Dispute opened",
  dispute_closed: "Dispute closed",
};
