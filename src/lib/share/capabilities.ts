export type Platform = "android" | "ios" | "desktop";

export interface ShareCapabilities {
  platform: Platform;
  /** navigator.share accepts these files (Web Share Level 2). */
  canShareFiles: boolean;
  canShareText: boolean;
  canCopy: boolean;
}

type NavLike = Pick<Navigator, "userAgent"> & Partial<Pick<Navigator, "share" | "canShare" | "clipboard" | "maxTouchPoints">>;

export function detectPlatform(nav: NavLike): Platform {
  const ua = nav.userAgent || "";
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as Mac; touch points give it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1)) return "ios";
  return "desktop";
}

export function detectCapabilities(files: File[], nav: NavLike = navigator): ShareCapabilities {
  const canShareText = typeof nav.share === "function";
  let canShareFiles = false;
  if (canShareText && typeof nav.canShare === "function") {
    try {
      const probe = files.length ? files : [new File(["probe"], "probe.pdf", { type: "application/pdf" })];
      canShareFiles = nav.canShare({ files: probe });
    } catch {
      canShareFiles = false;
    }
  }
  return {
    platform: detectPlatform(nav),
    canShareFiles,
    canShareText,
    canCopy: !!nav.clipboard?.writeText || typeof document !== "undefined",
  };
}
