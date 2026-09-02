import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { fmtDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const rows = await prisma.notifications.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
    include: {
      users: { select: { email: true, display_name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl font-medium">Push / notification log</h2>
        <p className="text-sm text-muted-foreground">Recent notification rows written by the member app.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest 100</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No notifications yet.</p>
          ) : (
            rows.map((n) => (
              <div key={n.id.toString()} className="py-3 text-sm">
                <p className="font-medium">{n.title}</p>
                <p className="text-muted-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {n.users?.display_name || n.users?.email} · {n.type} · {fmtDate(n.created_at)}
                  {n.read_at ? " · read" : " · unread"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
