import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtShortDate, moneyWithCurrency } from "@/lib/format";
import { stripeConfig } from "@/lib/stripe";
import { EVENT_LABELS, LEDGER_REASON_LABELS, loadMemberBilling, type Usage } from "@/lib/billing";
import { adjustMemberTokens } from "@/app/billing/actions";

const BUCKETS: { key: string; label: string; hint: string }[] = [
  { key: "basic", label: "Basic", hint: "monthly, no rollover" },
  { key: "gold", label: "Gold", hint: "this paid cycle" },
  { key: "rollover", label: "Rollover", hint: "from last cycle" },
  { key: "purchased", label: "Purchased", hint: "never expire" },
  { key: "admin", label: "Admin", hint: "granted by PN" },
  { key: "refund", label: "Refunded", hint: "late refunds" },
];

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

function UsageGrid({ u }: { u: Usage }) {
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Tokens spent" value={u.tokensSpent} />
      <Stat label="Requests sent" value={u.requestsSent} />
      <Stat label="Conversations" value={u.conversations} />
      <Stat label="Messages sent" value={u.messagesSent} />
      <Stat label="Advanced Filter" value={u.advancedFilter} />
      <Stat label="AI Insights" value={u.aiInsight} />
    </div>
  );
}

function StripeLink({ kind, id }: { kind: "customers" | "subscriptions" | "invoices" | "payments"; id: string | null }) {
  if (!id) return <span>—</span>;
  const linkable = /^(cus|sub|in|pi)_/.test(id);
  if (!linkable) return <span className="font-mono text-xs break-all">{id}</span>;
  const base = `https://dashboard.stripe.com/${stripeConfig().mode === "test" ? "test/" : ""}`;
  return (
    <a href={`${base}${kind}/${id}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline break-all">
      {id}
    </a>
  );
}

/** Admin → Members → Member details → Billing & Usage. Counts only — never chat contents. */
export async function BillingUsage({ userId, ok, error }: { userId: bigint; ok?: string; error?: string }) {
  const b = await loadMemberBilling(userId);
  const u = b.user;
  if (!u) return null;
  const isGold = (u.plan || "").toLowerCase() === "gold";
  const cancellation = b.cancellations.find((c) => c.kind === "cancellation_scheduled");
  const paidThrough = u.subscription_cancel_at ?? b.currentPeriodEnd;

  return (
    <div id="billing" className="space-y-4 scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-heading text-2xl font-medium tracking-tight">Billing &amp; Usage</h3>
          <p className="text-sm text-muted-foreground">Membership, payments, Match Tokens and activity counts. No message contents are shown.</p>
        </div>
      </div>
      {ok ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Membership</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Membership" value={isGold ? "Gold" : "Basic"} />
          <Stat label="Subscription status" value={u.subscription_status || "—"} hint={u.payment_grace_until ? `In grace until ${fmtShortDate(u.payment_grace_until)}` : null} />
          <Stat label="Gold started" value={fmtShortDate(b.goldStart)} />
          <Stat
            label={u.subscription_cancel_at ? "Gold ends (paid through)" : isGold ? "Renews / paid through" : "Last paid through"}
            value={fmtShortDate(paidThrough)}
          />
          <Stat label="Cancellation" value={cancellation ? fmtShortDate(cancellation.created_at) : "—"} hint={cancellation?.reason || (cancellation ? "No reason given" : null)} />
          <div className="rounded-xl border border-border bg-card px-3.5 py-3 sm:col-span-2 lg:col-span-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Stripe</p>
            <div className="mt-1 space-y-0.5 text-sm">
              <p>Customer: <StripeLink kind="customers" id={u.stripe_customer_id} /></p>
              <p>Subscription: <StripeLink kind="subscriptions" id={u.stripe_subscription_id} /></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match Tokens</CardTitle>
          <CardDescription>
            Balance {b.liveTotal} — spent earliest-expiring first, purchased last.
            {b.liveTotal !== u.requests_remaining ? ` (Cached balance shows ${u.requests_remaining}; it refreshes on the member's next action.)` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {BUCKETS.map((k) => {
              const bucket = b.buckets[k.key];
              return (
                <Stat
                  key={k.key}
                  label={k.label}
                  value={bucket?.remaining ?? 0}
                  hint={bucket?.nextExpiry ? `expires ${fmtShortDate(bucket.nextExpiry)}` : k.hint}
                />
              );
            })}
          </div>
          <form action={adjustMemberTokens} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[auto_6rem_1fr_auto_auto] sm:items-end">
            <input type="hidden" name="id" value={userId.toString()} />
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Action</span>
              <select name="op" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="grant">Grant</option>
                <option value="remove">Remove</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Tokens</span>
              <Input name="amount" type="number" min={1} max={100} defaultValue={1} required />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Reason (required, saved to the audit log)</span>
              <Input name="reason" minLength={5} maxLength={500} required placeholder="e.g. Goodwill after failed request" />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Grant expires (optional)</span>
              <Input name="expires" type="date" />
            </label>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requests &amp; feature usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Requests sent" value={b.sent.total} hint={`${b.sent.pending} pending`} />
            <Stat label="Accepted" value={b.sent.accepted} hint={`received: ${b.received.accepted}`} />
            <Stat label="Declined" value={b.sent.declined} hint={`declined by them: ${b.received.declined}`} />
            <Stat label="Withdrawn" value={b.sent.withdrawn} hint={`${b.sent.expired} expired`} />
            <Stat label="Conversations" value={b.conversations.total} hint={`${b.conversations.open} open`} />
            <Stat label="Requests received" value={b.received.total} hint={`${b.received.pending} pending`} />
            <Stat label="Advanced Filter" value={b.advancedFilter.total} hint={`${b.advancedFilter.last30} in last 30 days`} />
            <Stat label="AI Match Insights" value={b.aiInsight.total} hint={`${b.aiInsight.last30} in last 30 days`} />
          </div>
          {b.lastPaid && b.sinceLastPayment ? (
            <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <p className="text-sm font-medium">
                Since last payment — {moneyWithCurrency(b.lastPaid.amount_pence, b.lastPaid.currency)} on {fmtDate(b.lastPaid.created_at)}
              </p>
              <p className="text-xs text-muted-foreground">Use this to judge a refund request. Counts only.</p>
              <UsageGrid u={b.sinceLastPayment} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">Payments &amp; renewals</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Stripe reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">No payments</TableCell>
                </TableRow>
              ) : null}
              {b.payments.map((p) => (
                <TableRow key={p.id.toString()}>
                  <TableCell className="whitespace-nowrap">{fmtDate(p.created_at)}</TableCell>
                  <TableCell>
                    {p.type === "topup" ? `Top-up (${p.plan_or_pack.replace("_credits", " tokens")})` : p.plan_or_pack === "gold_renewal" ? "Gold renewal" : "Gold"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {moneyWithCurrency(p.amount_pence, p.currency)}
                    {p.refunded_pence > 0 ? <span className="block text-xs text-red-700">−{moneyWithCurrency(p.refunded_pence, p.currency)} refunded</span> : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={p.status} />
                    {p.disputed_at ? <span className="ml-1 text-xs text-red-700">disputed</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {p.period_start ? `${fmtShortDate(p.period_start)} – ${fmtShortDate(p.period_end)}` : "—"}
                  </TableCell>
                  <TableCell className="space-y-0.5">
                    {p.stripe_invoice_id ? <div><StripeLink kind="invoices" id={p.stripe_invoice_id} /></div> : null}
                    {p.stripe_payment_intent_id ? <div><StripeLink kind="payments" id={p.stripe_payment_intent_id} /></div> : null}
                    {!p.stripe_invoice_id && !p.stripe_payment_intent_id ? <span className="font-mono text-xs break-all">{p.stripe_session_id}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cancellations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {b.cancellations.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : null}
            {b.cancellations.map((c) => (
              <div key={c.id.toString()} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{EVENT_LABELS[c.kind] ?? c.kind} · {fmtDate(c.created_at)}</p>
                {c.kind === "cancellation_scheduled" ? (
                  <p className="text-muted-foreground">
                    Paid through {fmtShortDate((c.data?.paidThrough as string) ?? null)} · Reason: {c.reason || "not given"}
                  </p>
                ) : c.reason ? (
                  <p className="text-muted-foreground">{c.reason}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Refunds &amp; disputes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {b.refunds.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : null}
            {b.refunds.map((r) => {
              const usage = r.data?.usageSincePayment as Usage | undefined;
              return (
                <div key={r.id.toString()} className="rounded-lg border px-3 py-2 text-sm space-y-2">
                  <p className="font-medium">
                    {EVENT_LABELS[r.kind] ?? r.kind} · {moneyWithCurrency(r.amount_pence, r.currency)} · {fmtDate(r.created_at)}
                  </p>
                  <p className="text-muted-foreground">
                    {r.reason ? `Reason: ${r.reason} · ` : ""}
                    <span className="font-mono text-xs">{r.stripe_ref}</span>
                  </p>
                  {usage ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Usage between payment and refund</p>
                      <UsageGrid u={usage} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">Token grants</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Granted</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Left</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.lots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">No grants yet — the member&apos;s balance moves to token lots on their next action.</TableCell>
                </TableRow>
              ) : null}
              {b.lots.map((l) => (
                <TableRow key={l.id.toString()}>
                  <TableCell className="whitespace-nowrap">{fmtDate(l.granted_at)}</TableCell>
                  <TableCell className="capitalize">{l.source}</TableCell>
                  <TableCell>{l.amount}</TableCell>
                  <TableCell>{l.closed_at ? 0 : l.remaining}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.expires_at ? fmtShortDate(l.expires_at) : "Never"}</TableCell>
                  <TableCell className="text-xs">
                    {l.closed_at ? `Closed ${fmtShortDate(l.closed_at)} (${l.close_reason?.replace(/_/g, " ")}${l.closed_remaining ? `, ${l.closed_remaining} unused` : ""})` : "Live"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[18rem]">{l.note || l.stripe_ref || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">Token history</div>
        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.ledger.map((l) => (
                <TableRow key={l.id.toString()}>
                  <TableCell className="whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                  <TableCell>{LEDGER_REASON_LABELS[l.reason] ?? l.reason}</TableCell>
                  <TableCell className="capitalize">{l.balance_type}</TableCell>
                  <TableCell className={`tabular-nums ${l.amount > 0 ? "text-emerald-700" : l.amount < 0 ? "text-red-700" : ""}`}>
                    {l.amount > 0 ? `+${l.amount}` : l.amount}
                  </TableCell>
                  <TableCell className="tabular-nums">{l.previous_balance} → {l.new_balance}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[l.note, l.admin_email ? `by ${l.admin_email}` : null, l.related_request_id ? `request #${l.related_request_id}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
