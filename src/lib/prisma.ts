import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/** Bump when schema/client config changes so the HMR singleton is not reused. */
const PRISMA_SCHEMA_REV = 8;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRev?: number;
  pgPool?: Pool;
};

function stripSslMode(connectionString: string) {
  return connectionString
    .replace(/([?&])sslmode=[^&]*/gi, (_, sep) => (sep === "?" ? "?" : ""))
    .replace(/\?&/, "?")
    .replace(/\?$/, "");
}

function createPool() {
  const raw = process.env.DATABASE_URL!;
  const url = raw.toLowerCase();
  const needsRelaxedSsl =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false" ||
    url.includes("supabase.com") ||
    url.includes("supabase.co") ||
    url.includes("pooler.supabase");

  const connectionString = needsRelaxedSsl ? stripSslMode(raw) : raw;

  // Supabase session-mode pooler (5432) caps the project at ~15 dedicated
  // connections; transaction mode (6543 / pgbouncer=true) multiplexes. Every
  // instance opens its own pg Pool, so cap it hard — an uncapped pool (pg
  // default max: 10) plus the web app exhausts session mode immediately.
  const isTransactionPooler =
    url.includes(":6543") || url.includes("pgbouncer=true");
  const max = Number(
    process.env.DB_POOL_MAX ?? (isTransactionPooler ? 8 : 3)
  );

  return new Pool({
    connectionString,
    max: Number.isFinite(max) && max > 0 ? max : 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ...(needsRelaxedSsl
      ? { ssl: { rejectUnauthorized: false as const } }
      : {}),
  });
}

function createClient() {
  if (globalForPrisma.pgPool) {
    void globalForPrisma.pgPool.end().catch(() => {});
  }
  const pool = createPool();
  globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getClient() {
  if (globalForPrisma.prisma && globalForPrisma.prismaRev === PRISMA_SCHEMA_REV) {
    return globalForPrisma.prisma;
  }
  const client = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaRev = PRISMA_SCHEMA_REV;
  return client;
}

export const prisma = getClient();

export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}
