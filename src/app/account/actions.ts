"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hashPassword, verifyPassword, getOrCreateSecurity } from "@/lib/admin-auth";
import { generateBase32Secret } from "@/lib/totp";
import { verifyTotp } from "@/lib/totp";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  return BigInt(session.adminId);
}

export async function changePassword(_prevState: unknown, formData: FormData) {
  const adminId = await requireAdmin();
  const current = String(formData.get("current_password") || "");
  const next = String(formData.get("new_password") || "");
  const confirm = String(formData.get("confirm_password") || "");

  if (next.length < 10) return { error: "New password must be at least 10 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };

  const admin = await prisma.users.findUnique({ where: { id: adminId } });
  if (!admin || !(await verifyPassword(current, admin.password_hash))) {
    return { error: "Current password is incorrect." };
  }

  const hash = await hashPassword(next);
  await prisma.users.update({ where: { id: adminId }, data: { password_hash: hash, updated_at: new Date() } });
  revalidatePath("/account");
  return { success: "Password updated." };
}

export async function startTotpEnrollment() {
  const adminId = await requireAdmin();
  const secret = generateBase32Secret();
  await prisma.admin_security.upsert({
    where: { user_id: adminId },
    update: { totp_secret: secret, totp_enabled: false, updated_at: new Date() },
    create: { user_id: adminId, totp_secret: secret },
  });
  revalidatePath("/account");
  return secret;
}

export async function confirmTotpEnrollment(_prevState: unknown, formData: FormData) {
  const adminId = await requireAdmin();
  const code = String(formData.get("code") || "");
  const security = await getOrCreateSecurity(adminId);
  if (!security.totp_secret) return { error: "Start enrollment again." };
  if (!verifyTotp(security.totp_secret, code)) return { error: "Incorrect code." };

  await prisma.admin_security.update({
    where: { user_id: adminId },
    data: { totp_enabled: true, updated_at: new Date() },
  });
  revalidatePath("/account");
  return { success: "Two-factor authentication enabled." };
}

export async function disableTotp(_prevState: unknown, formData: FormData) {
  const adminId = await requireAdmin();
  const password = String(formData.get("password") || "");
  const admin = await prisma.users.findUnique({ where: { id: adminId } });
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    return { error: "Password is incorrect." };
  }
  await prisma.admin_security.update({
    where: { user_id: adminId },
    data: { totp_enabled: false, totp_secret: null, updated_at: new Date() },
  });
  revalidatePath("/account");
  return { success: "Two-factor authentication disabled." };
}
