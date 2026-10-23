import {
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/max";
import { DEFAULT_REGION } from "@/config/app";

export type PhoneKind = "mobile" | "landline" | "other";
export type Confidence = "high" | "medium" | "low";

export interface PhoneCandidate {
  /** E.164, e.g. +919876543210 */
  e164: string;
  /** Human format, e.g. +91 98765 43210 */
  display: string;
  country?: CountryCode;
  kind: PhoneKind;
  confidence: Confidence;
  /** The text the number was read from, before normalization. */
  raw: string;
  /** True when OCR look-alikes (O→0, l→1) were replaced to read this number. */
  corrected: boolean;
  /** Digits only, for wa.me links (no plus, no leading zeros). */
  waDigits: string;
}

// OCR commonly confuses these letters with digits. We only substitute inside
// tokens that are already mostly digits, never in ordinary words.
const CONFUSABLES: Record<string, string> = { O: "0", o: "0", D: "0", I: "1", l: "1", "|": "1" };

const FULLWIDTH_DIGITS = /[０-９]/g;
const DASHES = /[‐-―−]/g;

function normalizeText(text: string): string {
  return text
    .replace(FULLWIDTH_DIGITS, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(DASHES, "-")
    .replace(/ /g, " ");
}

/** Replace look-alike characters inside digit-dominated tokens. Returns text and whether anything changed. */
export function correctConfusables(text: string): { text: string; corrected: boolean } {
  let corrected = false;
  const out = text.replace(/\S+/g, (token) => {
    const digits = (token.match(/\d/g) || []).length;
    const look = [...token].filter((c) => c in CONFUSABLES).length;
    const alnum = (token.match(/[A-Za-z0-9|]/g) || []).length;
    if (look === 0 || digits < 2 || (digits + look) / alnum < 0.75) return token;
    corrected = true;
    return [...token].map((c) => CONFUSABLES[c] ?? c).join("");
  });
  return { text: out, corrected };
}

function kindOf(p: PhoneNumber): PhoneKind {
  const t = p.getType();
  if (t === "MOBILE" || t === "FIXED_LINE_OR_MOBILE") return "mobile";
  if (t === "FIXED_LINE") return "landline";
  return "other";
}

function toCandidate(p: PhoneNumber, raw: string, confidence: Confidence, corrected: boolean): PhoneCandidate {
  return {
    e164: p.number,
    display: p.formatInternational(),
    country: p.country,
    kind: kindOf(p),
    confidence,
    raw: raw.trim(),
    corrected,
    waDigits: p.number.replace(/^\+/, ""),
  };
}

function isJunkDigits(digits: string): boolean {
  // 9999999999, 0000000000 and similar are valid by pattern but never real shop numbers.
  return /^(\d)\1+$/.test(digits.replace(/^(91|0)/, ""));
}

/**
 * Interpret a single digit string as a phone number. Returns null when the
 * string is not a valid number or is too ambiguous to propose at all.
 */
export function interpretNumber(
  raw: string,
  region: CountryCode = DEFAULT_REGION,
  corrected = false,
): PhoneCandidate | null {
  const hasPlus = /^\s*\(?\s*\+/.test(raw);
  const digits = raw.replace(/\D/g, "");
  // E.164 allows 15 digits; +2 leaves room for a written 00 international prefix.
  if (digits.length < 7 || digits.length > 17) return null;
  if (isJunkDigits(digits)) return null;

  const tryParse = (input: string, r?: CountryCode) => {
    const p = parsePhoneNumberFromString(input, r);
    return p && p.isValid() ? p : null;
  };

  if (hasPlus) {
    const p = tryParse(`+${digits}`);
    return p ? toCandidate(p, raw, corrected ? "medium" : "high", corrected) : null;
  }
  // International dialling prefix, e.g. 0091 98765 43210 or 00971 50 123 4567
  if (digits.startsWith("00")) {
    const p = tryParse(`+${digits.slice(2)}`);
    return p ? toCandidate(p, raw, corrected ? "medium" : "high", corrected) : null;
  }

  if (region === "IN") {
    // 10-digit mobile: 6/7/8/9 followed by 9 digits.
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      const p = tryParse(digits, "IN");
      return p ? toCandidate(p, raw, corrected ? "medium" : "high", corrected) : null;
    }
    // Trunk prefix: 0 98765 43210 (mobile) or 022 2654 3210 (landline with STD code).
    if (digits.length === 11 && digits.startsWith("0")) {
      const p = tryParse(digits, "IN");
      return p ? toCandidate(p, raw, corrected ? "medium" : "high", corrected) : null;
    }
    // Country code without plus: 91 98765 43210. Only accept when the rest is a valid mobile.
    if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
      const p = tryParse(`+${digits}`);
      return p ? toCandidate(p, raw, corrected ? "medium" : "high", corrected) : null;
    }
    // 10 digits starting 0-5 without a trunk zero could be a landline missing its 0,
    // a reference number or an invoice ID. Too ambiguous to propose.
    return null;
  }

  const p = tryParse(digits, region);
  return p ? toCandidate(p, raw, corrected ? "low" : "medium", corrected) : null;
}

// A run of characters that can make up a written phone number.
const RUN = /\+?\(?\+?\d[\d\s().-]*\d/g;

/**
 * Split a run like "98765 43210 97654 32109" into the valid numbers it contains.
 * Greedy: at each group, take the longest span of groups that forms a valid number.
 */
function splitRun(run: string, region: CountryCode, corrected: boolean): PhoneCandidate[] {
  const groups = run.split(/\s+/).filter(Boolean);
  const found: PhoneCandidate[] = [];
  let i = 0;
  while (i < groups.length) {
    let match: { c: PhoneCandidate; end: number } | null = null;
    for (let j = groups.length; j > i; j--) {
      const span = groups.slice(i, j).join(" ");
      const digits = span.replace(/\D/g, "");
      if (digits.length < 7) break;
      if (digits.length > 15) continue;
      const c = interpretNumber(span, region, corrected);
      if (c) {
        match = { c, end: j };
        break;
      }
    }
    if (match) {
      found.push(match.c);
      i = match.end;
    } else {
      // A single group with no spaces may still hold two numbers glued together (20 digits).
      const digits = groups[i].replace(/\D/g, "");
      if (digits.length === 20) {
        for (const half of [digits.slice(0, 10), digits.slice(10)]) {
          const c = interpretNumber(half, region, corrected);
          if (c) found.push({ ...c, raw: groups[i], confidence: "low" });
        }
      }
      i++;
    }
  }
  return found;
}

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
const KIND_RANK: Record<PhoneKind, number> = { mobile: 0, landline: 1, other: 2 };

export function rankCandidates(list: PhoneCandidate[]): PhoneCandidate[] {
  return [...list].sort(
    (a, b) =>
      CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind],
  );
}

/** Extract all plausible phone numbers from free text (OCR output, pasted text). */
export function extractPhoneCandidates(
  text: string,
  region: CountryCode = DEFAULT_REGION,
): PhoneCandidate[] {
  const { text: fixed, corrected } = correctConfusables(normalizeText(text));
  const originalHadRun = (run: string) => normalizeText(text).includes(run);
  const byNumber = new Map<string, PhoneCandidate>();
  for (const line of fixed.split(/\n|[/,;]| or /i)) {
    for (const m of line.matchAll(RUN)) {
      const run = m[0];
      const wasCorrected = corrected && !originalHadRun(run);
      for (const c of splitRun(run, region, wasCorrected)) {
        const prev = byNumber.get(c.e164);
        if (!prev || CONFIDENCE_RANK[c.confidence] < CONFIDENCE_RANK[prev.confidence]) {
          byNumber.set(c.e164, c);
        }
      }
    }
  }
  return rankCandidates([...byNumber.values()]);
}

export type ManualParseResult =
  | { ok: true; candidate: PhoneCandidate; warning?: string }
  | { ok: false; error: string };

/** Validate a number the user typed. Stricter messaging than OCR: we explain what is wrong. */
export function parseManualNumber(input: string, region: CountryCode = DEFAULT_REGION): ManualParseResult {
  const digits = input.replace(/\D/g, "");
  if (!digits) return { ok: false, error: "Enter the shop's phone number." };
  if (digits.length < 8) return { ok: false, error: "That number looks too short." };
  if (digits.length > 15) return { ok: false, error: "That number looks too long." };
  const c = interpretNumber(input, region);
  if (!c) {
    if (region === "IN" && digits.length === 10 && !/^[6-9]/.test(digits)) {
      return { ok: false, error: "Indian mobile numbers start with 6, 7, 8 or 9. For a landline, include the 0 and STD code." };
    }
    return { ok: false, error: "That doesn't look like a valid phone number. Check the digits or add the country code (e.g. +44)." };
  }
  const candidate = { ...c, confidence: "high" as const };
  if (c.kind === "landline") {
    return { ok: true, candidate, warning: "This looks like a landline. Landlines usually can't receive WhatsApp messages." };
  }
  return { ok: true, candidate };
}
