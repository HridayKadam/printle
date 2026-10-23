/**
 * MOCKS: navigator.share / navigator.canShare / clipboard are mocked here.
 * Real share sheets and WhatsApp can't run in a test environment.
 */
import { describe, expect, it, vi } from "vitest";
import { copyText, openExternal, shareFiles, smsUrl, whatsappChatUrl } from "../share/actions";
import { detectCapabilities, detectPlatform } from "../share/capabilities";
import { getMethod } from "../share/methods";

const pdf = () => new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";

describe("links", () => {
  it("builds a wa.me direct-chat link with an encoded message", () => {
    expect(whatsappChatUrl("919876543210", "Hi! A4 & B/W")).toBe("https://wa.me/919876543210?text=Hi!%20A4%20%26%20B%2FW");
    expect(whatsappChatUrl("+91 98765-43210")).toBe("https://wa.me/919876543210");
  });

  it("uses the right SMS body separator per platform", () => {
    expect(smsUrl("+919876543210", "hi", "ios")).toBe("sms:+919876543210&body=hi");
    expect(smsUrl("+919876543210", "hi", "android")).toBe("sms:+919876543210?body=hi");
  });

  it("opens links in a new context so this tab keeps its files", () => {
    const clicks: HTMLAnchorElement[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });
    openExternal("https://wa.me/919876543210");
    expect(clicks[0].target).toBe("_blank");
    expect(clicks[0].rel).toContain("noopener");
    spy.mockRestore();
  });
});

describe("capabilities", () => {
  it("detects platforms", () => {
    expect(detectPlatform({ userAgent: ANDROID })).toBe("android");
    expect(detectPlatform({ userAgent: IPHONE })).toBe("ios");
    expect(detectPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe("ios");
    expect(detectPlatform({ userAgent: DESKTOP })).toBe("desktop");
  });

  it("reports file sharing only when canShare accepts files", () => {
    expect(detectCapabilities([pdf()], { userAgent: ANDROID, share: vi.fn(), canShare: () => true }).canShareFiles).toBe(true);
    expect(detectCapabilities([pdf()], { userAgent: DESKTOP, share: vi.fn(), canShare: () => false }).canShareFiles).toBe(false);
    expect(detectCapabilities([pdf()], { userAgent: DESKTOP }).canShareText).toBe(false);
  });

  it("treats a throwing canShare as unsupported", () => {
    const caps = detectCapabilities([pdf()], { userAgent: ANDROID, share: vi.fn(), canShare: () => { throw new TypeError(); } });
    expect(caps.canShareFiles).toBe(false);
  });
});

describe("shareFiles outcomes", () => {
  it("hands off when the share sheet completes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareFiles([pdf()], {}, { share, canShare: () => true })).toEqual({ status: "handed-off" });
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it("is unsupported when the Share API is missing", async () => {
    expect(await shareFiles([pdf()], {}, {})).toEqual({ status: "unsupported" });
  });

  it("reports cancellation without claiming anything was sent", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"));
    expect(await shareFiles([pdf()], {}, { share, canShare: () => true })).toEqual({ status: "cancelled" });
  });

  it("retries with files only when text + files is rejected", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn((d: ShareData) => !d.text);
    expect(await shareFiles([pdf()], { text: "hi" }, { share, canShare })).toEqual({ status: "handed-off" });
    expect(share.mock.calls[0][0].text).toBeUndefined();
  });

  it("is unsupported when no target accepts the files", async () => {
    expect(await shareFiles([pdf()], {}, { share: vi.fn(), canShare: () => false })).toEqual({ status: "unsupported" });
  });

  it("explains a share that is already open (repeated taps)", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("busy", "InvalidStateError"));
    const r = await shareFiles([pdf()], {}, { share, canShare: () => true });
    expect(r.status).toBe("failed");
  });
});

describe("share methods", () => {
  const caps = (over: object) => ({ platform: "android" as const, canShareFiles: true, canShareText: true, canCopy: true, ...over });

  it("WhatsApp: open chat, then share files where file sharing works", () => {
    expect(getMethod("whatsapp").steps(caps({}))).toEqual(["open-chat", "share-files"]);
  });

  it("WhatsApp falls back to saving files when sharing is unavailable", () => {
    const desktop = caps({ platform: "desktop", canShareFiles: false, canShareText: false });
    expect(getMethod("whatsapp").steps(desktop)).toEqual(["open-chat", "download-files"]);
    expect(getMethod("whatsapp").explain(desktop)).toMatch(/drag/i);
  });

  it("hides 'Other app' when there is no compatible sharing target", () => {
    expect(getMethod("share-sheet").available(caps({ canShareFiles: false, canShareText: false }))).toBe(false);
  });
});

describe("copyText", () => {
  it("uses the clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await copyText("+919876543210", { clipboard: { writeText } as unknown as Clipboard })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("+919876543210");
  });

  it("falls back to execCommand when the clipboard API fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    document.execCommand = vi.fn(() => true);
    expect(await copyText("x", { clipboard: { writeText } as unknown as Clipboard })).toBe(true);
  });
});
