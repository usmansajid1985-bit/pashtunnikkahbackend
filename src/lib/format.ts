export function fmtDate(d?: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtShortDate(d?: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function moneyPence(pence?: number | null) {
  if (pence == null) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Per-payment display: unlike moneyPence (used for aggregate/summed totals, which are always
 * reported in GBP), an individual payment/subscription row must show its own transaction
 * currency — PN-BACKEND-001: a $10 USD sandbox payment was shown as £10.00 because the admin UI
 * hardcoded the £ symbol regardless of what currency the charge actually was.
 */
export function moneyWithCurrency(pence?: number | null, currency?: string | null) {
  if (pence == null) return "—";
  const code = (currency || "gbp").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(pence / 100);
  } catch {
    return `${code} ${(pence / 100).toFixed(2)}`;
  }
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}
