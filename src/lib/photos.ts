/**
 * Member photos live in a PRIVATE Supabase Storage bucket, so the stored URL does not load in a
 * browser on its own. Admin pages must turn it into a short-lived signed link first.
 */
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || "photos";

/** Object path inside the bucket, from a stored public/signed URL or a bare path. */
function photoObjectPath(stored: string): string | null {
  const m = stored.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
  if (m) return decodeURIComponent(m[1]);
  if (!/^https?:\/\//i.test(stored)) return stored.replace(/^\/+/, "");
  return null;
}

/**
 * Signed link (1 hour) for a stored photo. Falls back to the stored value when it isn't a storage
 * object or signing isn't possible, so a misconfiguration shows a broken image, not a crash.
 */
export async function signedPhotoUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const objectPath = photoObjectPath(stored);
  if (!base || !key || !objectPath || objectPath.startsWith("uploads/")) return stored;
  try {
    const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
    const res = await fetch(`${base}/storage/v1/object/sign/${BUCKET}/${encoded}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
      cache: "no-store",
    });
    if (!res.ok) return stored;
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const signed = data.signedURL ?? data.signedUrl;
    return signed ? `${base}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}` : stored;
  } catch {
    return stored;
  }
}

export type MemberPhoto = {
  /** Row id in `profile_photos`; null for a legacy profile that only has `profiles.photo_url`. */
  id: string | null;
  src: string | null;
  status: string;
  isMain: boolean;
};
