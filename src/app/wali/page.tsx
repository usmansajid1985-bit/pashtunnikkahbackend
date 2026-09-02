import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { fmtDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function WaliOversightPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const links = await prisma.wali_links.findMany({
    orderBy: { created_at: "desc" },
    take: 50,
    include: {
      users: {
        select: {
          email: true,
          profiles: { select: { profile_code: true }, take: 1 },
        },
      },
    },
  });

  const handovers = await prisma.match_requests.findMany({
    where: { wali_handover_status: { not: null } },
    orderBy: { updated_at: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      wali_handover_status: true,
      wali_details_shared_at: true,
      updated_at: true,
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium">Wali oversight</h2>
        <p className="text-sm text-muted-foreground">Wali links and active handover statuses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wali links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wali links.</p>
          ) : (
            links.map((l) => (
              <div key={l.id.toString()} className="flex justify-between gap-3 text-sm border-b pb-2">
                <span>
                  {l.users.profiles?.[0]?.profile_code || l.users.email} · {l.name || "Wali"}
                </span>
                <span className="text-muted-foreground">{fmtDate(l.created_at)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Handover statuses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {handovers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No handovers.</p>
          ) : (
            handovers.map((h) => (
              <div key={h.id.toString()} className="flex justify-between gap-3 text-sm border-b pb-2">
                <Link href={`/chats/${h.id}`} className="text-primary hover:underline">
                  Request #{h.id.toString()}
                </Link>
                <span className="text-muted-foreground">
                  {h.wali_handover_status} · {fmtDate(h.updated_at)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
