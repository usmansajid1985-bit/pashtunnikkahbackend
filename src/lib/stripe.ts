import Stripe from "stripe";

export function getAdminStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
  });
}

export function stripeConfig() {
  return {
    configured: Boolean(process.env.STRIPE_SECRET_KEY),
    productId: process.env.STRIPE_GOLD_PRODUCT_ID || "prod_V1qiv1dlHdfIAF",
    priceId: process.env.STRIPE_GOLD_PRICE_ID || "",
    mode: (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live") ? "live" : "test",
  };
}
