import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { updatePhotoStatus, updateProfileStatus } from "@/app/profiles/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const WEB_ORIGIN = process.env.WEB_PUBLIC_URL || "http://localhost:3001";

function photoSrc(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${WEB_ORIGIN}${url}`;
}

export default async function PhotosQueuePage() {
  const pending = await prisma.profiles.findMany({
    where: {
      OR: [{ photo_status: "pending" }, { photo_status: "Pending" }],
      photo_url: { not: null },
    },
    orderBy: { updated_at: "desc" },
    take: 60,
    include: { users: { select: { email: true, plan: true } } },
  });

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pending.length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No photos awaiting review.
            </CardContent>
          </Card>
        )}
        {pending.map((p) => {
          const src = photoSrc(p.photo_url);
          const ver = photoSrc(p.photo_verification_url);
          return (
            <Card key={p.id.toString()} className="overflow-hidden">
              <div className="aspect-[4/5] bg-muted relative">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    No file
                  </div>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <Link href={`/profiles/${p.id}`} className="hover:text-primary">
                    {p.profile_code || p.full_name || `#${p.id}`}
                  </Link>
                  <StatusBadge value={p.photo_status || "pending"} />
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {p.users.email} · {p.gender} · profile {p.status} · {fmtDate(p.updated_at)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {ver ? (
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground mb-1">Verification (mods only)</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ver} alt="" className="h-24 w-24 rounded-lg object-cover border" />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={updatePhotoStatus}>
                    <input type="hidden" name="id" value={p.id.toString()} />
                    <input type="hidden" name="photo_status" value="approved" />
                    <Button type="submit" size="sm">
                      Approve photo
                    </Button>
                  </form>
                  <form action={updatePhotoStatus}>
                    <input type="hidden" name="id" value={p.id.toString()} />
                    <input type="hidden" name="photo_status" value="rejected" />
                    <Button type="submit" size="sm" variant="outline">
                      Reject photo
                    </Button>
                  </form>
                  {p.status === "pending" ? (
                    <form action={updateProfileStatus}>
                      <input type="hidden" name="id" value={p.id.toString()} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" size="sm" variant="secondary">
                        Approve profile
                      </Button>
                    </form>
                  ) : null}
                </div>
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
