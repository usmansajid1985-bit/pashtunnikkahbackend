import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { getAdminSession } from "@/lib/admin-auth";
import { logChatAccess } from "@/lib/chat-access-log";
import { ensureChatAccessLogSchema } from "@/lib/ensure-chat-access-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { endMatch, removeMessage } from "@/app/profiles/actions";
import { isMessageRemoved } from "@/lib/ensure-message-removals";
import { isTestAccountEmail, loadFamilyStatus } from "@/lib/family-flow";
import { forceFamilyEligible, resetFamilyFlow } from "./family-actions";

export const dynamic = "force-dynamic";

function participantLabel(
  user: {
    id: bigint;
    email: string;
    plan: string | null;
    profiles: { profile_code: string | null; full_name: string | null } | null;
  } | null
) {
  if (!user) return "Unknown";
  return user.profiles?.profile_code || user.profiles?.full_name || user.email;
}

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  await ensureChatAccessLogSchema();

  const { requestId } = await params;
  if (!/^\d+$/.test(requestId)) notFound();

  const id = BigInt(requestId);
  const match = await prisma.match_requests.findUnique({
    where: { id },
    include: {
      users_match_requests_sender_idTousers: {
        select: {
          id: true,
          email: true,
          plan: true,
          profiles: { select: { profile_code: true, full_name: true, id: true } },
        },
      },
      users_match_requests_receiver_idTousers: {
        select: {
          id: true,
          email: true,
          plan: true,
          profiles: { select: { profile_code: true, full_name: true, id: true } },
        },
      },
    },
  });

  if (!match) notFound();

  await logChatAccess(BigInt(session.adminId), id);

  const [messages, flaggedCount, accessLog, removedIds] = await Promise.all([
    prisma.messages.findMany({
      where: { request_id: id },
      include: {
        users_messages_sender_idTousers: {
          select: {
            id: true,
            email: true,
            profiles: { select: { profile_code: true, full_name: true } },
          },
        },
      },
      orderBy: { created_at: "asc" },
    }),
    prisma.flagged_messages.count({ where: { request_id: id } }),
    prisma.chat_access_log.findMany({
      where: { request_id: id },
      include: {
        users: { select: { email: true, display_name: true } },
      },
      orderBy: { opened_at: "desc" },
      take: 10,
    }),
    (async () => {
      const ids = await prisma.messages.findMany({
        where: { request_id: id },
        select: { id: true },
      });
      const removed = await Promise.all(
        ids.map(async (m) => ((await isMessageRemoved(m.id)) ? m.id.toString() : null))
      );
      return new Set(removed.filter(Boolean) as string[]);
    })(),
  ]);

  const sender = match.users_match_requests_sender_idTousers;
  const receiver = match.users_match_requests_receiver_idTousers;
  const family = await loadFamilyStatus(id).catch(() => null);
  const isTestMatch = isTestAccountEmail(sender?.email) && isTestAccountEmail(receiver?.email);
  const familyStage = !family
    ? "—"
    : family.wali_contact_confirmed_at
      ? "Wali contacted"
      : family.wali_details_shared_at
        ? "Wali details shared"
        : family.family_request_state === "pending"
          ? "Requested — waiting for her"
          : family.family_request_state === "declined"
            ? "She said not now"
            : "Not started";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/chats" className="text-sm text-muted-foreground hover:text-primary">
          ← Chats
        </Link>
        <h2 className="mt-2 font-heading text-3xl font-medium tracking-tight">
          Conversation #{match.id.toString()}
        </h2>
        <p className="text-sm text-muted-foreground">
          Read-only moderation view · {messages.length} messages · {flaggedCount} flagged
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sender</p>
            <p className="mt-1 font-medium">{participantLabel(sender)}</p>
            <p className="text-sm text-muted-foreground">{sender.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Plan: {(sender.plan || "basic").toLowerCase()}</p>
            <div className="mt-2 flex gap-3 text-sm">
              <Link href={`/users/${sender.id}`} className="text-primary hover:underline">
                User
              </Link>
              {sender.profiles?.id ? (
                <Link href={`/profiles/${sender.profiles.id}`} className="text-primary hover:underline">
                  Profile
                </Link>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Receiver</p>
            <p className="mt-1 font-medium">{participantLabel(receiver)}</p>
            <p className="text-sm text-muted-foreground">{receiver.email}</p>
            <p className="text-xs text-muted-foreground mt-1">Plan: {(receiver.plan || "basic").toLowerCase()}</p>
            <div className="mt-2 flex gap-3 text-sm">
              <Link href={`/users/${receiver.id}`} className="text-primary hover:underline">
                User
              </Link>
              {receiver.profiles?.id ? (
                <Link href={`/profiles/${receiver.profiles.id}`} className="text-primary hover:underline">
                  Profile
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge value={match.status} />
        <span className="text-muted-foreground">Created {fmtDate(match.created_at)}</span>
        <span className="text-muted-foreground">Updated {fmtDate(match.updated_at)}</span>
        {match.ended_at ? (
          <span className="text-muted-foreground">
            Ended {fmtDate(match.ended_at)}
            {match.end_reason ? ` · ${match.end_reason}` : ""}
          </span>
        ) : null}
        {match.status === "accepted" ? (
          <form action={endMatch}>
            <input type="hidden" name="request_id" value={match.id.toString()} />
            <Button type="submit" variant="destructive" size="sm">
              End match
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Involve Family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            <span>
              Stage: <span className="font-medium text-foreground">{familyStage}</span>
            </span>
            {family?.family_requested_at ? <span>Requested {fmtDate(family.family_requested_at)}</span> : null}
            {family?.family_declined_at ? <span>Declined {fmtDate(family.family_declined_at)}</span> : null}
            {family?.wali_details_shared_at ? <span>Shared {fmtDate(family.wali_details_shared_at)}</span> : null}
            {family?.wali_contact_confirmed_at ? (
              <span>Contact confirmed {fmtDate(family.wali_contact_confirmed_at)}</span>
            ) : null}
            <span>
              Automatic reminder:{" "}
              {family?.family_auto_cancelled_at
                ? "stopped"
                : family?.family_auto_eligible_at
                  ? `shown since ${fmtDate(family.family_auto_eligible_at)}`
                  : family?.family_force_eligible
                    ? "forced — shows when a member next opens the chat"
                    : "not yet eligible"}
            </span>
          </div>
          {isTestMatch ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">QA tools</span>
              {match.status === "accepted" ? (
                <form action={forceFamilyEligible}>
                  <input type="hidden" name="request_id" value={match.id.toString()} />
                  <Button type="submit" variant="outline" size="sm">
                    Force automatic reminder
                  </Button>
                </form>
              ) : null}
              <form action={resetFamilyFlow}>
                <input type="hidden" name="request_id" value={match.id.toString()} />
                <Button type="submit" variant="outline" size="sm">
                  Reset Family Flow
                </Button>
              </form>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              QA tools (force the automatic reminder, reset the flow) appear only when both members are test
              accounts.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-4 py-3 font-medium">Messages</div>
        <div className="divide-y divide-border/60 max-h-[60vh] overflow-y-auto">
          {messages.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No messages in this thread.</p>
          ) : (
            messages.map((m) => {
              const fromSender = m.sender_id === sender.id;
              const senderLabel =
                m.users_messages_sender_idTousers.profiles?.profile_code ||
                m.users_messages_sender_idTousers.profiles?.full_name ||
                m.users_messages_sender_idTousers.email;
              const removed = removedIds.has(m.id.toString());

              return (
                <div
                  key={m.id.toString()}
                  className={`px-4 py-3 text-sm ${m.is_flagged ? "bg-amber-50/80" : ""} ${removed ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{senderLabel}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</span>
                    {removed ? (
                      <span className="text-xs font-medium text-rose-700">removed by moderation</span>
                    ) : null}
                    {m.is_read ? (
                      <span className="text-xs text-muted-foreground">read</span>
                    ) : (
                      <span className="text-xs text-amber-700">unread</span>
                    )}
                    {m.is_flagged ? (
                      <span className="text-xs font-medium text-amber-800">flagged</span>
                    ) : null}
                    {m.message_type !== "text" ? (
                      <span className="text-xs text-muted-foreground">{m.message_type}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {removed ? "[Message removed by moderation]" : m.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {fromSender ? "→ receiver" : "← sender"} · msg #{m.id.toString()}
                  </p>
                  {!removed ? (
                    <form action={removeMessage} className="mt-2">
                      <input type="hidden" name="message_id" value={m.id.toString()} />
                      <input type="hidden" name="request_id" value={match.id.toString()} />
                      <Button type="submit" variant="outline" size="sm">
                        Remove message
                      </Button>
                    </form>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin access log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {accessLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior admin opens recorded.</p>
          ) : (
            accessLog.map((entry) => (
              <div key={entry.id.toString()} className="flex gap-3 text-sm border-b border-border/60 pb-2">
                <span className="font-medium shrink-0">
                  {entry.users.display_name || entry.users.email}
                </span>
                <span className="text-muted-foreground flex-1">{entry.users.email}</span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(entry.opened_at)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
