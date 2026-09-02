import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureMessageRemovalsSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS message_removals (
        id BIGSERIAL PRIMARY KEY,
        message_id BIGINT NOT NULL UNIQUE,
        removed_by_admin_id BIGINT NOT NULL,
        reason VARCHAR(255),
        removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureMessageRemovalsSchema", err);
  }
}

export async function isMessageRemoved(messageId: bigint): Promise<boolean> {
  await ensureMessageRemovalsSchema();
  const rows = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM message_removals WHERE message_id = ${messageId} LIMIT 1
  `.catch(() => []);
  return rows.length > 0;
}
