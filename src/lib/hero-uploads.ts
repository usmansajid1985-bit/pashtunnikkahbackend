import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export const HERO_MAX_BYTES = 10 * 1024 * 1024;
export const HERO_MAX_LABEL = "10MB";
export const HERO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export function uploadsRoot() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "..", "uploads");
}

export function heroDir() {
  return path.join(uploadsRoot(), "hero");
}

export function publicHeroUrl(filename: string) {
  return `/uploads/hero/${filename}`;
}

export function heroVersionPath() {
  return path.join(heroDir(), ".cache-version");
}

export async function bumpHeroCache() {
  const dir = heroDir();
  await mkdir(dir, { recursive: true });
  await writeFile(heroVersionPath(), `${Date.now()}\n`, "utf8");
}

function extFromNameOrType(name: string, type: string) {
  const fromName = path.extname(name).replace(".", "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

export async function saveHeroFile(file: File) {
  const type = (file.type || "").toLowerCase();
  if (!HERO_TYPES.includes(type) && !type.startsWith("image/")) {
    throw new Error("Please upload a JPG, PNG, WEBP, or GIF image.");
  }
  if (type && !type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }
  if (file.size > HERO_MAX_BYTES) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${HERO_MAX_LABEL}.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 100) throw new Error("Image too small or corrupted.");
  if (buf.length > HERO_MAX_BYTES) {
    throw new Error(`Image is too large. Maximum is ${HERO_MAX_LABEL}.`);
  }

  const dir = heroDir();
  await mkdir(dir, { recursive: true });
  const ext = extFromNameOrType(file.name || "", type);
  const filename = `hero-${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, filename), buf);
  await bumpHeroCache();
  return { filename, url: publicHeroUrl(filename) };
}

export async function deleteHeroFile(imageUrl: string) {
  const match = /\/uploads\/hero\/([^/]+)$/.exec(imageUrl);
  if (!match) return;
  try {
    await unlink(path.join(heroDir(), match[1]));
  } catch {
    /* ignore missing file */
  }
  await bumpHeroCache();
}
