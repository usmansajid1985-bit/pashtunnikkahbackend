import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, pageCount } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/pagination-bar";
import { ensureChatAccessLogSchema } from "@/lib/ensure-chat-access-log";
import { Card } from "@/components/ui/card";
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
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

type LastMessageRow = {
  request_id: bigint;
  body: string;
  created_at: Date;
};

function truncate(text: string, max = 72) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; code?: string; request?: string; filter?: string }>;
}) {
  await ensureChatAccessLogSchema();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const status = sp.status?.trim() || "";
  const profileCode = sp.code?.trim() || "";
  const requestIdRaw = sp.request?.trim() || "";
  const filter = sp.filter?.trim() || "";

  const where: Prisma.match_requestsWhereInput = {
    messages: { some: {} },
  };

  if (status) where.status = status;
  if (filter === "accepted") where.status = "accepted";

  if (requestIdRaw && /^\d+$/.test(requestIdRaw)) {
    where.id = BigInt(requestIdRaw);
  }

  if (profileCode) {
    const profiles = await prisma.profiles.findMany({
      where: { profile_code: { contains: profileCode, mode: "insensitive" } },
      select: { user_id: true },
    });
    const userIds = profiles.map((p) => p.user_id);
    where.OR =
      userIds.length > 0
        ? [{ sender_id: { in: userIds } }, { receiver_id: { in: userIds } }]
        : [{ id: BigInt(-1) }];
  }

  if (filter === "reported") {
    const [flaggedRows, flaggedMessages] = await Promise.all([
      prisma.flagged_messages.findMany({ select: { request_id: true }, distinct: ["request_id"] }),
      prisma.messages.findMany({
        where: { is_flagged: true },
        select: { request_id: true },
        distinct: ["request_id"],
      }),
    ]);
    const reportedIds = [
      ...new Set([
        ...flaggedRows.map((r) => r.request_id),
        ...flaggedMessages.map((m) => m.request_id),
      ]),
    ];
    where.id = reportedIds.length ? { in: reportedIds } : BigInt(-1);
  }

  const orderBy: Prisma.match_requestsOrderByWithRelationInput =
    filter === "recent" ? { updated_at: "desc" } : { updated_at: "desc" };

  const [total, requests] = await Promise.all([
    prisma.match_requests.count({ where }),
    prisma.match_requests.findMany({
      where,
      include: {
        users_match_requests_sender_idTousers: {
          select: {
            id: true,
            email: true,
            plan: true,
            profiles: { select: { profile_code: true, full_name: true } },
          },
        },
        users_match_requests_receiver_idTousers: {
          select: {
            id: true,
            email: true,
            plan: true,
            profiles: { select: { profile_code: true, full_name: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const ids = requests.map((r) => r.id);
  const lastByRequest = new Map<string, LastMessageRow>();
  const flaggedByRequest = new Map<string, number>();

  if (ids.length) {
    const [lastRows, flaggedCounts] = await Promise.all([
      prisma.$queryRaw<LastMessageRow[]>`
        SELECT DISTINCT ON (request_id) request_id, body, created_at
        FROM messages
        WHERE request_id = ANY(${ids}::bigint[])
        ORDER BY request_id, created_at DESC
      `,
      prisma.flagged_messages.groupBy({
        by: ["request_id"],
        where: { request_id: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    for (const row of lastRows) {
      lastByRequest.set(row.request_id.toString(), row);
    }
    for (const row of flaggedCounts) {
      flaggedByRequest.set(row.request_id.toString(), row._count._all);
    }
  }

  const totalPages = pageCount(total, PAGE_SIZE);
  const listParams = {
    status: status || undefined,
    code: profileCode || undefined,
    request: requestIdRaw || undefined,
    filter: filter || undefined,
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Chats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only member conversations for moderation. Every open is logged.
        </p>
      </div>

      <Card className="p-4">
        <form className="flex flex-wrap gap-3 items-end" method="get">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Profile code</span>
            <Input name="code" defaultValue={profileCode} placeholder="PNM576" className="w-36" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Request ID</span>
            <Input name="request" defaultValue={requestIdRaw} placeholder="12345" className="w-32" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="accepted">accepted</option>
              <option value="pending">pending</option>
              <option value="declined">declined</option>
              <option value="expired">expired</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">Quick filter</span>
            <select
              name="filter"
              defaultValue={filter}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All with messages</option>
              <option value="accepted">Accepted only</option>
              <option value="reported">Flagged / reported</option>
              <option value="recent">Recent activity</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
          {(profileCode || requestIdRaw || status || filter) && (
            <Link href="/chats" className="text-sm text-muted-foreground hover:text-primary pb-2">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Flagged</TableHead>
              <TableHead>Last message</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No conversations match these filters.
                </TableCell>
              </TableRow>
            )}
            {requests.map((r) => {
              const sender = r.users_match_requests_sender_idTousers;
              const receiver = r.users_match_requests_receiver_idTousers;
              const last = lastByRequest.get(r.id.toString());
              const flaggedCount = flaggedByRequest.get(r.id.toString()) ?? 0;
              const senderCode = sender.profiles?.profile_code || sender.email;
              const receiverCode = receiver.profiles?.profile_code || receiver.email;

              return (
                <TableRow key={r.id.toString()}>
                  <TableCell className="tabular-nums font-medium">{r.id.toString()}</TableCell>
                  <TableCell>
                    <Link href={`/users/${sender.id}`} className="text-primary hover:underline">
                      {senderCode}
                    </Link>
                    <p className="text-xs text-muted-foreground">{(sender.plan || "basic").toLowerCase()}</p>
                  </TableCell>
                  <TableCell>
                    <Link href={`/users/${receiver.id}`} className="text-primary hover:underline">
                      {receiverCode}
                    </Link>
                    <p className="text-xs text-muted-foreground">{(receiver.plan || "basic").toLowerCase()}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={r.status} />
                  </TableCell>
                  <TableCell>{r._count.messages}</TableCell>
                  <TableCell>{flaggedCount > 0 ? flaggedCount : "—"}</TableCell>
                  <TableCell className="max-w-[220px]">
                    {last ? (
                      <>
                        <p className="truncate text-sm">{truncate(last.body)}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(last.created_at)}</p>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(r.updated_at)}</TableCell>
                  <TableCell>
                    <Link href={`/chats/${r.id}`} className="text-sm text-primary hover:underline">
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <PaginationBar page={page} totalPages={totalPages} total={total} basePath="/chats" searchParams={listParams} />
    </div>
  );
}
