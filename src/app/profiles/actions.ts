"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { ensureMatchEndSchema } from "@/lib/ensure-match-end-schema";

async function nextModerationId() {
  const max = await prisma.moderation_log.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

async function nextNoteId() {
  const max = await prisma.admin_notes.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

async function nextAnnouncementId() {
  const max = await prisma.announcements.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

/** The logged-in admin performing this action. Middleware guarantees a session exists. */
async function currentAdminId(): Promise<bigint> {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  return BigInt(session.adminId);
}

async function log(userId: bigint | null, action: string, note?: string | null) {
  const adminId = await currentAdminId();
  await prisma.moderation_log.create({
    data: {
      id: await nextModerationId(),
      user_id: userId,
      admin_id: adminId,
      action,
      note: note ?? null,
      created_at: new Date(),
    },
  });
}

export async function updateProfileStatus(formData: FormData) {
  await currentAdminId(); // PN-BACKEND-003: re-check auth before writing, not just when logging
  const id = BigInt(String(formData.get("id")));
  const status = String(formData.get("status") || "").toLowerCase();
  const allowed = ["approved", "pending", "rejected", "suspended", "unverified"];
  if (!allowed.includes(status)) return;

  const profile = await prisma.profiles.findUnique({ where: { id } });
  if (!profile) return;

  const rejection =
    status === "rejected" ? String(formData.get("rejection_reason") || "") || null : null;

  await prisma.profiles.update({
    where: { id },
    data: {
      status,
      rejection_reason: status === "rejected" ? rejection : null,
      updated_at: new Date(),
      ...(status === "approved" ? { is_hidden: false } : {}),
    },
  });

  if (status === "approved") {
    await prisma.users.update({
      where: { id: profile.user_id },
      data: { approved_at: new Date(), account_status: "active", updated_at: new Date() },
    });
  }
  if (status === "suspended") {
    await prisma.users.update({
      where: { id: profile.user_id },
      data: { account_status: "suspended", updated_at: new Date() },
    });
  }

  await log(profile.user_id, `profile_${status}`, rejection);

  revalidatePath(`/profiles/${id}`);
  revalidatePath("/profiles");
  revalidatePath("/photos");
}

export async function updatePhotoStatus(formData: FormData) {
  await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const photoStatus = String(formData.get("photo_status") || "").toLowerCase();
  const allowed = ["approved", "pending", "rejected"];
  if (!allowed.includes(photoStatus)) return;

  const profile = await prisma.profiles.findUnique({ where: { id } });
  if (!profile) return;

  await prisma.profiles.update({
    where: { id },
    data: {
      photo_status: photoStatus,
      updated_at: new Date(),
    },
  });
  await log(profile.user_id, `photo_${photoStatus}`, profile.photo_url);

  revalidatePath(`/profiles/${id}`);
  revalidatePath("/photos");
  revalidatePath("/profiles");
}

export async function toggleProfileHidden(formData: FormData) {
  await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const profile = await prisma.profiles.findUnique({ where: { id } });
  if (!profile) return;
  const next = !profile.is_hidden;
  await prisma.profiles.update({
    where: { id },
    data: { is_hidden: next, updated_at: new Date() },
  });
  await log(profile.user_id, next ? "profile_hidden" : "profile_unhidden");
  revalidatePath(`/profiles/${id}`);
  revalidatePath("/profiles");
}

export async function updateUserAccount(formData: FormData) {
  await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const account_status = String(formData.get("account_status") || "").toLowerCase();
  const plan = String(formData.get("plan") || "").toLowerCase();
  const email_verified = formData.get("email_verified") === "on";
  const sms_verified = formData.get("sms_verified") === "on";
  const cultural_verified = formData.get("cultural_verified") === "on";

  const data: {
    account_status?: string;
    plan?: string;
    email_verified?: boolean;
    sms_verified?: boolean;
    cultural_verified?: boolean;
    updated_at: Date;
  } = { updated_at: new Date() };

  if (["active", "suspended", "deleted"].includes(account_status)) {
    data.account_status = account_status;
  }
  if (["basic", "gold", "free"].includes(plan)) {
    data.plan = plan === "free" ? "basic" : plan;
  }
  data.email_verified = email_verified;
  data.sms_verified = sms_verified;
  data.cultural_verified = cultural_verified;

  await prisma.users.update({ where: { id }, data });
  const verificationNote = [
    email_verified ? "email" : null,
    sms_verified ? "sms" : null,
    cultural_verified ? "cultural" : null,
  ]
    .filter(Boolean)
    .join("+");
  await log(id, "user_account_updated", `${account_status}/${plan}${verificationNote ? ` verified:${verificationNote}` : ""}`);

  if (account_status === "suspended") {
    await prisma.profiles.updateMany({
      where: { user_id: id },
      data: { status: "suspended", updated_at: new Date() },
    });
  }

  revalidatePath(`/users/${id}`);
  revalidatePath("/users");
}

/** One-click block/unblock — toggles account_status without touching plan/credits. */
export async function toggleUserBlock(formData: FormData) {
  await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const user = await prisma.users.findUnique({ where: { id } });
  if (!user) return;

  const blocking = user.account_status !== "suspended";
  await prisma.users.update({
    where: { id },
    data: { account_status: blocking ? "suspended" : "active", updated_at: new Date() },
  });

  if (blocking) {
    await prisma.profiles.updateMany({
      where: { user_id: id },
      data: { status: "suspended", updated_at: new Date() },
    });
  }

  await log(id, blocking ? "user_blocked" : "user_unblocked");
  revalidatePath(`/users/${id}`);
  revalidatePath("/users");
  revalidatePath("/profiles");
}

async function nextLedgerId() {
  const max = await prisma.credit_ledger.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function adjustCredits(formData: FormData) {
  const id = BigInt(String(formData.get("id")));
  const requests = Number(formData.get("requests_remaining"));
  if (!Number.isFinite(requests)) return;

  const adminId = await currentAdminId();
  const user = await prisma.users.findUnique({ where: { id }, select: { requests_remaining: true } });
  const previousBalance = user?.requests_remaining ?? 0;
  const newBalance = Math.max(0, Math.floor(requests));

  await prisma.users.update({
    where: { id },
    data: { requests_remaining: newBalance, updated_at: new Date() },
  });

  await prisma.credit_ledger.create({
    data: {
      id: await nextLedgerId(),
      user_id: id,
      amount: newBalance - previousBalance,
      balance_type: "admin",
      reason: "admin_adjustment",
      admin_id: adminId,
      previous_balance: previousBalance,
      new_balance: newBalance,
      created_at: new Date(),
    },
  });

  await log(id, "credits_adjusted", `requests=${previousBalance}→${newBalance}`);
  revalidatePath(`/users/${id}`);
}

export async function addUserNote(formData: FormData) {
  const userId = BigInt(String(formData.get("user_id")));
  const note = String(formData.get("note") || "").trim();
  if (!note) return;
  const adminId = await currentAdminId();
  await prisma.admin_notes.create({
    data: {
      id: await nextNoteId(),
      user_id: userId,
      admin_id: adminId,
      note_text: note,
      created_at: new Date(),
    },
  });
  await log(userId, "admin_note", note.slice(0, 200));
  revalidatePath(`/users/${userId}`);
}

export async function resolveReport(formData: FormData) {
  await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const status = String(formData.get("status") || "resolved").toLowerCase();
  const allowed = ["open", "resolved", "dismissed"];
  if (!allowed.includes(status)) return;

  const report = await prisma.reports.update({
    where: { id },
    data: { status },
  });
  await log(report.reported_id, `report_${status}`, `report #${id}`);
  revalidatePath("/reports");
}

export async function reviewFlaggedMessage(formData: FormData) {
  await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const reviewed = formData.get("reviewed") !== "false";
  await prisma.flagged_messages.update({
    where: { id },
    data: { reviewed },
  });
  revalidatePath("/reports");
}

export async function warnUser(formData: FormData) {
  await currentAdminId();
  const userId = BigInt(String(formData.get("user_id")));
  await prisma.profiles.updateMany({
    where: { user_id: userId },
    data: { warn_count: { increment: 1 }, updated_at: new Date() },
  });
  await log(userId, "user_warned");
  revalidatePath(`/users/${userId}`);
  revalidatePath("/reports");
}

export async function endMatch(formData: FormData) {
  const requestId = BigInt(String(formData.get("request_id")));
  const adminId = await currentAdminId();

  await ensureMatchEndSchema();

  const match = await prisma.match_requests.findUnique({ where: { id: requestId } });
  if (!match) return;
  if (match.status !== "accepted") return;

  const now = new Date();
  await prisma.match_requests.update({
    where: { id: requestId },
    data: {
      status: "ended",
      ended_at: now,
      ended_by: adminId,
      end_reason: "admin",
      updated_at: now,
    },
  });

  await log(match.sender_id, "match_ended", `request #${requestId} by admin`);
  revalidatePath(`/chats/${requestId}`);
  revalidatePath("/chats");
  revalidatePath("/requests");
}

export async function removeMessage(formData: FormData) {
  const messageId = BigInt(String(formData.get("message_id")));
  const requestId = String(formData.get("request_id") || "");
  const reason = String(formData.get("reason") || "moderation").slice(0, 255);
  const adminId = await currentAdminId();

  const { ensureMessageRemovalsSchema } = await import("@/lib/ensure-message-removals");
  await ensureMessageRemovalsSchema();

  await prisma.$executeRaw`
    INSERT INTO message_removals (message_id, removed_by_admin_id, reason, removed_at)
    VALUES (${messageId}, ${adminId}, ${reason}, NOW())
    ON CONFLICT (message_id) DO NOTHING
  `;

  const msg = await prisma.messages.findUnique({ where: { id: messageId }, select: { sender_id: true } });
  await log(msg?.sender_id ?? null, "message_removed", `msg #${messageId}`);

  if (requestId) revalidatePath(`/chats/${requestId}`);
}

export async function saveAnnouncement(formData: FormData) {
  await currentAdminId();
  const idRaw = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const status = String(formData.get("status") || "draft").toLowerCase();
  const cta_label = String(formData.get("cta_label") || "");
  const cta_url = String(formData.get("cta_url") || "");
  if (!title) return;

  const now = new Date();
  if (idRaw) {
    await prisma.announcements.update({
      where: { id: BigInt(idRaw) },
      data: {
        title,
        body,
        status,
        cta_label,
        cta_url,
        publish_at: status === "published" ? now : null,
        updated_at: now,
      },
    });
  } else {
    await prisma.announcements.create({
      data: {
        id: await nextAnnouncementId(),
        title,
        body,
        status,
        cta_label,
        cta_url,
        type: "announcement",
        publish_at: status === "published" ? now : null,
        created_at: now,
        updated_at: now,
      },
    });
  }
  revalidatePath("/announcements");
}

export async function bulkApprovePending(formData: FormData) {
  await currentAdminId();
  const ids = formData.getAll("ids").map((v) => BigInt(String(v)));
  if (!ids.length) return;
  const profiles = await prisma.profiles.findMany({ where: { id: { in: ids } } });
  await prisma.profiles.updateMany({
    where: { id: { in: ids } },
    data: { status: "approved", rejection_reason: null, updated_at: new Date() },
  });
  for (const p of profiles) {
    await prisma.users.update({
      where: { id: p.user_id },
      data: { approved_at: new Date(), account_status: "active", updated_at: new Date() },
    });
    await log(p.user_id, "profile_approved", "bulk");
  }
  revalidatePath("/profiles");
}
