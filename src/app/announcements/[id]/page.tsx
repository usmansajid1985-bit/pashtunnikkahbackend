import Link from "next/link";
import { notFound } from "next/navigation";
import { displayStatus, getAnnouncement, webOrigin } from "@/lib/announcements";
import { AnnouncementEditor } from "../announcement-editor";

export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const r = await getAnnouncement(BigInt(id));
  if (!r) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/announcements" className="text-sm text-muted-foreground hover:underline">
          ← All announcements
        </Link>
        <h2 className="mt-1 font-heading text-3xl font-medium tracking-tight">Edit announcement</h2>
      </div>
      <AnnouncementEditor
        webOrigin={webOrigin()}
        initial={{
          id: r.id.toString(),
          title: r.title,
          summary: r.summary || r.body,
          emoji: r.icon_emoji || "📢",
          thumbnailUrl: r.image_url,
          category: ["product_update", "community", "safety", "important"].includes(r.category) ? r.category : "community",
          pinned: r.pinned,
          sortOrder: r.sort_order,
          pageTitle: r.page_title,
          subtitle: r.subtitle,
          coverUrl: r.cover_url,
          // Older announcements had only a plain body — start their page from it.
          blocks:
            Array.isArray(r.content) && r.content.length > 0
              ? (r.content as unknown[])
              : r.body
                ? r.body.split(/\n{2,}/).map((text) => ({ type: "paragraph", text }))
                : [],
          closing: r.closing,
          signOff: r.sign_off,
          slug: r.slug,
          status: displayStatus(r),
          publishAt: r.publish_at?.toISOString() ?? null,
          previewToken: r.preview_token,
        }}
      />
    </div>
  );
}
