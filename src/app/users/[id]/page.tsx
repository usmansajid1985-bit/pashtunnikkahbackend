import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate, moneyPence } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { adjustCredits, addUserNote, updateUserAccount, warnUser, toggleUserBlock } from "@/app/profiles/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function Info({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm break-words">{value || "—"}</p>
    </div>
  );
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = BigInt(id);

  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      profiles: { include: { profile_guardians: true } },
      payments: { orderBy: { created_at: "desc" }, take: 20 },
      subscriptions: { orderBy: { created_at: "desc" }, take: 10 },
      admin_notes_admin_notes_user_idTousers: {
        orderBy: { created_at: "desc" },
        take: 20,
      },
      moderation_log_moderation_log_user_idTousers: { orderBy: { created_at: "desc" }, take: 20 },
    },
  });

  if (!user) notFound();
  const p = user.profiles;
  const isBlocked = user.account_status === "suspended";

  const [
    matchesSent,
    matchesReceived,
    matchesAccepted,
    messagesSent,
    messagesReceived,
    profileViewsReceived,
    profileViewsGiven,
    favouritesReceived,
    favouritesGiven,
    reportsMade,
    reportsReceived,
    blocksMade,
    blocksReceived,
  ] = await Promise.all([
    prisma.match_requests.count({ where: { sender_id: userId } }),
    prisma.match_requests.count({ where: { receiver_id: userId } }),
    prisma.match_requests.count({
      where: { status: "accepted", OR: [{ sender_id: userId }, { receiver_id: userId }] },
    }),
    prisma.messages.count({ where: { sender_id: userId } }),
    prisma.messages.count({ where: { receiver_id: userId } }),
    prisma.profile_views.count({ where: { viewed_id: userId } }),
    prisma.profile_views.count({ where: { viewer_id: userId } }),
    prisma.favourites.count({ where: { profile_user_id: userId } }),
    prisma.favourites.count({ where: { user_id: userId } }),
    prisma.reports.count({ where: { reporter_id: userId } }),
    prisma.reports.count({ where: { reported_id: userId } }),
    prisma.blocks.count({ where: { blocker_id: userId } }),
    prisma.blocks.count({ where: { blocked_id: userId } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/users" className="text-sm text-muted-foreground hover:text-primary">
            ← Users
          </Link>
          <h2 className="mt-2 font-heading text-3xl font-medium tracking-tight break-all">{user.email}</h2>
          <p className="text-sm text-muted-foreground">
            User #{user.id.toString()} · {user.role} · {user.account_status}
          </p>
        </div>
        <form action={toggleUserBlock}>
          <input type="hidden" name="id" value={user.id.toString()} />
          <Button type="submit" variant={isBlocked ? "secondary" : "destructive"}>
            {isBlocked ? "Unblock user" : "Block user"}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={updateUserAccount} className="flex flex-wrap gap-3 items-end">
            <input type="hidden" name="id" value={user.id.toString()} />
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Account status</span>
              <select
                name="account_status"
                defaultValue={user.account_status}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {["active", "suspended", "deleted"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Plan</span>
              <select
                name="plan"
                defaultValue={(user.plan || "basic").toLowerCase()}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="basic">basic</option>
                <option value="gold">gold</option>
              </select>
            </label>
            <label className="text-sm flex items-center gap-2 pb-1">
              <input type="checkbox" name="email_verified" defaultChecked={user.email_verified} />
              Email verified
            </label>
            <label className="text-sm flex items-center gap-2 pb-1">
              <input type="checkbox" name="sms_verified" defaultChecked={user.sms_verified} />
              SMS verified
            </label>
            <label className="text-sm flex items-center gap-2 pb-1">
              <input type="checkbox" name="cultural_verified" defaultChecked={user.cultural_verified} />
              Cultural verified
            </label>
            <Button type="submit">Save account</Button>
          </form>

          <form action={adjustCredits} className="flex flex-wrap gap-3 items-end">
            <input type="hidden" name="id" value={user.id.toString()} />
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground mb-1">Introductions remaining</span>
              <Input
                name="requests_remaining"
                type="number"
                min={0}
                defaultValue={user.requests_remaining}
                className="w-28"
              />
            </label>
            <Button type="submit" variant="secondary">
              Update credits
            </Button>
          </form>

          <form action={warnUser}>
            <input type="hidden" name="user_id" value={user.id.toString()} />
            <Button type="submit" variant="outline" size="sm">
              Add warning (+1)
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Info title="Plan" value={user.plan || "free"} />
        <Info title="Subscription" value={user.subscription_status} />
        <Info title="Requests left" value={String(user.requests_remaining)} />
        <Info title="Email verified" value={user.email_verified ? "Yes" : "No"} />
        <Info title="SMS verified" value={user.sms_verified ? "Yes" : "No"} />
        <Info title="Cultural verified" value={user.cultural_verified ? "Yes" : "No"} />
        <Info title="Last seen" value={fmtDate(user.last_seen_at)} />
        <Info title="Stripe customer" value={user.stripe_customer_id} />
        <Info title="Stripe subscription" value={user.stripe_subscription_id} />
        <Info title="Registered" value={fmtDate(user.registered_at)} />
        <Info title="Approved at" value={fmtDate(user.approved_at)} />
      </div>

      {user.stripe_customer_id ? (
        <p className="text-sm">
          <a
            href={`https://dashboard.stripe.com/test/customers/${user.stripe_customer_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Open Stripe customer →
          </a>
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Interactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-card px-4 py-3 mb-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Matched with</p>
            <p className="mt-1 text-2xl font-heading font-medium">{matchesAccepted} {matchesAccepted === 1 ? "person" : "people"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Accepted matches — these are the chats this user actually has open.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info title="Requests sent" value={String(matchesSent)} />
            <Info title="Requests received" value={String(matchesReceived)} />
            <Info title="Messages sent" value={String(messagesSent)} />
            <Info title="Messages received" value={String(messagesReceived)} />
            <Info title="Profile views received" value={String(profileViewsReceived)} />
            <Info title="Profile views given" value={String(profileViewsGiven)} />
            <Info title="Favourited by others" value={String(favouritesReceived)} />
            <Info title="Favourited others" value={String(favouritesGiven)} />
            <Info title="Reports filed" value={String(reportsMade)} />
            <Info title="Reports received" value={String(reportsReceived)} />
            <Info title="Users blocked" value={String(blocksMade)} />
            <Info title="Blocked by others" value={String(blocksReceived)} />
          </div>
        </CardContent>
      </Card>

      {p && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Profile snapshot</CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge value={p.status} />
              <Link href={`/profiles/${p.id}`} className="text-sm text-primary hover:underline">
                Open full profile
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info title="Code" value={p.profile_code} />
            <Info title="Name" value={p.full_name} />
            <Info title="Gender" value={p.gender} />
            <Info title="Age" value={p.age != null ? String(p.age) : null} />
            <Info title="Warn count" value={String(p.warn_count)} />
            <Info title="Photo" value={p.photo_status} />
            <Info title="Hidden" value={p.is_hidden ? "Yes" : "No"} />
            <Info title="City" value={p.city || p.current_location} />
            <Info title="Country" value={p.country} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Admin notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addUserNote} className="space-y-2">
            <input type="hidden" name="user_id" value={user.id.toString()} />
            <textarea
              name="note"
              rows={3}
              placeholder="Internal note…"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              required
            />
            <Button type="submit" size="sm">
              Add note
            </Button>
          </form>
          <div className="space-y-2">
            {user.admin_notes_admin_notes_user_idTousers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              user.admin_notes_admin_notes_user_idTousers.map((n) => (
                <div key={n.id.toString()} className="rounded-lg border px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{n.note_text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtDate(n.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moderation log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {user.moderation_log_moderation_log_user_idTousers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No log entries.</p>
          ) : (
            user.moderation_log_moderation_log_user_idTousers.map((m) => (
              <div key={m.id.toString()} className="flex gap-3 text-sm border-b border-border/60 pb-2">
                <span className="font-medium shrink-0">{m.action}</span>
                <span className="text-muted-foreground flex-1 truncate">{m.note || "—"}</span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(m.created_at)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">Payments</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Pack</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {user.payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No payments
                </TableCell>
              </TableRow>
            )}
            {user.payments.map((pay) => (
              <TableRow key={pay.id.toString()}>
                <TableCell>{pay.type}</TableCell>
                <TableCell>{pay.plan_or_pack}</TableCell>
                <TableCell>{moneyPence(pay.amount_pence)}</TableCell>
                <TableCell>
                  <StatusBadge value={pay.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(pay.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
