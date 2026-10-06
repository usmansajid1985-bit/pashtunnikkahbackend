"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { ensureMatchEndSchema } from "@/lib/ensure-match-end-schema";
import { notifyMemberWarning, notifyProfileStatus } from "@/lib/notify-web";

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
  // N08: push + bell + live update for the member — only on an actual change, so re-saving an
  // already-approved profile doesn't send "approved" again.
  if (profile.status !== status) await notifyProfileStatus(profile.user_id, status);

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
  // Keep the member's main photo row in step (the web app reads per-photo status for sharing).
  await prisma.$executeRaw`
    UPDATE profile_photos SET status = ${photoStatus}, updated_at = NOW()
    WHERE user_id = ${profile.user_id} AND is_main = TRUE
  `.catch(() => undefined);
  await log(profile.user_id, `photo_${photoStatus}`, profile.photo_url);

  revalidatePath(`/profiles/${id}`);
  revalidatePath("/photos");
  revalidatePath("/profiles");
}

/**
 * Approve / reject ONE of a member's (up to 3) photos. Until this existed only the main photo
 * could be reviewed, so a second or third photo stayed "pending" forever and could never be shared.
 */
export async function reviewMemberPhoto(formData: FormData) {
  await currentAdminId();
  const photoId = BigInt(String(formData.get("photo_id")));
  const status = String(formData.get("photo_status") || "").toLowerCase();
  if (!["approved", "rejected"].includes(status)) return;

  const rows = await prisma.$queryRaw<{ user_id: bigint; url: string; is_main: boolean }[]>`
    UPDATE profile_photos SET status = ${status}, updated_at = NOW()
    WHERE id = ${photoId}
    RETURNING user_id, url, is_main
  `;
  const photo = rows[0];
  if (!photo) return;

  // The main photo also drives `profiles.photo_status`, which Browse and the rest of the app read.
  const profile = await prisma.profiles.findUnique({ where: { user_id: photo.user_id }, select: { id: true } });
  if (photo.is_main && profile) {
    await prisma.profiles.update({
      where: { id: profile.id },
      data: { photo_status: status, updated_at: new Date() },
    });
  }
  await log(photo.user_id, `photo_${status}`, photo.url);

  if (profile) revalidatePath(`/profiles/${profile.id}`);
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

/**
 * A03: one decision per report, each recorded with the admin, action, reason and time.
 *  - resolved  → reviewed and actioned
 *  - dismissed → closed with no action against the member
 *  - warned    → formal warning sent to the reported member (shown in their account + push)
 *  - open      → reopen
 */
export async function decideReport(formData: FormData) {
  const adminId = await currentAdminId();
  const id = BigInt(String(formData.get("id")));
  const decision = String(formData.get("decision") || "").toLowerCase();
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || null;
  if (!["resolved", "dismissed", "warned", "open"].includes(decision)) return;
  if (decision === "warned" && !note) return; // the warning text is what the member reads

  const report = await prisma.reports.findUnique({ where: { id } });
  if (!report) return;

  if (decision === "warned") {
    const rows = await prisma.$queryRaw<{ id: bigint }[]>`
      INSERT INTO member_warnings (user_id, report_id, admin_id, message)
      VALUES (${report.reported_id}, ${id}, ${adminId}, ${note})
      RETURNING id
    `;
    await prisma.profiles.updateMany({
      where: { user_id: report.reported_id },
      data: { warn_count: { increment: 1 }, updated_at: new Date() },
    });
    await notifyMemberWarning(report.reported_id, rows[0]?.id ?? null);
  }

  await prisma.reports.update({
    where: { id },
    data:
      decision === "open"
        ? { status: "open", resolution: null, resolution_note: null, resolved_at: null, resolved_by: null }
        : {
            status: decision === "dismissed" ? "dismissed" : "resolved",
            resolution: decision,
            resolution_note: note,
            resolved_at: new Date(),
            resolved_by: adminId,
          },
  });
  await log(
    report.reported_id,
    decision === "warned" ? "user_warned" : `report_${decision}`,
    `report #${id}${note ? ` — ${note}` : ""}`
  );
  revalidatePath("/reports");
  revalidatePath(`/users/${report.reported_id}`);
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

const DEFAULT_WARNING =
  "Please keep your conversations respectful and within the Pashtun Nikah community guidelines. Further reports may lead to your account being restricted.";

/** A03: a real warning — stored, shown in the member's account, pushed, and logged. */
export async function warnUser(formData: FormData) {
  const adminId = await currentAdminId();
  const userId = BigInt(String(formData.get("user_id")));
  const note = String(formData.get("note") || "").trim().slice(0, 1000) || DEFAULT_WARNING;
  const rows = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO member_warnings (user_id, admin_id, message)
    VALUES (${userId}, ${adminId}, ${note})
    RETURNING id
  `;
  await prisma.profiles.updateMany({
    where: { user_id: userId },
    data: { warn_count: { increment: 1 }, updated_at: new Date() },
  });
  await notifyMemberWarning(userId, rows[0]?.id ?? null);
  await log(userId, "user_warned", note);
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
    if (p.status !== "approved") await notifyProfileStatus(p.user_id, "approved");
  }
  revalidatePath("/profiles");
}
