import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export {
  SESSION_COOKIE,
  PENDING_COOKIE,
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
  createPendingToken,
  verifyPendingToken,
  pendingCookieOptions,
  type AdminSessionPayload,
} from "@/lib/session";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type AdminSessionPayload } from "@/lib/session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// --- Password ---

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// --- Lockout ---

export async function getOrCreateSecurity(userId: bigint) {
  const existing = await prisma.admin_security.findUnique({ where: { user_id: userId } });
  if (existing) return existing;
  return prisma.admin_security.create({ data: { user_id: userId } });
}

export async function isLockedOut(userId: bigint): Promise<{ locked: boolean; retryAfterMs?: number }> {
  const security = await prisma.admin_security.findUnique({ where: { user_id: userId } });
  if (!security?.locked_until) return { locked: false };
  const now = Date.now();
  const until = security.locked_until.getTime();
  if (until > now) return { locked: true, retryAfterMs: until - now };
  return { locked: false };
}

export async function recordFailedAttempt(userId: bigint) {
  const security = await getOrCreateSecurity(userId);
  const nextCount = security.failed_attempts + 1;
  const data: { failed_attempts: number; locked_until?: Date; updated_at: Date } = {
    failed_attempts: nextCount,
    updated_at: new Date(),
  };
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    data.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
  }
  await prisma.admin_security.update({ where: { user_id: userId }, data });
}

export async function clearFailedAttempts(userId: bigint) {
  await prisma.admin_security.update({
    where: { user_id: userId },
    data: { failed_attempts: 0, locked_until: null, last_login_at: new Date(), updated_at: new Date() },
  });
}

export async function findAdminByEmail(email: string) {
  return prisma.users.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" }, role: "admin" },
  });
}
