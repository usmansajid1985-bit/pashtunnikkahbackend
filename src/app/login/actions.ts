"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  clearFailedAttempts,
  createPendingToken,
  createSessionToken,
  findAdminByEmail,
  getOrCreateSecurity,
  isLockedOut,
  pendingCookieOptions,
  recordFailedAttempt,
  sessionCookieOptions,
  verifyPassword,
  verifyPendingToken,
} from "@/lib/admin-auth";
import { verifyTotp } from "@/lib/totp";

const GENERIC_ERROR = "Invalid email or password.";

function lockedMessage(retryAfterMs: number) {
  const mins = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

export async function loginStep1(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: GENERIC_ERROR };

  const admin = await findAdminByEmail(email);
  if (!admin) return { error: GENERIC_ERROR };

  const lock = await isLockedOut(admin.id);
  if (lock.locked) return { error: lockedMessage(lock.retryAfterMs!) };

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) {
    await recordFailedAttempt(admin.id);
    return { error: GENERIC_ERROR };
  }

  const security = await getOrCreateSecurity(admin.id);

  if (security.totp_enabled) {
    const pending = await createPendingToken(admin.id.toString());
    const jar = await cookies();
    jar.set(PENDING_COOKIE, pending, pendingCookieOptions());
    return { step: "otp" as const };
  }

  await clearFailedAttempts(admin.id);
  const token = await createSessionToken({ adminId: admin.id.toString(), email: admin.email });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect("/");
}

export async function loginStep2(_prevState: unknown, formData: FormData) {
  const code = String(formData.get("code") || "");
  const jar = await cookies();
  const pendingToken = jar.get(PENDING_COOKIE)?.value;
  if (!pendingToken) return { error: "Session expired. Please log in again.", restart: true as const };

  const adminId = await verifyPendingToken(pendingToken);
  if (!adminId) return { error: "Session expired. Please log in again.", restart: true as const };

  const userId = BigInt(adminId);
  const lock = await isLockedOut(userId);
  if (lock.locked) return { error: lockedMessage(lock.retryAfterMs!), restart: true as const };

  const security = await getOrCreateSecurity(userId);
  const admin = await prisma.users.findUnique({ where: { id: userId } });
  if (!admin || !security.totp_secret) {
    return { error: "Session expired. Please log in again.", restart: true as const };
  }

  const valid = verifyTotp(security.totp_secret, code);
  if (!valid) {
    await recordFailedAttempt(userId);
    return { error: "Incorrect code. Please try again." };
  }

  await clearFailedAttempts(userId);
  jar.delete(PENDING_COOKIE);
  const token = await createSessionToken({ adminId: admin.id.toString(), email: admin.email });
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PENDING_COOKIE);
  redirect("/login");
}
