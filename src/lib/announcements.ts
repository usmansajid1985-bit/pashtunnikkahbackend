import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * N52 Announcements — admin side. The member app renders these (web/src/lib/announcements*.ts):
 * a card in Notifications → Announcements and one full page per announcement at
 * /announcements/<slug>. Content is stored as typed blocks (JSON), never HTML. Keep the block and
 * category shapes in sync with web/src/lib/announcements-shared.ts.
 */

export const CATEGORIES = [
  { value: "product_update", label: "Product Update" },
  { value: "community", label: "Community" },
  { value: "safety", label: "Safety" },
  { value: "important", label: "Important" },
] as const;

export const SUGGESTED_EMOJIS = ["📢", "🎉", "👨‍👩‍👧", "🛡️", "⚙️", "✨", "💍", "🔒", "💬", "❤️", "🌙", "📸", "⚡", "🔍", "🤲", "📅"];

let ensured = false;

/** Same idempotent DDL as the member app, so whichever deploys first sets the columns up. */
export async function ensureAnnouncementsSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'general',
        ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS gold_only BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS slug VARCHAR(160),
        ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(16) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS page_title VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS closing TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS sign_off VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS preview_token VARCHAR(64),
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        user_id BIGINT NOT NULL,
        announcement_id BIGINT NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, announcement_id)
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS announcements_slug_key ON announcements (slug) WHERE slug IS NOT NULL`
    );
    await prisma.$executeRawUnsafe(`
      UPDATE announcements
         SET slug = trim(both '-' from regexp_replace(lower(coalesce(nullif(title, ''), 'announcement')), '[^a-z0-9]+', '-', 'g')) || '-' || id
       WHERE slug IS NULL
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureAnnouncementsSchema", err);
  }
}

export type AnnouncementRow = {
  id: bigint;
  slug: string;
  title: string;
  summary: string;
  body: string;
  icon_emoji: string;
  image_url: string;
  category: string;
  pinned: boolean;
  status: string;
  publish_at: Date | null;
  archived_at: Date | null;
  sort_order: number;
  page_title: string;
  subtitle: string;
  cover_url: string;
  content: unknown;
  closing: string;
  sign_off: string;
  preview_token: string | null;
  created_at: Date;
  updated_at: Date;
};

const COLS = `id, slug, title, summary, body, icon_emoji, image_url, category, pinned, status, publish_at,
  archived_at, sort_order, page_title, subtitle, cover_url, content, closing, sign_off, preview_token,
  created_at, updated_at`;

export async function listAnnouncements() {
  await ensureAnnouncementsSchema();
  const [rows, reads] = await Promise.all([
    prisma.$queryRawUnsafe<AnnouncementRow[]>(
      `SELECT ${COLS} FROM announcements ORDER BY (archived_at IS NOT NULL), pinned DESC, sort_order ASC, COALESCE(publish_at, updated_at) DESC LIMIT 200`
    ),
    prisma
      .$queryRawUnsafe<{ announcement_id: bigint; n: bigint }[]>(
        `SELECT announcement_id, count(*) n FROM announcement_reads GROUP BY announcement_id`
      )
      .catch(() => []),
  ]);
  const readCount = new Map(reads.map((r) => [r.announcement_id.toString(), Number(r.n)]));
  return rows.map((r) => ({ ...r, reads: readCount.get(r.id.toString()) ?? 0 }));
}

export async function getAnnouncement(id: bigint) {
  await ensureAnnouncementsSchema();
  const rows = await prisma.$queryRawUnsafe<AnnouncementRow[]>(`SELECT ${COLS} FROM announcements WHERE id = $1`, id);
  return rows[0] ?? null;
}

/** draft | scheduled | published | unpublished | archived — what the admin list shows. */
export function displayStatus(r: Pick<AnnouncementRow, "status" | "publish_at" | "archived_at">) {
  if (r.archived_at) return "archived";
  if (r.status === "published") return r.publish_at && r.publish_at.getTime() > Date.now() ? "scheduled" : "published";
  return r.status === "unpublished" ? "unpublished" : "draft";
}

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "announcement"
  );
}

/** A slug no other announcement uses (adds -2, -3… when needed). */
export async function uniqueSlug(base: string, exceptId: bigint | null) {
  const root = slugify(base);
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const rows = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `SELECT id FROM announcements WHERE slug = $1 AND ($2::bigint IS NULL OR id <> $2::bigint) LIMIT 1`,
      candidate,
      exceptId
    );
    if (rows.length === 0) return candidate;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

export function newPreviewToken() {
  return randomBytes(18).toString("hex");
}

/* ───────────────────────────── images (Supabase Storage) ───────────────────────────── */

const BUCKET = process.env.SUPABASE_ANNOUNCEMENTS_BUCKET || "announcements";
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type ImageKind = "cover" | "thumbnail" | "inline";
export type CropAspect = "original" | "16:9" | "4:3" | "1:1";
export type CropFocus = "centre" | "top" | "bottom";

function storageEnv() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Image storage isn't configured (Supabase URL / service key missing).");
  return { base, key };
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { base, key } = storageEnv();
  const headers = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
  const got = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, { headers, cache: "no-store" });
  if (!got.ok) {
    // Public: announcement images are shown to every member and on the open preview link.
    await fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: IMAGE_MAX_BYTES }),
    });
  }
  bucketReady = true;
}

/**
 * Crop to the chosen shape and save a web-optimised WebP (1600px wide for covers / inline images,
 * 256px square-ish for card thumbnails). Returns the public URL.
 */
export async function uploadAnnouncementImage(
  file: File,
  opts: { kind: ImageKind; aspect: CropAspect; focus: CropFocus }
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (JPG, PNG or WEBP).");
  if (file.size > IMAGE_MAX_BYTES) throw new Error("That image is too large — please use one under 8MB.");
  const input = Buffer.from(await file.arrayBuffer());

  const { default: sharp } = await import("sharp");
  const width = opts.kind === "thumbnail" ? 256 : 1600;
  const ratio = opts.kind === "thumbnail" ? 1 : opts.aspect === "16:9" ? 16 / 9 : opts.aspect === "4:3" ? 4 / 3 : opts.aspect === "1:1" ? 1 : 0;
  const position = opts.focus === "top" ? "top" : opts.focus === "bottom" ? "bottom" : "centre";
  let img = sharp(input, { failOn: "none" }).rotate();
  img = ratio
    ? img.resize({ width, height: Math.round(width / ratio), fit: "cover", position, withoutEnlargement: false })
    : img.resize({ width, withoutEnlargement: true });
  const out = await img.webp({ quality: 80 }).toBuffer();

  await ensureBucket();
  const { base, key } = storageEnv();
  const objectPath = `${opts.kind}/${Date.now()}-${randomBytes(5).toString("hex")}.webp`;
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "image/webp", "x-upsert": "false" },
    body: new Uint8Array(out),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}). ${await res.text().catch(() => "")}`.trim());
  return `${base}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

/** Best-effort removal of an image this bucket owns (replaced or removed in the editor). */
export async function deleteAnnouncementImage(url: string) {
  try {
    const { base, key } = storageEnv();
    const m = url.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`));
    if (!m) return;
    await fetch(`${base}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [decodeURIComponent(m[1])] }),
    });
  } catch {
    /* ignore — an orphaned image is harmless */
  }
}

export function webOrigin() {
  return (process.env.WEB_PUBLIC_URL || "http://localhost:3001").replace(/\/$/, "");
}
