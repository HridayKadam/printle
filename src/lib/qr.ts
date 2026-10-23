import type { CountryCode } from "libphonenumber-js";
import { DEFAULT_REGION } from "@/config/app";
import { extractPhoneCandidates, interpretNumber, type PhoneCandidate } from "./phone";

export interface QrResult {
  candidates: PhoneCandidate[];
  /** Shop name from a Printle shop QR (reserved for a future shop ordering flow). */
  shopName?: string;
  source: "printle" | "whatsapp" | "tel" | "upi" | "text";
  note?: string;
}

/**
 * Interpret a scanned QR payload. Never navigates anywhere: unknown links are
 * reported back so the user decides what to do.
 */
export function parseQrPayload(payload: string, region: CountryCode = DEFAULT_REGION): QrResult | null {
  const text = payload.trim();
  let url: URL | null = null;
  try {
    url = new URL(text);
  } catch {
    url = null;
  }

  if (url) {
    const host = url.hostname.replace(/^www\./, "");
    // Printle shop code: printle:shop?phone=+91...&name=... or https://<app>/shop/?phone=...
    if (url.protocol === "printle:" || (url.pathname.replace(/\/$/, "").endsWith("/shop") && url.searchParams.has("phone"))) {
      const c = one(url.searchParams.get("phone"), region);
      return c ? { candidates: [c], shopName: url.searchParams.get("name") || undefined, source: "printle" } : null;
    }
    if (host === "wa.me") {
      return wrap(one(`+${url.pathname.replace(/\D/g, "")}`, region), "whatsapp");
    }
    if (host === "api.whatsapp.com" || url.protocol === "whatsapp:") {
      const phone = url.searchParams.get("phone");
      return wrap(phone ? one(`+${phone.replace(/\D/g, "")}`, region) : null, "whatsapp");
    }
    if (url.protocol === "tel:") return wrap(one(decodeURIComponent(url.pathname), region), "tel");
    if (url.protocol === "upi:") {
      // Many UPI IDs are the owner's mobile number: 9876543210@ybl
      const local = (url.searchParams.get("pa") || "").split("@")[0];
      const c = /^\d{10}$/.test(local) ? interpretNumber(local, "IN") : null;
      if (!c) return null;
      return {
        candidates: [{ ...c, confidence: "low" }],
        shopName: url.searchParams.get("pn") || undefined,
        source: "upi",
        note: "Read from a payment QR. Check this is the shop's WhatsApp number.",
      };
    }
    return null;
  }

  const candidates = extractPhoneCandidates(text, region);
  return candidates.length ? { candidates, source: "text" } : null;
}

function one(input: string | null, region: CountryCode): PhoneCandidate | null {
  if (!input) return null;
  return interpretNumber(input, region);
}

function wrap(c: PhoneCandidate | null, source: QrResult["source"]): QrResult | null {
  return c ? { candidates: [c], source } : null;
}
