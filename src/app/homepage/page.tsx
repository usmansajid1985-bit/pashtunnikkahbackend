import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeroUploadForm } from "./upload-form";
import { deleteHeroSlide, moveHeroSlide, toggleHeroSlide } from "./actions";

export const dynamic = "force-dynamic";

const WEB_ORIGIN = process.env.WEB_PUBLIC_URL || "http://localhost:3001";

function src(url: string) {
  return url.startsWith("http") ? url : `${WEB_ORIGIN}${url}`;
}

export default async function HomepageSlidesPage() {
  const all = await prisma.$queryRaw<
    {
      id: bigint;
      image_url: string;
      alt: string;
      slot: string;
      sort_order: number;
      is_active: boolean;
    }[]
  >`SELECT id, image_url, alt, slot, sort_order, is_active FROM hero_slides ORDER BY sort_order ASC`;
  const slides = all.filter((s) => s.slot !== "cta");
  const cta = all.filter((s) => s.slot === "cta");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Homepage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hero slideshow and bottom CTA background on{" "}
          <a href={WEB_ORIGIN} className="text-primary hover:underline" target="_blank" rel="noreferrer">
            {WEB_ORIGIN}
          </a>
          . Images are shown very light behind the copy, same treatment as the hero.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero slides</CardTitle>
        </CardHeader>
        <CardContent>
          <HeroUploadForm />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slides.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No hero images yet. Upload the first slide above.
            </CardContent>
          </Card>
        ) : null}
        {slides.map((s, i) => (
          <Card key={s.id.toString()} className="overflow-hidden">
            <div className="aspect-[16/9] bg-muted relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(s.image_url)} alt={s.alt || ""} className="absolute inset-0 w-full h-full object-cover" />
              {!s.is_active ? (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 text-white text-[11px] px-2 py-0.5">
                  Hidden
                </span>
              ) : null}
            </div>
            <CardContent className="pt-3 space-y-3">
              <p className="text-sm truncate">{s.alt || `Slide ${i + 1}`}</p>
              <div className="flex flex-wrap gap-2">
                <form action={moveHeroSlide}>
                  <input type="hidden" name="id" value={s.id.toString()} />
                  <input type="hidden" name="dir" value="up" />
                  <Button type="submit" size="sm" variant="outline" disabled={i === 0}>
                    Up
                  </Button>
                </form>
                <form action={moveHeroSlide}>
                  <input type="hidden" name="id" value={s.id.toString()} />
                  <input type="hidden" name="dir" value="down" />
                  <Button type="submit" size="sm" variant="outline" disabled={i === slides.length - 1}>
                    Down
                  </Button>
                </form>
                <form action={toggleHeroSlide}>
                  <input type="hidden" name="id" value={s.id.toString()} />
                  <Button type="submit" size="sm" variant="secondary">
                    {s.is_active ? "Hide" : "Show"}
                  </Button>
                </form>
                <form action={deleteHeroSlide}>
                  <input type="hidden" name="id" value={s.id.toString()} />
                  <Button type="submit" size="sm" variant="outline">
                    Delete
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bottom CTA background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A single light background for “Start your journey today.” Uploading a new image replaces the current one.
          </p>
          <HeroUploadForm slot="cta" submitLabel="Set CTA background" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cta.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No CTA background yet.
            </CardContent>
          </Card>
        ) : null}
        {cta.map((s) => (
          <Card key={s.id.toString()} className="overflow-hidden">
            <div className="aspect-[16/9] bg-muted relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(s.image_url)} alt={s.alt || ""} className="absolute inset-0 w-full h-full object-cover" />
              {!s.is_active ? (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 text-white text-[11px] px-2 py-0.5">
                  Hidden
                </span>
              ) : (
                <span className="absolute top-2 left-2 rounded-full bg-emerald-700/80 text-white text-[11px] px-2 py-0.5">
                  Active
                </span>
              )}
            </div>
            <CardContent className="pt-3 space-y-3">
              <p className="text-sm truncate">{s.alt || "CTA background"}</p>
              <div className="flex flex-wrap gap-2">
                <form action={toggleHeroSlide}>
                  <input type="hidden" name="id" value={s.id.toString()} />
                  <Button type="submit" size="sm" variant="secondary">
                    {s.is_active ? "Hide" : "Show"}
                  </Button>
                </form>
                <form action={deleteHeroSlide}>
                  <input type="hidden" name="id" value={s.id.toString()} />
                  <Button type="submit" size="sm" variant="outline">
                    Delete
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
