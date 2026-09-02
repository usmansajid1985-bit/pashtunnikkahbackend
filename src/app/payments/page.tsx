import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, moneyPence, pageCount } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/pagination-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { stripeConfig } from "@/lib/stripe";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 30;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() || "";
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const where = status ? { status } : undefined;
  const stripe = stripeConfig();

  const [total, payments, subscriptions, revenue, goldCount] = await Promise.all([
    prisma.payments.count({ where }),
    prisma.payments.findMany({
      where,
      include: { users: { select: { email: true, id: true } } },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.subscriptions.findMany({
      include: { users: { select: { email: true, id: true } } },
      orderBy: { created_at: "desc" },
      take: 20,
    }),
    prisma.payments.aggregate({
      where: { status: "completed" },
      _sum: { amount_pence: true },
      _count: true,
    }),
    prisma.users.count({ where: { plan: { equals: "gold", mode: "insensitive" } } }),
  ]);

  const totalPages = pageCount(total, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl font-medium tracking-tight">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed revenue {moneyPence(revenue._sum.amount_pence)} · {revenue._count} paid checkouts ·{" "}
            {goldCount} Gold members
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["", "completed", "pending", "failed"].map((s) => (
            <Link key={s || "all"} href={s ? `/payments?status=${s}` : "/payments"}>
              <Badge variant={(status || "") === s ? "default" : "outline"} className="capitalize">
                {s || "all"}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stripe test config</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Mode</p>
            <p className="font-medium uppercase">{stripe.configured ? stripe.mode : "not configured"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Product</p>
            <p className="font-mono text-xs break-all">{stripe.productId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-mono text-xs break-all">{stripe.priceId || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dashboard</p>
            <a
              href={`https://dashboard.stripe.com/${stripe.mode === "live" ? "" : "test/"}products/${stripe.productId}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline text-sm"
            >
              Open product →
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Pack</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No payments yet — run a test checkout from web /settings/membership
                </TableCell>
              </TableRow>
            )}
            {payments.map((p) => (
              <TableRow key={p.id.toString()}>
                <TableCell>
                  <Link href={`/users/${p.user_id}`} className="text-primary hover:underline">
                    {p.users.email}
                  </Link>
                </TableCell>
                <TableCell>{p.type}</TableCell>
                <TableCell>{p.plan_or_pack}</TableCell>
                <TableCell className="tabular-nums">{moneyPence(p.amount_pence)}</TableCell>
                <TableCell>
                  <StatusBadge value={p.status} />
                </TableCell>
                <TableCell className="font-mono text-[11px] max-w-[140px] truncate">
                  {p.stripe_session_id}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtDate(p.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/payments"
        searchParams={{ status: status || undefined }}
      />

      <div>
        <h3 className="font-heading text-xl font-medium mb-3">Subscriptions</h3>
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Stripe sub</TableHead>
                <TableHead>Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No subscriptions recorded yet
                  </TableCell>
                </TableRow>
              )}
              {subscriptions.map((s) => (
                <TableRow key={s.id.toString()}>
                  <TableCell>
                    <Link href={`/users/${s.user_id}`} className="text-primary hover:underline">
                      {s.users.email}
                    </Link>
                  </TableCell>
                  <TableCell>{s.plan}</TableCell>
                  <TableCell>{moneyPence(s.amount_pence)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(s.subscription_started_at)}</TableCell>
                  <TableCell className="font-mono text-[11px] max-w-[160px] truncate">
                    {s.stripe_subscription_id || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.refund_eligible ? "eligible" : s.refund_ineligible_reason || "not eligible"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
