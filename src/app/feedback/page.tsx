import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { setFeedbackStatus } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, { label: string; cls: string }> = {
  general: { label: "General", cls: "bg-neutral-100 text-neutral-700" },
  bug: { label: "Bug", cls: "bg-rose-50 text-rose-700" },
  feature: { label: "Feature idea", cls: "bg-amber-50 text-amber-800" },
};

type Row = {
  id: bigint;
  user_id: bigint;
  kind: string;
  subject: string;
  message: string;
  screenshots: unknown;
  user_agent: string | null;
  status: string;
  admin_note: string | null;
  created_at: Date;
  profile_code: string | null;
  email: string | null;
};

/** Screenshots live in the private "feedback" bucket — show them through 1-hour signed links. */
async function signed(path: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const bucket = process.env.SUPABASE_FEEDBACK_BUCKET || "feedback";
  try {
    const res = await fetch(`${base}/storage/v1/object/sign/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const s = data.signedURL ?? data.signedUrl;
    return s ? `${base}/storage/v1${s.startsWith("/") ? "" : "/"}${s}` : null;
  } catch {
    return null;
  }
}

/** Settings → Give us feedback, from members. */
export default async function FeedbackInboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const showResolved = show === "all";
  const rows = await prisma
    .$queryRawUnsafe<Row[]>(
      `SELECT f.*, p.profile_code, u.email
         FROM member_feedback f
         LEFT JOIN profiles p ON p.user_id = f.user_id
         LEFT JOIN users u ON u.id = f.user_id
        ${showResolved ? "" : "WHERE f.status <> 'resolved'"}
        ORDER BY f.created_at DESC LIMIT 200`
    )
    .catch(() => [] as Row[]); // table appears with the first submission
  const withShots = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      shots: (await Promise.all((Array.isArray(r.screenshots) ? (r.screenshots as string[]) : []).map(signed))).filter(
        (u): u is string => Boolean(u)
      ),
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-3xl font-medium tracking-tight">Feedback</h2>
          <p className="mt-1 text-sm text-muted-foreground">General feedback, bug reports and feature ideas sent from Settings → Give us feedback.</p>
        </div>
        <Link href={showResolved ? "/feedback" : "/feedback?show=all"} className="text-sm font-medium text-rose-600 hover:underline">
          {showResolved ? "Show open only" : "Show resolved too"}
        </Link>
      </div>

      {withShots.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {showResolved ? "No feedback yet." : "No open feedback."}
        </p>
      ) : (
        <div className="space-y-3">
          {withShots.map((r) => {
            const k = KIND_LABEL[r.kind] ?? KIND_LABEL.general;
            const id = r.id.toString();
            return (
              <article key={id} className={`rounded-xl border bg-card p-4 space-y-3 ${r.status === "resolved" ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${k.cls}`}>{k.label}</span>
                  {r.status === "resolved" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Resolved</span> : null}
                  <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
                  <span className="text-muted-foreground">·</span>
                  <Link href={`/users/${r.user_id.toString()}`} className="font-medium hover:underline">
                    {r.profile_code || `User ${r.user_id}`}
                  </Link>
                  {r.email ? <span className="text-muted-foreground">{r.email}</span> : null}
                </div>
                <div>
                  <h3 className="font-medium">{r.subject}</h3>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{r.message}</p>
                </div>
                {r.shots.length ? (
                  <div className="flex flex-wrap gap-2">
                    {r.shots.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`Screenshot ${i + 1}`} className="h-28 w-28 rounded-lg border object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {r.user_agent ? <p className="text-[11px] text-muted-foreground/80 truncate">Device: {r.user_agent}</p> : null}
                {r.admin_note ? <p className="text-xs rounded-lg bg-muted px-3 py-2">Note: {r.admin_note}</p> : null}
                <form action={setFeedbackStatus} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="status" value={r.status === "resolved" ? "new" : "resolved"} />
                  <input
                    name="note"
                    placeholder="Internal note (optional)"
                    className="h-8 min-w-56 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  />
                  <Button type="submit" size="sm" variant={r.status === "resolved" ? "outline" : "default"}>
                    {r.status === "resolved" ? "Reopen" : "Mark resolved"}
                  </Button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
