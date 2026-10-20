import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CATEGORIES, displayStatus, listAnnouncements, webOrigin } from "@/lib/announcements";
import { setAnnouncementState } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  draft: "bg-neutral-50 text-neutral-600 border-neutral-200",
  unpublished: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

function QuickAction({ id, action, label, variant = "outline" }: { id: string; action: string; label: string; variant?: "outline" | "ghost" | "secondary" }) {
  return (
    <form action={setAnnouncementState}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

/** N52: every announcement — card + its own full page — managed here. */
export default async function AnnouncementsPage() {
  const rows = await listAnnouncements();
  const origin = webOrigin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl font-medium tracking-tight">Announcements</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each announcement has a card in Notifications → Announcements and its own full page. Members see only published ones.
          </p>
        </div>
        <Link href="/announcements/new">
          <Button>New announcement</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2.5">Announcement</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Publish date</th>
                <th className="px-3 py-2.5 text-right">Reads</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = r.id.toString();
                const st = displayStatus(r);
                const live = st === "published";
                const url = `${origin}/announcements/${encodeURIComponent(r.slug)}${live ? "" : `?preview=${r.preview_token ?? ""}`}`;
                return (
                  <tr key={id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2.5">
                        {r.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center text-lg shrink-0">{r.icon_emoji || "📢"}</span>
                        )}
                        <div className="min-w-0">
                          <Link href={`/announcements/${id}`} className="font-medium hover:underline">
                            {r.title || "(untitled)"}
                          </Link>
                          {r.pinned ? <span className="ml-2 text-[10px] font-semibold uppercase text-rose-600">Pinned</span> : null}
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">{r.summary || r.body}</p>
                          <p className="text-[11px] text-muted-foreground/80">/announcements/{r.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[st]}`}>{st}</span>
                    </td>
                    <td className="px-3 py-3 text-xs">{CATEGORIES.find((c) => c.value === r.category)?.label ?? "Community"}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">{r.publish_at ? fmtDate(r.publish_at) : "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.reads}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Link href={`/announcements/${id}`}>
                          <Button size="sm">Edit</Button>
                        </Link>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">{live ? "View" : "Preview"}</Button>
                        </a>
                        {st === "archived" ? (
                          <QuickAction id={id} action="restore" label="Restore" />
                        ) : (
                          <>
                            {st === "published" || st === "scheduled" ? (
                              <QuickAction id={id} action="unpublish" label="Unpublish" />
                            ) : (
                              <QuickAction id={id} action="publish" label="Publish now" variant="secondary" />
                            )}
                            <QuickAction id={id} action={r.pinned ? "unpin" : "pin"} label={r.pinned ? "Unpin" : "Pin"} variant="ghost" />
                            <QuickAction id={id} action="archive" label="Archive" variant="ghost" />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
