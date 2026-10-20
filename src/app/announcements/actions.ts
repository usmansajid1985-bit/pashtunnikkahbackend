"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import {
  CATEGORIES,
  deleteAnnouncementImage,
  ensureAnnouncementsSchema,
  getAnnouncement,
  newPreviewToken,
  uniqueSlug,
  uploadAnnouncementImage,
  type CropAspect,
  type CropFocus,
  type ImageKind,
} from "@/lib/announcements";

async function assertAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
}

export type AnnouncementDraft = {
  id: string | null;
  // Card (Notifications → Announcements)
  title: string;
  summary: string;
  emoji: string;
  thumbnailUrl: string;
  category: string;
  pinned: boolean;
  sortOrder: number;
  // Full page
  pageTitle: string;
  subtitle: string;
  coverUrl: string;
  blocks: unknown[];
  closing: string;
  signOff: string;
  slug: string;
};

export type SaveIntent = "draft" | "publish" | "schedule" | "unpublish";

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * Create or update one announcement — always the same row for the same id, so editing never
 * creates duplicates. `publish` goes live now, `schedule` goes live at `publishAt`, `draft` keeps
 * the current live state for a published one only when unchanged (an edit to a live announcement
 * stays live), `unpublish` takes it down.
 */
export async function saveAnnouncementDraft(
  draft: AnnouncementDraft,
  intent: SaveIntent,
  publishAtIso?: string | null
): Promise<{ ok: true; id: string; slug: string; previewToken: string } | { ok: false; error: string }> {
  await assertAdmin();
  await ensureAnnouncementsSchema();

  const title = clip(draft.title, 255);
  if (!title) return { ok: false, error: "Add a card title." };
  const category = CATEGORIES.some((c) => c.value === draft.category) ? draft.category : "community";
  const blocks = Array.isArray(draft.blocks) ? draft.blocks.slice(0, 200) : [];
  const id = draft.id ? BigInt(draft.id) : null;
  const existing = id ? await getAnnouncement(id) : null;
  if (id && !existing) return { ok: false, error: "This announcement no longer exists." };

  let status = existing?.status ?? "draft";
  let publishAt: Date | null = existing?.publish_at ?? null;
  if (intent === "publish") {
    status = "published";
    // Re-publishing keeps the original date; a first publish (or an overdue schedule) is "now".
    publishAt = existing?.status === "published" && existing.publish_at && existing.publish_at <= new Date() ? existing.publish_at : new Date();
  } else if (intent === "schedule") {
    const at = publishAtIso ? new Date(publishAtIso) : null;
    if (!at || Number.isNaN(at.getTime())) return { ok: false, error: "Choose a date and time to schedule it." };
    if (at.getTime() <= Date.now() + 60_000) return { ok: false, error: "Pick a time in the future (or use Publish now)." };
    status = "published";
    publishAt = at;
  } else if (intent === "unpublish") {
    status = "unpublished";
  } else if (!existing) {
    status = "draft";
  }

  const slug = await uniqueSlug(clip(draft.slug, 120) || title, id);
  const previewToken = existing?.preview_token || newPreviewToken();
  const values = [
    title,
    clip(draft.summary, 400),
    clip(draft.emoji, 16) || "📢",
    clip(draft.thumbnailUrl, 500),
    category,
    Boolean(draft.pinned),
    Number.isFinite(draft.sortOrder) ? Math.max(-9999, Math.min(9999, Math.round(draft.sortOrder))) : 0,
    clip(draft.pageTitle, 255),
    clip(draft.subtitle, 255),
    clip(draft.coverUrl, 500),
    JSON.stringify(blocks),
    clip(draft.closing, 4000),
    clip(draft.signOff, 255),
    slug,
    status,
    publishAt,
    previewToken,
  ];

  let savedId: bigint;
  if (existing && id) {
    await prisma.$executeRawUnsafe(
      `UPDATE announcements SET
         title = $1, summary = $2, icon_emoji = $3, image_url = $4, category = $5, pinned = $6, sort_order = $7,
         page_title = $8, subtitle = $9, cover_url = $10, content = $11::jsonb, closing = $12, sign_off = $13,
         slug = $14, status = $15, publish_at = $16, preview_token = $17,
         body = $2, type = 'announcement', updated_at = NOW()
       WHERE id = $18`,
      ...values,
      id
    );
    savedId = id;
  } else {
    const max = await prisma.announcements.aggregate({ _max: { id: true } });
    savedId = (max._max.id ?? BigInt(0)) + BigInt(1);
    await prisma.$executeRawUnsafe(
      `INSERT INTO announcements
         (id, title, summary, icon_emoji, image_url, category, pinned, sort_order, page_title, subtitle, cover_url,
          content, closing, sign_off, slug, status, publish_at, preview_token, body, type, created_at, updated_at)
       VALUES ($18, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $2,
               'announcement', NOW(), NOW())`,
      ...values,
      savedId
    );
  }

  revalidatePath("/announcements");
  return { ok: true, id: savedId.toString(), slug, previewToken };
}

/** Quick actions from the list: publish / unpublish / archive / restore / pin / unpin. */
export async function setAnnouncementState(formData: FormData) {
  await assertAdmin();
  await ensureAnnouncementsSchema();
  const id = BigInt(String(formData.get("id") || "0"));
  const action = String(formData.get("action") || "");
  const sql: Record<string, string> = {
    publish: `UPDATE announcements SET status = 'published', archived_at = NULL,
                publish_at = CASE WHEN publish_at IS NULL OR status <> 'published' THEN NOW() ELSE publish_at END,
                updated_at = NOW() WHERE id = $1`,
    unpublish: `UPDATE announcements SET status = 'unpublished', updated_at = NOW() WHERE id = $1`,
    archive: `UPDATE announcements SET archived_at = NOW(), pinned = FALSE, updated_at = NOW() WHERE id = $1`,
    restore: `UPDATE announcements SET archived_at = NULL, status = 'draft', updated_at = NOW() WHERE id = $1`,
    pin: `UPDATE announcements SET pinned = TRUE, updated_at = NOW() WHERE id = $1`,
    unpin: `UPDATE announcements SET pinned = FALSE, updated_at = NOW() WHERE id = $1`,
  };
  if (!sql[action]) return;
  await prisma.$executeRawUnsafe(sql[action], id);
  revalidatePath("/announcements");
}

/** Upload (or replace) an image: cropped + optimised, stored in Supabase Storage. */
export async function uploadAnnouncementImageAction(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await assertAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  const kind = (["cover", "thumbnail", "inline"].includes(String(formData.get("kind"))) ? formData.get("kind") : "inline") as ImageKind;
  const aspect = (["original", "16:9", "4:3", "1:1"].includes(String(formData.get("aspect"))) ? formData.get("aspect") : "original") as CropAspect;
  const focus = (["centre", "top", "bottom"].includes(String(formData.get("focus"))) ? formData.get("focus") : "centre") as CropFocus;
  try {
    const url = await uploadAnnouncementImage(file, { kind, aspect, focus });
    const replaced = String(formData.get("replace") || "");
    if (replaced) await deleteAnnouncementImage(replaced);
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function removeAnnouncementImageAction(url: string) {
  await assertAdmin();
  await deleteAnnouncementImage(url);
}
