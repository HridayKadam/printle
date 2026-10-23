import type { JobDoc } from "./job";
import { jobTotals } from "./job";
import type { PrintSettings } from "./printSettings";

export interface Rates {
  /** Price per printed side. */
  bw: number | null;
  color: number | null;
  /** Flat extra for binding, lamination, etc. */
  extras: number | null;
  currency: string;
}

export const EMPTY_RATES: Rates = { bw: null, color: null, extras: null, currency: "₹" };

export type Estimate =
  | { ok: true; total: number; impressions: number; rate: number; extras: number; currency: string }
  | { ok: false; reason: "no-rate" | "unknown-pages" | "no-docs" };

export function estimateCost(docs: JobDoc[], settings: PrintSettings, rates: Rates): Estimate {
  if (docs.length === 0) return { ok: false, reason: "no-docs" };
  const rate = settings.color === "color" ? rates.color : rates.bw;
  if (rate === null || !Number.isFinite(rate) || rate < 0) return { ok: false, reason: "no-rate" };
  const totals = jobTotals(docs, settings);
  if (!totals.pagesKnown) return { ok: false, reason: "unknown-pages" };
  const extras = rates.extras && rates.extras > 0 ? rates.extras : 0;
  const total = round2(totals.impressions * rate + extras);
  return { ok: true, total, impressions: totals.impressions, rate, extras, currency: rates.currency };
}

export function formatMoney(amount: number, currency: string): string {
  const fixed = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
  return `${currency}${fixed}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
