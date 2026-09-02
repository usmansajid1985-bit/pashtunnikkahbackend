import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, pageCount } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/pagination-bar";
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
import { bulkApprovePending } from "./actions";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; gender?: string; page?: string }>;
}) {
  const sp = await searchParams;
  // Default queue to pending so ops land on approval work first.
  const status = sp.status === undefined ? "pending" : sp.status.trim();
  const gender = sp.gender?.trim() || "";
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page || 1) || 1);

  const where = {
    AND: [
      status ? { status } : {},
      gender ? { gender } : {},
      q
        ? {
            OR: [
              { full_name: { contains: q, mode: "insensitive" as const } },
              { profile_code: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
              { country: { contains: q, mode: "insensitive" as const } },
              { ethnicity: { contains: q, mode: "insensitive" as const } },
              { occupation: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  const [total, profiles] = await Promise.all([
    prisma.profiles.count({ where }),
    prisma.profiles.findMany({
      where,
      orderBy: { submitted_at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = pageCount(total, PAGE_SIZE);
  const filters = ["", "approved", "rejected", "suspended", "unverified", "pending"];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Profiles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full signup fields: age, height, marital status, city, ethnicity, education, occupation…
        </p>
      </div>

      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input name="q" defaultValue={q} placeholder="Name, code, city, job…" className="lg:col-span-2" />
        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {filters.map((f) => (
            <option key={f || "all"} value={f}>
              {f ? f : "All statuses"}
            </option>
          ))}
        </select>
        <select
          name="gender"
          defaultValue={gender}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">All genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {status === "pending" && profiles.length > 0 ? (
        <form action={bulkApprovePending} className="flex items-center gap-3">
          {profiles.map((p) => (
            <input key={p.id.toString()} type="hidden" name="ids" value={p.id.toString()} />
          ))}
          <Button type="submit" variant="secondary">
            Approve all on this page ({profiles.length})
          </Button>
        </form>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {profiles.map((p) => (
          <Link key={p.id.toString()} href={`/profiles/${p.id}`}>
            <Card className="transition hover:ring-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.full_name || p.profile_code || "Profile"}</CardTitle>
                  <StatusBadge value={p.status} />
                </div>
                <p className="text-xs text-muted-foreground">{p.profile_code} · {p.email}</p>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>
                  {p.gender || "—"} · {p.age != null ? `${p.age} yrs` : "age —"} · {p.height || "height —"}
                </p>
                <p className="text-muted-foreground">
                  {p.marital_status || "—"} · {p.city || p.current_location || p.country || "—"}
                </p>
                <p className="text-muted-foreground truncate">
                  {p.occupation || "—"} · {p.education || "—"} · {p.ethnicity || p.tribe || "—"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="hidden md:block overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Height</TableHead>
              <TableHead>Marital</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Ethnicity</TableHead>
              <TableHead>Education</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id.toString()}>
                <TableCell>
                  <Link href={`/profiles/${p.id}`} className="text-primary hover:underline font-medium">
                    {p.profile_code || `#${p.id}`}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/profiles/${p.id}`} className="hover:underline">
                    {p.full_name || "—"}
                  </Link>
                  <div className="text-xs text-muted-foreground truncate max-w-[160px]">{p.email}</div>
                </TableCell>
                <TableCell className="tabular-nums">{p.age ?? "—"}</TableCell>
                <TableCell>{p.gender || "—"}</TableCell>
                <TableCell className="max-w-[100px] truncate text-xs">{p.height || "—"}</TableCell>
                <TableCell className="max-w-[110px] truncate text-xs">{p.marital_status || "—"}</TableCell>
                <TableCell className="max-w-[140px] truncate">
                  {p.city || p.current_location || p.country || "—"}
                </TableCell>
                <TableCell className="max-w-[110px] truncate text-xs">
                  {p.ethnicity || p.tribe || "—"}
                </TableCell>
                <TableCell className="max-w-[110px] truncate text-xs">{p.education || "—"}</TableCell>
                <TableCell className="max-w-[120px] truncate text-xs">{p.occupation || "—"}</TableCell>
                <TableCell>
                  <StatusBadge value={p.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                  {fmtDate(p.submitted_at)}
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
        basePath="/profiles"
        searchParams={{
          q: q || undefined,
          status: status || undefined,
          gender: gender || undefined,
        }}
      />
    </div>
  );
}
