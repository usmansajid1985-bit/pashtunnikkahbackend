import { createHmac } from "node:crypto";

const WEB_ORIGIN = process.env.WEB_PUBLIC_URL || "http://localhost:3001";

/**
 * N08: tell the member-facing web app that a profile's status changed, so it can send the push +
 * bell notification and update the member's open tabs live. Signed with INTERNAL_API_SECRET (set
 * the same value on both Vercel projects). Never throws — a notification hiccup must not undo or
 * block the admin's action.
 */
export async function notifyProfileStatus(userId: bigint, status: string) {
  await signedPost("profile-status", userId, status);
}

/** A03: push + bell + live banner for a moderation warning (the text itself stays server-side). */
export async function notifyMemberWarning(userId: bigint, warningId: bigint | null) {
  await signedPost("member-warning", userId, warningId ? warningId.toString() : "0");
}

async function signedPost(path: string, userId: bigint, status: string) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.warn(`[notify-web] INTERNAL_API_SECRET not set — ${path} not sent`);
    return;
  }
  const ts = String(Date.now());
  const id = userId.toString();
  const signature = createHmac("sha256", secret).update(`${id}.${status}.${ts}`).digest("hex");
  try {
    const res = await fetch(`${WEB_ORIGIN.replace(/\/$/, "")}/api/internal/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pn-signature": signature },
      body: JSON.stringify({ userId: id, status, ts }),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[notify-web] ${path} failed`, res.status);
  } catch (err) {
    console.error(`[notify-web] ${path} failed`, err);
  }
}
