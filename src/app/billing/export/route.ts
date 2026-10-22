import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { ensureBillingSchema } from "@/lib/billing-schema";
import { resolveRange } from "@/lib/billing";

export const dynamic = "force-dynamic";

function csv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)) : String(v);
    // Neutralise spreadsheet formula injection and quote everything that needs it.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

/** Admin → Billing → Export CSV for the selected date range. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureBillingSchema();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "payments";
  const { from, to } = resolveRange({ range: "custom", from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined });

  let rows: Record<string, unknown>[] = [];
  if (type === "payments") {
    rows = await prisma.$queryRaw`
      SELECT p.id, p.created_at, p.user_id, pr.profile_code, u.email, p.type, p.plan_or_pack, p.amount_pence, p.currency, p.status,
        p.refunded_pence, p.refund_reason, p.disputed_at, p.period_start, p.period_end, p.stripe_invoice_id,
        p.stripe_payment_intent_id, p.stripe_subscription_id, p.stripe_session_id
      FROM payments p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN profiles pr ON pr.user_id = p.user_id
      WHERE p.created_at BETWEEN ${from} AND ${to} ORDER BY p.created_at DESC`;
  } else if (type === "events") {
    rows = await prisma.$queryRaw`
      SELECT e.id, e.created_at, e.user_id, pr.profile_code, e.kind, e.amount_pence, e.currency, e.stripe_ref, e.reason, e.data
      FROM billing_events e LEFT JOIN profiles pr ON pr.user_id = e.user_id
      WHERE e.created_at BETWEEN ${from} AND ${to} ORDER BY e.created_at DESC`;
  } else if (type === "tokens") {
    rows = await prisma.$queryRaw`
      SELECT l.id, l.created_at, l.user_id, pr.profile_code, l.reason, l.balance_type AS bucket, l.amount,
        l.previous_balance, l.new_balance, l.related_request_id, l.lot_id, l.note, a.email AS admin
      FROM credit_ledger l LEFT JOIN profiles pr ON pr.user_id = l.user_id LEFT JOIN users a ON a.id = l.admin_id
      WHERE l.created_at BETWEEN ${from} AND ${to} AND NOT (l.amount = 0 AND l.reason = 'admin_operation')
      ORDER BY l.created_at DESC LIMIT 50000`;
  } else if (type === "zero") {
    rows = await prisma.$queryRaw`
      SELECT u.id, pr.profile_code, u.email, u.plan, u.subscription_status, u.last_seen_at
      FROM users u LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE u.account_status = 'active' AND u.role = 'user' AND COALESCE(u.requests_remaining, 0) = 0
      ORDER BY u.last_seen_at DESC NULLS LAST`;
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  }

  const name = `pn-${type}-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
