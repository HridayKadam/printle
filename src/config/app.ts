import type { CountryCode } from "libphonenumber-js";

/** Product-level configuration. Override with NEXT_PUBLIC_* env vars at build time. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Printle";
export const APP_TAGLINE =
  process.env.NEXT_PUBLIC_APP_TAGLINE ||
  "Scan the number at any print shop, pick your files, and send them on WhatsApp.";
export const DEFAULT_REGION = (process.env.NEXT_PUBLIC_DEFAULT_REGION || "IN") as CountryCode;

export const LIMITS = {
  /** Per-file limit. Share sheets hold files in memory, so very large files fail unpredictably. */
  maxFileBytes: 100 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  maxFiles: 20,
  maxCopies: 99,
} as const;

/** Storage keys are namespaced so a rename of the app never collides with old data. */
export const STORAGE_KEYS = {
  session: "printle.session.v1",
  shops: "printle.shops.v1",
  prefs: "printle.prefs.v1",
  theme: "printle.theme",
} as const;
