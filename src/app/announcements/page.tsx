import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { saveAnnouncement } from "@/app/profiles/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const rows = await prisma.announcements.findMany({
    orderBy: { updated_at: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Announcements</h2>
        <p className="mt-1 text-sm text-muted-foreground">Draft and publish member-facing notices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAnnouncement} className="space-y-3">
            <Input name="title" placeholder="Title" required />
            <textarea
              name="body"
              rows={4}
              placeholder="Body"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              required
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="cta_label" placeholder="CTA label (optional)" />
              <Input name="cta_url" placeholder="CTA URL (optional)" />
            </div>
            <label className="text-sm flex items-center gap-2">
              Status
              <select name="status" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.map((a) => (
          <Card key={a.id.toString()}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{a.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{fmtDate(a.updated_at)}</p>
              </div>
              <StatusBadge value={a.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{a.body}</p>
              <form action={saveAnnouncement} className="mt-4 flex flex-wrap gap-2 items-end">
                <input type="hidden" name="id" value={a.id.toString()} />
                <input type="hidden" name="title" value={a.title} />
                <input type="hidden" name="body" value={a.body} />
                <input type="hidden" name="cta_label" value={a.cta_label} />
                <input type="hidden" name="cta_url" value={a.cta_url} />
                {a.status !== "published" ? (
                  <>
                    <input type="hidden" name="status" value="published" />
                    <Button type="submit" size="sm">
                      Publish
                    </Button>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="status" value="draft" />
                    <Button type="submit" size="sm" variant="outline">
                      Unpublish
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
