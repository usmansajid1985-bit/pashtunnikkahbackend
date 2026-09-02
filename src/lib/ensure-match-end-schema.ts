import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureMatchEndSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS ended_by BIGINT,
        ADD COLUMN IF NOT EXISTS end_reason VARCHAR(32)
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureMatchEndSchema", err);
  }
}
