import Link from "next/link";
import { webOrigin } from "@/lib/announcements";
import { AnnouncementEditor } from "../announcement-editor";

export const dynamic = "force-dynamic";

export default function NewAnnouncementPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/announcements" className="text-sm text-muted-foreground hover:underline">
          ← All announcements
        </Link>
        <h2 className="mt-1 font-heading text-3xl font-medium tracking-tight">New announcement</h2>
      </div>
      <AnnouncementEditor
        webOrigin={webOrigin()}
        initial={{
          id: null,
          title: "",
          summary: "",
          emoji: "📢",
          thumbnailUrl: "",
          category: "product_update",
          pinned: false,
          sortOrder: 0,
          pageTitle: "",
          subtitle: "",
          coverUrl: "",
          blocks: [{ type: "paragraph", text: "" }],
          closing: "",
          signOff: "Mana,\nThe Pashtun Nikah Team",
          slug: "",
          status: "draft",
          publishAt: null,
          previewToken: null,
        }}
      />
    </div>
  );
}
