"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { callWebTokens, canManageBilling, loadTokenSettings } from "@/lib/billing";
import { ensureBillingSchema } from "@/lib/billing-schema";
import { getAdminStripe } from "@/lib/stripe";

async function nextModerationId() {
  const max = await prisma.moderation_log.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

async function audit(adminId: bigint, userId: bigint | null, action: string, note: string) {
  await prisma.moderation_log.create({
    data: { id: await nextModerationId(), admin_id: adminId, user_id: userId, action, note: note.slice(0, 1000), created_at: new Date() },
  });
}

async function requireBillingAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  if (!canManageBilling(session)) throw new Error("You are not authorised to change billing.");
  return { session, adminId: BigInt(session.adminId) };
}

function back(path: string, kind: "ok" | "error", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}#billing`);
}

/** Member detail → Billing & Usage: grant or remove tokens. A reason is mandatory. */
export async function adjustMemberTokens(formData: FormData) {
  const id = BigInt(String(formData.get("id")));
  const page = `/users/${id}`;
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  if (!canManageBilling(session)) back(page, "error", "You are not authorised to change Match Tokens.");
  const op = String(formData.get("op")) === "remove" ? "remove" : "grant";
  const amount = Math.floor(Number(formData.get("amount")));
  const reason = String(formData.get("reason") || "").trim();
  const expires = String(formData.get("expires") || "").trim();
  if (!(amount >= 1 && amount <= 100)) back(page, "error", "Amount must be between 1 and 100.");
  if (reason.length < 5) back(page, "error", "Give a reason (at least 5 characters) — it goes in the audit log.");

  const res = await callWebTokens(id, {
    op,
    amount,
    reason,
    adminId: session.adminId,
    expiresAt: op === "grant" && expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
  });
  if (!res.ok) back(page, "error", res.error || "Couldn't update tokens.");
  await audit(
    BigInt(session.adminId),
    id,
    op === "grant" ? "tokens_granted" : "tokens_removed",
    `${op === "grant" ? "+" : "-"}${op === "remove" ? res.removed ?? amount : amount}: ${reason}`
  );
  revalidatePath(page);
  back(
    page,
    "ok",
    op === "grant"
      ? `Granted ${amount} token${amount === 1 ? "" : "s"}. New balance ${res.balance}.`
      : `Removed ${res.removed} token${res.removed === 1 ? "" : "s"}${res.removed! < amount ? " (that was all they had)" : ""}. New balance ${res.balance}.`
  );
}

/** Admin → Billing → Token settings. A changed top-up pack is synced to Stripe before saving. */
export async function updateTokenSettings(formData: FormData) {
  const { adminId } = await requireBillingAdmin().catch((err) => back("/billing", "error", err.message));
  await ensureBillingSchema();
  const int = (name: string, min: number, max: number) => {
    const v = Math.floor(Number(formData.get(name)));
    if (!Number.isFinite(v) || v < min || v > max) back("/billing", "error", `${name.replace(/_/g, " ")} must be between ${min} and ${max}.`);
    return v;
  };
  const next = {
    basic_monthly: int("basic_monthly", 0, 100),
    gold_monthly: int("gold_monthly", 0, 200),
    rollover_enabled: formData.get("rollover_enabled") === "on",
    rollover_max: int("rollover_max", 0, 200),
    rollover_cycles: int("rollover_cycles", 1, 12),
    gold_max_total: int("gold_max_total", 0, 400),
    topup_tokens: int("topup_tokens", 1, 100),
    topup_price_pence: Math.round(Number(formData.get("topup_price")) * 100),
    grace_days: int("grace_days", 0, 30),
    reminder_days: int("reminder_days", 0, 30),
  };
  if (!(next.topup_price_pence >= 50 && next.topup_price_pence <= 100000)) back("/billing", "error", "Top-up price must be between £0.50 and £1,000.");
  if (next.gold_max_total < next.gold_monthly) back("/billing", "error", "Gold maximum must be at least the Gold monthly allowance.");

  const current = await loadTokenSettings();
  let priceId = current.topup_price_id;
  let stripeNote = "";
  if (next.topup_price_pence !== current.topup_price_pence || next.topup_tokens !== current.topup_tokens || !priceId) {
    const stripe = getAdminStripe();
    if (!stripe) back("/billing", "error", "Stripe isn't configured on the admin app, so the top-up pack can't be changed.");
    // Prices are immutable: create the new one first, save it, and only then retire the old one,
    // so there is never a moment where checkout has no valid price.
    const oldId = priceId || process.env.STRIPE_TOPUP_PRICE_ID || null;
    let productId = process.env.STRIPE_TOPUP_PRODUCT_ID || "";
    if (!productId && oldId) {
      const old = await stripe.prices.retrieve(oldId).catch(() => null);
      productId = (typeof old?.product === "string" ? old.product : old?.product?.id) || "";
    }
    if (!productId) {
      const product = await stripe.products.create({ name: "Match Tokens top-up", metadata: { pn: "topup" } });
      productId = product.id;
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: "gbp",
      unit_amount: next.topup_price_pence,
      nickname: `${next.topup_tokens} Match Tokens`,
      metadata: { pn: "topup", tokens: String(next.topup_tokens) },
    });
    priceId = price.id;
    stripeNote = ` Stripe price ${price.id} created`;
    await saveSettings(next, priceId, adminId);
    if (oldId && oldId !== price.id) {
      await stripe.prices.update(oldId, { active: false }).catch(() => undefined);
      stripeNote += `, ${oldId} archived`;
    }
  } else {
    await saveSettings(next, priceId, adminId);
  }

  await audit(
    adminId,
    null,
    "token_settings_updated",
    `basic ${next.basic_monthly}, gold ${next.gold_monthly}, rollover ${next.rollover_enabled ? `${next.rollover_max}×${next.rollover_cycles}` : "off"}, max ${next.gold_max_total}, top-up ${next.topup_tokens} for £${(next.topup_price_pence / 100).toFixed(2)}, grace ${next.grace_days}d, reminders ${next.reminder_days}d.${stripeNote}`
  );
  revalidatePath("/billing");
  revalidatePath("/settings");
  back("/billing", "ok", `Token settings saved.${stripeNote}`);
}

async function saveSettings(
  s: {
    basic_monthly: number;
    gold_monthly: number;
    rollover_enabled: boolean;
    rollover_max: number;
    rollover_cycles: number;
    gold_max_total: number;
    topup_tokens: number;
    topup_price_pence: number;
    grace_days: number;
    reminder_days: number;
  },
  priceId: string | null,
  adminId: bigint
) {
  await prisma.$executeRaw`
    UPDATE token_settings SET
      basic_monthly = ${s.basic_monthly}, gold_monthly = ${s.gold_monthly}, rollover_enabled = ${s.rollover_enabled},
      rollover_max = ${s.rollover_max}, rollover_cycles = ${s.rollover_cycles}, gold_max_total = ${s.gold_max_total},
      topup_tokens = ${s.topup_tokens}, topup_price_pence = ${s.topup_price_pence}, topup_price_id = ${priceId},
      grace_days = ${s.grace_days}, reminder_days = ${s.reminder_days}, updated_at = NOW(), updated_by = ${adminId}
    WHERE id = 1
  `;
  // Keep plan_settings (read by older screens) in step with the token rules.
  const goldRollover = s.rollover_enabled ? Math.min(s.rollover_max, Math.max(0, s.gold_max_total - s.gold_monthly)) : 0;
  await prisma.plan_settings.updateMany({
    where: { plan: "free" },
    data: { monthly_credits: s.basic_monthly, rollover_cap: 0, max_balance: s.basic_monthly, updated_at: new Date() },
  });
  await prisma.plan_settings.updateMany({
    where: { plan: "gold" },
    data: { monthly_credits: s.gold_monthly, rollover_cap: goldRollover, max_balance: s.gold_max_total, updated_at: new Date() },
  });
}

export async function resolveAlert(formData: FormData) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authenticated");
  const id = BigInt(String(formData.get("id")));
  await prisma.$executeRaw`UPDATE admin_alerts SET resolved_at = NOW(), resolved_by = ${BigInt(session.adminId)} WHERE id = ${id}`;
  await audit(BigInt(session.adminId), null, "billing_alert_resolved", `alert #${id}`);
  revalidatePath("/billing");
}
