import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, pageCount } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/pagination-bar";
import { toggleUserBlock } from "@/app/profiles/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { display_name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [total, users] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      include: {
        profiles: {
          select: {
            id: true,
            profile_code: true,
            status: true,
            gender: true,
            full_name: true,
            age: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: { registered_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = pageCount(total, PAGE_SIZE);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl font-medium tracking-tight">Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts with linked profile age, city, gender and plan.
          </p>
        </div>
        <form className="flex w-full sm:w-auto gap-2">
          <Input name="q" defaultValue={q} placeholder="Search email or name" className="sm:w-64" />
          <Button type="submit">Search</Button>
        </form>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {users.map((u) => (
          <div key={u.id.toString()}>
            <Link href={`/users/${u.id}`}>
              <Card className="transition hover:ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base truncate">{u.email}</CardTitle>
                  <p className="text-xs text-muted-foreground">#{u.id.toString()} · {u.role}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    {u.profiles?.status && <StatusBadge value={u.profiles.status} />}
                    <span className="text-muted-foreground">{u.plan || "free"}</span>
                  </div>
                  <p>
                    {u.profiles?.full_name || "—"}
                    {u.profiles?.age != null ? ` · ${u.profiles.age} yrs` : ""}
                    {u.profiles?.gender ? ` · ${u.profiles.gender}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {u.profiles?.city || u.profiles?.country || "No location"} · {fmtDate(u.registered_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
            <div className="mt-2 flex items-center gap-3 px-1">
              {u.profiles ? (
                <Link href={`/profiles/${u.profiles.id}`} className="text-xs text-primary hover:underline">
                  Full profile
                </Link>
              ) : null}
              <form action={toggleUserBlock} className="ml-auto">
                <input type="hidden" name="id" value={u.id.toString()} />
                <Button
                  type="submit"
                  size="xs"
                  variant={u.account_status === "suspended" ? "secondary" : "destructive"}
                >
                  {u.account_status === "suspended" ? "Unblock" : "Block"}
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <Card className="hidden md:block overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name / age</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id.toString()}>
                <TableCell className="tabular-nums">
                  <Link href={`/users/${u.id}`} className="text-primary hover:underline">
                    {u.id.toString()}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/users/${u.id}`} className="hover:underline font-medium">
                    {u.email}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>{u.profiles?.full_name || u.display_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.profiles?.age != null ? `${u.profiles.age} yrs` : "—"}
                    {u.profiles?.profile_code ? ` · ${u.profiles.profile_code}` : ""}
                  </div>
                </TableCell>
                <TableCell>{u.profiles?.gender || "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate">
                  {u.profiles?.city || u.profiles?.country || "—"}
                </TableCell>
                <TableCell>{u.plan || "free"}</TableCell>
                <TableCell>
                  {u.profiles ? <StatusBadge value={u.profiles.status} /> : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtDate(u.registered_at)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {u.profiles ? (
                      <Link href={`/profiles/${u.profiles.id}`} className="text-xs text-primary hover:underline">
                        Full profile
                      </Link>
                    ) : null}
                    <form action={toggleUserBlock}>
                      <input type="hidden" name="id" value={u.id.toString()} />
                      <Button
                        type="submit"
                        size="xs"
                        variant={u.account_status === "suspended" ? "secondary" : "destructive"}
                      >
                        {u.account_status === "suspended" ? "Unblock" : "Block"}
                      </Button>
                    </form>
                  </div>
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
        basePath="/users"
        searchParams={{ q: q || undefined }}
      />
    </div>
  );
}
