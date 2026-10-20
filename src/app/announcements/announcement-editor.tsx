"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  removeAnnouncementImageAction,
  saveAnnouncementDraft,
  uploadAnnouncementImageAction,
  type AnnouncementDraft,
  type SaveIntent,
} from "./actions";

/* Keep in sync with web/src/lib/announcements-shared.ts */
type FeatureItem = { emoji: string; title: string; description?: string; url?: string };
type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; url: string; caption?: string }
  | { type: "features"; title?: string; items: FeatureItem[] }
  | { type: "callout"; emoji?: string; title?: string; text: string }
  | { type: "divider" };

const CATEGORY_OPTIONS = [
  { value: "product_update", label: "Product Update" },
  { value: "community", label: "Community" },
  { value: "safety", label: "Safety" },
  { value: "important", label: "Important" },
];
const EMOJIS = ["📢", "🎉", "👨‍👩‍👧", "🛡️", "⚙️", "✨", "💍", "🔒", "💬", "❤️", "🌙", "📸", "⚡", "🔍", "🤲", "📅"];

const textareaCls =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const selectCls = "h-8 rounded-lg border border-input bg-transparent px-2 text-sm";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Shrink very large photos in the browser first — keeps uploads under Vercel's request limit. */
async function downscale(file: File, maxSide = 2400): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Upload / replace / remove one image, with a crop shape and focus. */
function ImageField({
  label,
  kind,
  value,
  onChange,
  defaultAspect = "original",
}: {
  label: string;
  kind: "cover" | "thumbnail" | "inline";
  value: string;
  onChange: (url: string) => void;
  defaultAspect?: "original" | "16:9" | "4:3" | "1:1";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [aspect, setAspect] = useState(defaultAspect);
  const [focus, setFocus] = useState<"centre" | "top" | "bottom">("centre");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", await downscale(file));
    fd.append("kind", kind);
    fd.append("aspect", kind === "thumbnail" ? "1:1" : aspect);
    fd.append("focus", focus);
    if (value) fd.append("replace", value);
    const res = await uploadAnnouncementImageAction(fd).catch(() => ({ ok: false as const, error: "Upload failed." }));
    setBusy(false);
    if (res.ok) onChange(res.url);
    else setError(res.error);
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className={`border bg-muted object-cover ${kind === "thumbnail" ? "h-16 w-16 rounded-full" : "w-full max-h-48 rounded-lg"}`}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {kind !== "thumbnail" ? (
          <select className={selectCls} value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)} aria-label="Crop shape">
            <option value="original">Original shape</option>
            <option value="16:9">Crop 16:9</option>
            <option value="4:3">Crop 4:3</option>
            <option value="1:1">Crop square</option>
          </select>
        ) : null}
        <select className={selectCls} value={focus} onChange={(e) => setFocus(e.target.value as typeof focus)} aria-label="Crop focus">
          <option value="centre">Focus centre</option>
          <option value="top">Focus top</option>
          <option value="bottom">Focus bottom</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload image"}
        </Button>
        {value ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void removeAnnouncementImageAction(value);
              onChange("");
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

const BLOCK_LABEL: Record<Block["type"], string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  list: "Bullet list",
  image: "Image",
  features: "Feature cards",
  callout: "Highlighted section",
  divider: "Divider",
};

function emptyBlock(type: Block["type"]): Block {
  switch (type) {
    case "heading":
      return { type, text: "" };
    case "paragraph":
      return { type, text: "" };
    case "list":
      return { type, items: [""] };
    case "image":
      return { type, url: "", caption: "" };
    case "features":
      return { type, title: "", items: [{ emoji: "✨", title: "", description: "", url: "" }] };
    case "callout":
      return { type, emoji: "💡", title: "", text: "" };
    case "divider":
      return { type };
  }
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "heading":
      return <Input value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Heading text" />;
    case "paragraph":
      return (
        <textarea
          rows={4}
          className={textareaCls}
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Text — **bold**, *italic*, [link text](https://…) and emojis 🎉 work here."
        />
      );
    case "list":
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? e.target.value : x)) })}
                placeholder={`Bullet ${i + 1}`}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
                ✕
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...block, items: [...block.items, ""] })}>
            + Bullet
          </Button>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <ImageField label="Image" kind="inline" value={block.url} onChange={(url) => onChange({ ...block, url })} />
          <Input value={block.caption || ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Caption (optional)" />
        </div>
      );
    case "features":
      return (
        <div className="space-y-2">
          <Input value={block.title || ""} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Section title, e.g. What's new in V2?" />
          {block.items.map((f, i) => {
            const set = (patch: Partial<FeatureItem>) =>
              onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="grid grid-cols-[3.5rem_1fr_auto] gap-2 rounded-lg border p-2">
                <Input value={f.emoji} onChange={(e) => set({ emoji: e.target.value })} aria-label="Emoji" className="text-center" />
                <div className="space-y-1.5">
                  <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Feature title" />
                  <Input value={f.description || ""} onChange={(e) => set({ description: e.target.value })} placeholder="Short description (optional)" />
                  <Input value={f.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="Link (optional) — https://… or /page" />
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
                  ✕
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...block, items: [...block.items, { emoji: "✨", title: "", description: "", url: "" }] })}
          >
            + Feature
          </Button>
        </div>
      );
    case "callout":
      return (
        <div className="grid grid-cols-[3.5rem_1fr] gap-2">
          <Input value={block.emoji || ""} onChange={(e) => onChange({ ...block, emoji: e.target.value })} aria-label="Emoji" className="text-center" />
          <div className="space-y-1.5">
            <Input value={block.title || ""} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" />
            <textarea rows={3} className={textareaCls} value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Highlighted text" />
          </div>
        </div>
      );
    case "divider":
      return <p className="text-xs text-muted-foreground">A thin line between sections.</p>;
  }
}

/* —— live preview (mirrors the member app's styling closely enough to judge layout) —— */

function inlinePreview(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("[") ? (
        <span key={i} className="font-semibold text-rose-600 underline">
          {part.slice(1, part.indexOf("]"))}
        </span>
      ) : (
        <span key={i}>{part.replace(/\*([^*]+)\*/g, "$1")}</span>
      )
    );
}

function CardPreview({ d }: { d: AnnouncementDraft }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/30 p-3">
      {d.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.thumbnailUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <span className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-2xl">{d.emoji || "📢"}</span>
      )}
      <div className="min-w-0 flex-1">
        <span className="inline-block rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">New</span>
        <p className="mt-1 text-sm font-bold truncate">{d.title || "Card title"}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{d.summary || "Short preview description"}</p>
      </div>
      <span className="text-muted-foreground">›</span>
    </div>
  );
}

function PagePreview({ d }: { d: AnnouncementDraft }) {
  const blocks = d.blocks as Block[];
  const cat = CATEGORY_OPTIONS.find((c) => c.value === d.category)?.label ?? "Community";
  return (
    <div className="rounded-2xl border bg-white p-4 text-[13px] text-neutral-700 space-y-3">
      <p className="text-rose-600 font-semibold">← Back to announcements</p>
      <span className="inline-block rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">
        {d.emoji} {cat}
      </span>
      <p className="text-xl font-bold text-neutral-950">{d.pageTitle || d.title || "Page title"}</p>
      {d.subtitle ? <p className="text-neutral-500">{d.subtitle}</p> : null}
      {d.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.coverUrl} alt="" className="w-full aspect-[16/9] object-cover rounded-xl" />
      ) : null}
      {blocks.map((b, i) =>
        b.type === "heading" ? (
          <p key={i} className="text-base font-bold text-neutral-950">{b.text}</p>
        ) : b.type === "paragraph" ? (
          <p key={i} className="whitespace-pre-line">{inlinePreview(b.text)}</p>
        ) : b.type === "list" ? (
          <ul key={i} className="list-disc pl-5">
            {b.items.filter(Boolean).map((x, j) => (
              <li key={j}>{inlinePreview(x)}</li>
            ))}
          </ul>
        ) : b.type === "image" ? (
          b.url ? (
            <figure key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.url} alt="" className="w-full rounded-xl" />
              {b.caption ? <figcaption className="text-center text-xs text-neutral-500 mt-1">{b.caption}</figcaption> : null}
            </figure>
          ) : null
        ) : b.type === "features" ? (
          <div key={i} className="rounded-xl border p-3 space-y-2">
            {b.title ? <p className="font-bold text-neutral-950">{b.title}</p> : null}
            {b.items.map((f, j) => (
              <p key={j} className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center">{f.emoji}</span>
                <span className="font-medium text-neutral-900">{f.title}</span>
              </p>
            ))}
          </div>
        ) : b.type === "callout" ? (
          <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
            {b.emoji} {b.title ? <strong>{b.title} </strong> : null}
            {inlinePreview(b.text)}
          </div>
        ) : (
          <hr key={i} />
        )
      )}
      {d.closing ? <p className="whitespace-pre-line">{inlinePreview(d.closing)}</p> : null}
      {d.signOff ? <p className="whitespace-pre-line">{d.signOff}</p> : null}
    </div>
  );
}

export type EditorInitial = AnnouncementDraft & {
  status: string;
  publishAt: string | null;
  previewToken: string | null;
};

export function AnnouncementEditor({ initial, webOrigin }: { initial: EditorInitial; webOrigin: string }) {
  const router = useRouter();
  const [d, setD] = useState<AnnouncementDraft>(initial);
  const [status, setStatus] = useState(initial.status);
  const [previewToken, setPreviewToken] = useState(initial.previewToken);
  const [scheduleAt, setScheduleAt] = useState(() => {
    if (!initial.publishAt) return "";
    const dt = new Date(initial.publishAt);
    return dt.getTime() > Date.now() ? new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const blocks = d.blocks as Block[];
  const set = (patch: Partial<AnnouncementDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const setBlocks = (next: Block[]) => set({ blocks: next });

  const previewUrl = useMemo(
    () => (d.id && previewToken ? `${webOrigin}/announcements/${encodeURIComponent(d.slug)}?preview=${previewToken}` : null),
    [d.id, d.slug, previewToken, webOrigin]
  );
  const live = status === "published" || status === "scheduled";

  function save(intent: SaveIntent) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveAnnouncementDraft(d, intent, intent === "schedule" ? new Date(scheduleAt).toISOString() : null);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      setPreviewToken(res.previewToken);
      setD((prev) => ({ ...prev, id: res.id, slug: res.slug }));
      const nextStatus =
        intent === "publish" ? "published" : intent === "schedule" ? "scheduled" : intent === "unpublish" ? "unpublished" : status;
      setStatus(nextStatus);
      setMessage({
        kind: "ok",
        text:
          intent === "publish"
            ? "Published — members can see it now."
            : intent === "schedule"
              ? `Scheduled for ${new Date(scheduleAt).toLocaleString("en-GB")}.`
              : intent === "unpublish"
                ? "Unpublished — hidden from members."
                : "Saved.",
      });
      if (!initial.id) router.replace(`/announcements/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur flex flex-wrap items-center gap-2 border-b">
        <span className="text-xs rounded-full border px-2 py-0.5 capitalize">{status}</span>
        <Button type="button" variant="outline" disabled={pending} onClick={() => save("draft")}>
          {live ? "Save changes" : "Save draft"}
        </Button>
        <Button type="button" disabled={pending} onClick={() => save("publish")}>
          {status === "published" ? "Update & keep live" : "Publish now"}
        </Button>
        <span className="flex items-center gap-1.5">
          <input
            type="datetime-local"
            className={`${selectCls} h-8`}
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            aria-label="Schedule date and time"
          />
          <Button type="button" variant="secondary" disabled={pending || !scheduleAt} onClick={() => save("schedule")}>
            Schedule
          </Button>
        </span>
        {live ? (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => save("unpublish")}>
            Unpublish
          </Button>
        ) : null}
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm font-medium text-rose-600 hover:underline">
            Open full preview ↗
          </a>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">Save once to get a preview link</span>
        )}
      </div>
      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-destructive"}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 min-w-0">
          <Section title="Card — Notifications → Announcements" description="What members see in the list. Edited separately from the full page.">
            <Field label="Card title">
              <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Pashtun Nikah V2 is Live!" />
            </Field>
            <Field label="Short preview description">
              <textarea rows={2} className={textareaCls} value={d.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="A new and improved experience is now available." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                <select className={`${selectCls} w-full`} value={d.category} onChange={(e) => set({ category: e.target.value })}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Display order" hint="Lower numbers show first (after pinned).">
                <Input type="number" value={d.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <Field label="Emoji / icon">
              <div className="flex flex-wrap items-center gap-1.5">
                <Input value={d.emoji} onChange={(e) => set({ emoji: e.target.value })} className="w-16 text-center text-lg" aria-label="Emoji" />
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => set({ emoji: e })}
                    className={`h-8 w-8 rounded-lg border text-lg hover:bg-muted ${d.emoji === e ? "border-rose-400 bg-rose-50" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <ImageField label="Thumbnail image (optional — shown instead of the emoji)" kind="thumbnail" value={d.thumbnailUrl} onChange={(url) => set({ thumbnailUrl: url })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.pinned} onChange={(e) => set({ pinned: e.target.checked })} />
              Pin to the top (Pinned section)
            </label>
          </Section>

          <Section title="Full page — header" description="The page that opens when a member taps the card.">
            <Field label="Page title" hint="Leave empty to use the card title.">
              <Input value={d.pageTitle} onChange={(e) => set({ pageTitle: e.target.value })} />
            </Field>
            <Field label="Subtitle (optional)">
              <Input value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="A new and improved experience for our community." />
            </Field>
            <Field label="Page URL" hint="Letters, numbers and dashes. Leave empty to build it from the title.">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="shrink-0">/announcements/</span>
                <Input value={d.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="pashtun-nikah-v2-is-live" />
              </div>
            </Field>
            <ImageField label="Cover / banner image" kind="cover" defaultAspect="16:9" value={d.coverUrl} onChange={(url) => set({ coverUrl: url })} />
          </Section>

          <Section title="Full page — content" description="Build the page from blocks. Formatting in text: **bold**, *italic*, [link text](https://…), emojis.">
            <div className="space-y-3">
              {blocks.map((b, i) => (
                <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{BLOCK_LABEL[b.type]}</span>
                    <span className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => setBlocks(blocks.map((x, j) => (j === i - 1 ? blocks[i] : j === i ? blocks[i - 1] : x)))} aria-label="Move up">
                        ↑
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={i === blocks.length - 1} onClick={() => setBlocks(blocks.map((x, j) => (j === i + 1 ? blocks[i] : j === i ? blocks[i + 1] : x)))} aria-label="Move down">
                        ↓
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} aria-label="Delete block">
                        Delete
                      </Button>
                    </span>
                  </div>
                  <BlockEditor block={b} onChange={(nb) => setBlocks(blocks.map((x, j) => (j === i ? nb : x)))} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(BLOCK_LABEL) as Block["type"][]).map((t) => (
                <Button key={t} type="button" size="sm" variant="outline" onClick={() => setBlocks([...blocks, emptyBlock(t)])}>
                  + {BLOCK_LABEL[t]}
                </Button>
              ))}
            </div>
          </Section>

          <Section title="Full page — closing">
            <Field label="Closing message">
              <textarea rows={3} className={textareaCls} value={d.closing} onChange={(e) => set({ closing: e.target.value })} placeholder="Thank you for being part of our journey. May Allah place barakah in it. Ameen." />
            </Field>
            <Field label="Sign-off" hint="New lines are kept, e.g. Mana, / The Pashtun Nikah Team">
              <textarea rows={2} className={textareaCls} value={d.signOff} onChange={(e) => set({ signOff: e.target.value })} placeholder={"Mana,\nThe Pashtun Nikah Team"} />
            </Field>
          </Section>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-16 xl:self-start xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Card preview</p>
          <CardPreview d={d} />
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page preview</p>
          <PagePreview d={d} />
        </aside>
      </div>
    </div>
  );
}
