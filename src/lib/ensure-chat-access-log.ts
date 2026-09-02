import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureChatAccessLogSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_access_log (
        id BIGSERIAL PRIMARY KEY,
        admin_id BIGINT NOT NULL,
        request_id BIGINT NOT NULL,
        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_chat_access_log_request
        ON chat_access_log (request_id, opened_at DESC)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_chat_access_log_admin
        ON chat_access_log (admin_id, opened_at DESC)
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureChatAccessLogSchema", err);
  }
}
