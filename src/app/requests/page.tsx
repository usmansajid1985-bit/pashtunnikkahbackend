import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, pageCount } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/pagination-bar";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const status = sp.status?.trim() || "";
  const where = status ? { status } : undefined;

  const [total, requests] = await Promise.all([
    prisma.match_requests.count({ where }),
    prisma.match_requests.findMany({
      where,
      include: {
        users_match_requests_sender_idTousers: { select: { email: true, id: true } },
        users_match_requests_receiver_idTousers: { select: { email: true, id: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = pageCount(total, PAGE_SIZE);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Match requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">Connection requests with message counts.</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id.toString()}>
                <TableCell className="tabular-nums">{r.id.toString()}</TableCell>
                <TableCell>
                  <Link href={`/users/${r.sender_id}`} className="text-primary hover:underline">
                    {r.users_match_requests_sender_idTousers.email}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/users/${r.receiver_id}`} className="text-primary hover:underline">
                    {r.users_match_requests_receiver_idTousers.email}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge value={r.status} />
                </TableCell>
                <TableCell>{r._count.messages}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtDate(r.created_at)}
                </TableCell>
                <TableCell>
                  {r._count.messages > 0 ? (
                    <Link href={`/chats/${r.id}`} className="text-sm text-primary hover:underline">
                      Open chat
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
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
        basePath="/requests"
        searchParams={{ status: status || undefined }}
      />
    </div>
  );
}
