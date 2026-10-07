import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { reviewMemberPhoto, updatePhotoStatus, updateProfileStatus } from "@/app/profiles/actions";
import { signedPhotoUrl, type MemberPhoto } from "@/lib/photos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const WEB_ORIGIN = process.env.WEB_PUBLIC_URL || "http://localhost:3001";

function photoSrc(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${WEB_ORIGIN}${url}`;
}

type PhotoRow = { id: bigint; user_id: bigint; url: string; status: string; is_main: boolean };

export default async function PhotosQueuePage() {
  // Photos of any member who has at least one awaiting review. All of them are loaded so each
  // keeps its real position ("Photo 2"), but only the ones still pending are shown below.
  const rows = await prisma.$queryRaw<PhotoRow[]>`
    SELECT id, user_id, url, status, is_main
    FROM profile_photos
    WHERE user_id IN (SELECT user_id FROM profile_photos WHERE status = 'pending')
    ORDER BY user_id, is_main DESC, sort_order ASC, id ASC
  `.catch(() => [] as PhotoRow[]);
  const userIdsWithPending = [...new Set(rows.map((r) => r.user_id))];

  const pending = await prisma.profiles.findMany({
    where: {
      OR: [
        { photo_status: { in: ["pending", "Pending"] }, photo_url: { not: null } },
        ...(userIdsWithPending.length ? [{ user_id: { in: userIdsWithPending } }] : []),
      ],
    },
    orderBy: { updated_at: "desc" },
    take: 60,
    include: { users: { select: { email: true, plan: true } } },
  });

  // The bucket is private: sign every link on the server before rendering.
  const photosByProfile = new Map<string, (MemberPhoto & { position: number })[]>();
  const verificationByProfile = new Map<string, string | null>();
  await Promise.all(
    pending.map(async (p) => {
      const own = rows.filter((r) => r.user_id === p.user_id);
      const awaiting = own.map((r, i) => ({ r, position: i + 1 })).filter(({ r }) => r.status === "pending");
      const photos: (MemberPhoto & { position: number })[] = own.length
        ? await Promise.all(
            awaiting.map(async ({ r, position }) => ({
              id: r.id.toString(),
              src: photoSrc(await signedPhotoUrl(r.url)),
              status: r.status,
              isMain: r.is_main,
              position,
            }))
          )
        : [{ id: null, src: photoSrc(await signedPhotoUrl(p.photo_url)), status: (p.photo_status || "pending").toLowerCase(), isMain: true, position: 1 }];
      photosByProfile.set(p.id.toString(), photos);
      const sameAsMain = p.photo_verification_url === p.photo_url;
      verificationByProfile.set(
        p.id.toString(),
        sameAsMain ? null : photoSrc(await signedPhotoUrl(p.photo_verification_url))
      );
    })
  );

  // A member whose photos have all been reviewed drops out of the queue.
  const queue = pending.filter((p) => (photosByProfile.get(p.id.toString()) ?? []).some((ph) => ph.status === "pending"));

  const recent = await prisma.profiles.findMany({
    where: {
      photo_status: { in: ["approved", "rejected"] },
      photo_url: { not: null },
    },
    orderBy: { updated_at: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Photo moderation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review uploaded profile photos. Approve to show after match/share rules; reject to request a new upload.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {queue.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No photos awaiting review.
            </CardContent>
          </Card>
        )}
        {queue.map((p) => {
          const photos = photosByProfile.get(p.id.toString()) ?? [];
          const ver = verificationByProfile.get(p.id.toString()) ?? null;
          return (
            <Card key={p.id.toString()} className="overflow-hidden gap-2 py-3">
              <CardHeader className="px-3 pb-0">
                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                  <Link href={`/profiles/${p.id}`} className="hover:text-primary">
                    {p.profile_code || p.full_name || `#${p.id}`}
                  </Link>
                </CardTitle>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  <span className="block truncate" title={p.users.email}>
                    {p.users.email}
                  </span>
                  {p.gender} · profile {p.status}
                  <span className="block">{fmtDate(p.updated_at)}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-3">
                {photos.map((photo, i) => (
                  <div key={photo.id ?? `legacy-${i}`} className="space-y-1.5">
                    <div className="aspect-[4/5] bg-muted relative rounded-lg overflow-hidden">
                      {photo.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          No file
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{photo.isMain ? "Main photo" : `Photo ${photo.position}`}</span>
                      <StatusBadge value={photo.status} />
                    </div>
                    {photo.status === "pending" ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(["approved", "rejected"] as const).map((next) => (
                          <form key={next} action={photo.id ? reviewMemberPhoto : updatePhotoStatus}>
                            <input type="hidden" name={photo.id ? "photo_id" : "id"} value={photo.id ?? p.id.toString()} />
                            <input type="hidden" name="photo_status" value={next} />
                            <Button type="submit" size="sm" className="h-7 px-2.5 text-xs" variant={next === "approved" ? "default" : "outline"}>
                              {next === "approved" ? "Approve" : "Reject"}
                            </Button>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {ver ? (
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground mb-1">Verification (mods only)</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ver} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                  </div>
                ) : null}
                {p.status === "pending" ? (
                  <form action={updateProfileStatus}>
                    <input type="hidden" name="id" value={p.id.toString()} />
                    <input type="hidden" name="status" value="approved" />
                    <Button type="submit" size="sm" variant="secondary">
                      Approve profile
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recently reviewed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((p) => (
              <div key={p.id.toString()} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/profiles/${p.id}`} className="text-primary hover:underline">
                  {p.profile_code || p.full_name}
                </Link>
                <StatusBadge value={p.photo_status || ""} />
                <span className="text-muted-foreground text-xs">{fmtDate(p.updated_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
