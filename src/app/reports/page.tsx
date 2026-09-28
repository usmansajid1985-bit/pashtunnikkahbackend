import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { decideReport, reviewFlaggedMessage, warnUser } from "@/app/profiles/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, flagged, warnings] = await Promise.all([
    prisma.reports.findMany({
      include: {
        users_reports_reporter_idTousers: { select: { email: true, profiles: { select: { profile_code: true } } } },
        users_reports_reported_idTousers: { select: { email: true, profiles: { select: { profile_code: true } } } },
      },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    prisma.flagged_messages.findMany({
      include: {
        users_flagged_messages_sender_idTousers: { select: { email: true } },
        users_flagged_messages_receiver_idTousers: { select: { email: true } },
      },
      orderBy: { flagged_at: "desc" },
      take: 50,
    }),
    prisma.$queryRaw<
      {
        id: bigint;
        user_id: bigint;
        request_id: bigint | null;
        words: string;
        reason: string;
        warning_number: number;
        created_at: Date;
        email: string | null;
        profile_code: string | null;
        warn_count: number | null;
      }[]
    >`
      SELECT w.id, w.user_id, w.request_id, w.words, w.reason, w.warning_number, w.created_at,
             u.email, p.profile_code, p.warn_count
      FROM chat_warnings w
      LEFT JOIN users u ON u.id = w.user_id
      LEFT JOIN profiles p ON p.user_id = w.user_id
      ORDER BY w.created_at DESC
      LIMIT 80
    `.catch(() => []),
  ]);

  // A02: the reported message (when one was picked) so the admin sees it in context.
  const reportedMessageIds = reports.map((r) => r.message_id).filter((id): id is bigint => id != null);
  const reportedMessages = reportedMessageIds.length
    ? await prisma.messages.findMany({
        where: { id: { in: reportedMessageIds } },
        select: { id: true, body: true, created_at: true },
      })
    : [];
  const messageById = new Map(reportedMessages.map((m) => [m.id.toString(), m]));
  const adminIds = [...new Set(reports.map((r) => r.resolved_by).filter((v): v is bigint => v != null))];
  const admins = adminIds.length
    ? await prisma.users.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })
    : [];
  const adminLabel = new Map(admins.map((a) => [a.id.toString(), a.email]));
  const codeOf = (u: { email: string; profiles: { profile_code: string | null } | null }) =>
    u.profiles?.profile_code || u.email;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">Resolve user reports and review auto-flagged messages.</p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">User reports</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reporter</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No reports
                </TableCell>
              </TableRow>
            )}
            {reports.map((r) => (
              <TableRow key={r.id.toString()}>
                <TableCell>
                  <Link href={`/users/${r.reporter_id}`} className="text-primary hover:underline">
                    {codeOf(r.users_reports_reporter_idTousers)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/users/${r.reported_id}`} className="text-primary hover:underline">
                    {codeOf(r.users_reports_reported_idTousers)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-md align-top">
                  {r.category ? (
                    <div className="space-y-1.5">
                      <p className="font-medium">{r.category.replace(/_/g, " ")}</p>
                      {r.details ? <p className="text-sm whitespace-pre-wrap">{r.details}</p> : null}
                      {r.message_id && messageById.get(r.message_id.toString()) ? (
                        <blockquote className="border-l-2 pl-2 text-sm text-muted-foreground">
                          “{messageById.get(r.message_id.toString())!.body}”
                          <span className="block text-xs">
                            sent {fmtDate(messageById.get(r.message_id.toString())!.created_at)}
                          </span>
                        </blockquote>
                      ) : null}
                      {r.request_id ? (
                        <Link href={`/chats/${r.request_id}`} className="text-xs text-primary hover:underline">
                          Open conversation #{r.request_id.toString()} →
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    r.reason
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge value={r.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                <TableCell>
                  {r.status === "open" ? (
                    /* A03: one form, three distinct decisions — each recorded with admin, reason, time. */
                    <form action={decideReport} className="space-y-1.5 min-w-[220px]">
                      <input type="hidden" name="id" value={r.id.toString()} />
                      <textarea
                        name="note"
                        rows={2}
                        placeholder="Reason / note (required to warn — the member sees it)"
                        className="w-full rounded-md border px-2 py-1 text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        <Button type="submit" name="decision" value="resolved" size="sm" variant="secondary">
                          Resolve
                        </Button>
                        <Button type="submit" name="decision" value="dismissed" size="sm" variant="outline">
                          Dismiss
                        </Button>
                        <Button type="submit" name="decision" value="warned" size="sm" variant="destructive">
                          Warn member
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Resolve = reviewed &amp; actioned · Dismiss = no action · Warn = sends the note to the member
                      </p>
                    </form>
                  ) : (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium capitalize">
                        {r.resolution === "warned" ? "Member warned" : r.resolution || r.status}
                      </p>
                      {r.resolution_note ? <p className="text-muted-foreground">“{r.resolution_note}”</p> : null}
                      <p className="text-muted-foreground">
                        {r.resolved_by ? `by ${adminLabel.get(r.resolved_by.toString()) ?? `admin #${r.resolved_by}`}` : ""}
                        {r.resolved_at ? ` · ${fmtDate(r.resolved_at)}` : ""}
                      </p>
                      <form action={decideReport}>
                        <input type="hidden" name="id" value={r.id.toString()} />
                        <Button type="submit" name="decision" value="open" size="sm" variant="ghost">
                          Reopen
                        </Button>
                      </form>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">Flagged messages</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Original</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reviewed</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flagged.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No flagged messages
                </TableCell>
              </TableRow>
            )}
            {flagged.map((f) => (
              <TableRow key={f.id.toString()} className="align-top">
                <TableCell>
                  <Link href={`/users/${f.sender_id}`} className="text-primary hover:underline">
                    {f.users_flagged_messages_sender_idTousers.email}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/users/${f.receiver_id}`} className="text-primary hover:underline">
                    {f.users_flagged_messages_receiver_idTousers.email}
                  </Link>
                </TableCell>
                <TableCell className="max-w-lg whitespace-pre-wrap text-sm">{f.original_text}</TableCell>
                <TableCell>{f.reason}</TableCell>
                <TableCell>{f.reviewed ? "yes" : "no"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!f.reviewed ? (
                      <form action={reviewFlaggedMessage}>
                        <input type="hidden" name="id" value={f.id.toString()} />
                        <input type="hidden" name="reviewed" value="true" />
                        <Button type="submit" size="sm">
                          Mark reviewed
                        </Button>
                      </form>
                    ) : null}
                    <form action={warnUser}>
                      <input type="hidden" name="user_id" value={f.sender_id.toString()} />
                      <Button type="submit" size="sm" variant="outline">
                        Warn sender
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b font-medium">Chat warnings (blocked messages)</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Blocked words</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warnings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No chat warnings yet
                </TableCell>
              </TableRow>
            )}
            {warnings.map((w) => (
              <TableRow key={w.id.toString()} className="align-top">
                <TableCell>
                  <Link href={`/users/${w.user_id}`} className="text-primary hover:underline">
                    {w.profile_code || w.email || w.user_id.toString()}
                  </Link>
                  <p className="text-xs text-muted-foreground">{w.email}</p>
                </TableCell>
                <TableCell>
                  {w.warning_number}
                  {w.warn_count != null ? (
                    <span className="text-xs text-muted-foreground"> / {w.warn_count} total</span>
                  ) : null}
                </TableCell>
                <TableCell>{w.reason}</TableCell>
                <TableCell className="max-w-lg whitespace-pre-wrap text-sm text-red-700">{w.words}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(w.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
