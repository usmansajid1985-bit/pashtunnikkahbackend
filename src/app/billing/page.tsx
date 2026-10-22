import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminSession } from "@/lib/admin-auth";
import { fmtDate, fmtShortDate, moneyPence } from "@/lib/format";
import {
  canManageBilling,
  loadAlerts,
  loadBillingReport,
  loadTokenSettings,
  loadZeroBalanceMembers,
  resolveRange,
} from "@/lib/billing";
import { resolveAlert, updateTokenSettings } from "./actions";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { range, from, to } = resolveRange(params);
  const [session, report, settings, alerts, zero] = await Promise.all([
    getAdminSession(),
    loadBillingReport(from, to),
    loadTokenSettings(),
    loadAlerts(),
    loadZeroBalanceMembers(),
  ]);
  const canEdit = canManageBilling(session);
  const qs = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Billing &amp; Tokens</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gold, top-ups, refunds and Match Tokens. Per-member detail is under Users → member → Billing &amp; Usage.
        </p>
      </div>
      {params.ok ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{params.ok}</p> : null}
      {params.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{params.error}</p> : null}

      {alerts.length > 0 ? (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle>Needs attention ({alerts.length})</CardTitle>
            <CardDescription>Payments without credit, duplicate grants, Stripe mismatches, webhook and refund errors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id.toString()} className="flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                    a.severity === "critical" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {a.kind.replace(/_/g, " ")}
                </span>
                <div className="flex-1 min-w-[14rem]">
                  <p>{a.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(a.created_at)}
                    {a.user_id ? (
                      <>
                        {" · "}
                        <Link href={`/users/${a.user_id}#billing`} className="text-primary hover:underline">
                          member #{a.user_id.toString()}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <form action={resolveAlert}>
                  <input type="hidden" name="id" value={a.id.toString()} />
                  <Button type="submit" size="sm" variant="outline">Resolve</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Report</CardTitle>
              <CardDescription>
                {fmtShortDate(from)} – {fmtShortDate(to)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/billing?range=${r.key}`}
                  className={`rounded-full border px-3 py-1 text-sm ${range === r.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                >
                  {r.label}
                </Link>
              ))}
              <form className="flex items-center gap-1.5" action="/billing">
                <input type="hidden" name="range" value="custom" />
                <Input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="h-8 w-36" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="h-8 w-36" />
                <Button type="submit" size="sm" variant={range === "custom" ? "default" : "outline"}>Apply</Button>
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
            <Stat label="Gold members" value={report.goldMembers} hint={`${report.pastDue} past due · ${report.cancelling} cancelling`} />
            <Stat label="Revenue (net)" value={moneyPence(report.revenueNet)} hint={`${moneyPence(report.revenueGross)} gross`} />
            <Stat label="New Gold" value={report.newGold} hint={`${report.renewals} renewals · ${moneyPence(report.goldRevenue)}`} />
            <Stat label="Top-up sales" value={report.topups.n} hint={moneyPence(report.topups.pence)} />
            <Stat label="Cancellations" value={report.cancellations} hint={`${report.goldEnded} Gold ended`} />
            <Stat label="Failed payments" value={report.failedPayments} />
            <Stat label="Refunds" value={report.refunds.n} hint={moneyPence(report.refunds.pence)} />
            <Stat label="Disputes" value={report.disputes} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Match Tokens</p>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <Stat label="Granted" value={report.tokens.granted} />
              <Stat label="Spent" value={report.tokens.spent} />
              <Stat label="Expired / closed" value={report.tokens.expired} />
              <Stat label="Refunded" value={report.tokens.refunded} hint="requests withdrawn, expired, blocked" />
              <Stat label="Admin granted" value={report.tokens.adminGranted} hint={`${report.tokens.adminRemoved} removed`} />
              <Stat label="Expiring in 7 days" value={report.expiringSoon.tokens} hint={`${report.expiringSoon.members} members`} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">Export CSV:</span>
            {[
              ["payments", "Payments"],
              ["events", "Billing events"],
              ["tokens", "Token transactions"],
              ["zero", "Zero-balance members"],
            ].map(([k, label]) => (
              <a key={k} href={`/billing/export?type=${k}&${qs}`} className="rounded-full border px-3 py-1 hover:bg-accent">
                {label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Token settings</CardTitle>
          <CardDescription>
            Changes apply to the next grant (next month for Basic, next paid cycle for Gold). A new top-up price is created in
            Stripe before it is saved, and the old price is archived. Last updated {fmtDate(settings.updated_at)}.
            {canEdit ? "" : " You can view these but not change them (BILLING_ADMIN_EMAILS)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateTokenSettings} className="space-y-5">
            <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Basic — tokens per month" name="basic_monthly" value={settings.basic_monthly} hint="no rollover" />
              <Field label="Gold — tokens per paid cycle" name="gold_monthly" value={settings.gold_monthly} hint="in total, never on top of Basic" />
              <Field label="Gold + rollover maximum" name="gold_max_total" value={settings.gold_max_total} hint="purchased tokens not counted" />
              <label className="flex items-center gap-2 text-sm pt-5">
                <input type="checkbox" name="rollover_enabled" defaultChecked={settings.rollover_enabled} />
                Rollover enabled
              </label>
              <Field label="Rollover — max unused Gold tokens" name="rollover_max" value={settings.rollover_max} />
              <Field label="Rollover valid for (paid cycles)" name="rollover_cycles" value={settings.rollover_cycles} hint="never rolls again" />
              <Field label="Top-up — tokens per pack" name="topup_tokens" value={settings.topup_tokens} hint="never expire" />
              <label className="block text-sm">
                <span className="block text-xs text-muted-foreground mb-1">Top-up — price (£)</span>
                <Input name="topup_price" type="number" step="0.01" min="0.5" defaultValue={(settings.topup_price_pence / 100).toFixed(2)} />
                <span className="text-[11px] text-muted-foreground">Stripe price: {settings.topup_price_id || "env / auto-detected"}</span>
              </label>
              <Field label="Grace period after failed renewal (days)" name="grace_days" value={settings.grace_days} />
              <Field label="Token expiry reminder (days before)" name="reminder_days" value={settings.reminder_days} hint="0 = off" />
            </fieldset>
            {canEdit ? <Button type="submit">Save token settings</Button> : null}
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Members with zero balance ({report.zeroBalance})</CardTitle>
          <CardDescription>Most recently active first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {zero.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : null}
          {zero.map((z) => (
            <Link
              key={z.id.toString()}
              href={`/users/${z.id}#billing`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span>
                {z.profile_code || "—"} <span className="text-muted-foreground">· {z.email}</span>
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {z.plan || "basic"} · seen {fmtShortDate(z.last_seen_at)}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, name, value, hint }: { label: string; name: string; value: number; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">
        {label}
        {hint ? <span className="opacity-70"> — {hint}</span> : null}
      </span>
      <Input name={name} type="number" min={0} defaultValue={value} />
    </label>
  );
}
