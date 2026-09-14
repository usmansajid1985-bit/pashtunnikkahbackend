"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteHeroFile, saveHeroFile } from "@/lib/hero-uploads";
import { getAdminSession } from "@/lib/admin-auth";

async function nextId() {
  const max = await prisma.hero_slides.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

/** PN-BACKEND-003: re-check auth before writing — middleware is the only gate otherwise. */
async function assertAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
}

export async function addHeroSlide(formData: FormData) {
  await assertAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  const alt = String(formData.get("alt") || "").trim();
  const slot = String(formData.get("slot") || "hero") === "cta" ? "cta" : "hero";

  try {
    const saved = await saveHeroFile(file);
    if (slot === "cta") {
      await prisma.$executeRaw`UPDATE hero_slides SET is_active = false WHERE slot = 'cta'`;
    }
    const last = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(sort_order) AS max FROM hero_slides WHERE slot = ${slot}
    `;
    const sortOrder = (last[0]?.max ?? 0) + 1;
    const id = await nextId();
    await prisma.$executeRaw`
      INSERT INTO hero_slides (id, image_url, alt, slot, sort_order, is_active, created_at)
      VALUES (${id}, ${saved.url}, ${alt}, ${slot}, ${sortOrder}, true, NOW())
    `;
    revalidatePath("/homepage");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    if (/body.*limit|1 MB|Body exceeded/i.test(message)) {
      return { error: "Image is too large for upload (max 10MB). Compress it or use a smaller JPG/PNG." };
    }
    return { error: message };
  }
}

export async function toggleHeroSlide(formData: FormData) {
  await assertAdmin();
  const id = BigInt(String(formData.get("id")));
  const slide = await prisma.hero_slides.findUnique({ where: { id } });
  if (!slide) return;
  await prisma.hero_slides.update({
    where: { id },
    data: { is_active: !slide.is_active },
  });
  const { bumpHeroCache } = await import("@/lib/hero-uploads");
  await bumpHeroCache();
  revalidatePath("/homepage");
}

export async function moveHeroSlide(formData: FormData) {
  await assertAdmin();
  const id = BigInt(String(formData.get("id")));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const slides = await prisma.$queryRaw<{ id: bigint; sort_order: number }[]>`
    SELECT id, sort_order FROM hero_slides WHERE slot = 'hero' ORDER BY sort_order ASC
  `;
  const idx = slides.findIndex((s) => s.id === id);
  const swap = slides[idx + dir];
  if (idx < 0 || !swap) return;
  const current = slides[idx];
  await prisma.$transaction([
    prisma.hero_slides.update({ where: { id: current.id }, data: { sort_order: swap.sort_order } }),
    prisma.hero_slides.update({ where: { id: swap.id }, data: { sort_order: current.sort_order } }),
  ]);
  const { bumpHeroCache } = await import("@/lib/hero-uploads");
  await bumpHeroCache();
  revalidatePath("/homepage");
}

export async function deleteHeroSlide(formData: FormData) {
  await assertAdmin();
  const id = BigInt(String(formData.get("id")));
  const slide = await prisma.hero_slides.findUnique({ where: { id } });
  if (!slide) return;
  await prisma.hero_slides.delete({ where: { id } });
  await deleteHeroFile(slide.image_url);
  revalidatePath("/homepage");
}
