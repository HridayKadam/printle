import { describe, expect, it } from "vitest";
import { extractPhoneCandidates } from "../phone";
import { parseQrPayload } from "../qr";
import { ScanStabilizer } from "../scanStabilizer";

const frame = (text: string) => extractPhoneCandidates(text);

describe("ScanStabilizer", () => {
  it("waits for a number to appear in two frames", () => {
    const s = new ScanStabilizer();
    expect(s.push(frame("98765 43210"))).toBeNull();
    expect(s.push(frame("nothing here"))).toBeNull();
    expect(s.push(frame("98765 43210"))?.[0].e164).toBe("+919876543210");
  });

  it("ignores one-off misreads", () => {
    const s = new ScanStabilizer();
    expect(s.push(frame("98765 43219"))).toBeNull();
    expect(s.push(frame("98765 43210"))).toBeNull();
    expect(s.push(frame("98765 43210"))?.[0].e164).toBe("+919876543210");
  });

  it("emits once, then stays locked so only one dialog opens", () => {
    const s = new ScanStabilizer();
    s.push(frame("98765 43210"));
    expect(s.push(frame("98765 43210"))).not.toBeNull();
    expect(s.push(frame("98765 43210"))).toBeNull();
    expect(s.push(frame("91234 56789"))).toBeNull();
    s.reset();
    s.push(frame("91234 56789"));
    expect(s.push(frame("91234 56789"))?.[0].e164).toBe("+919123456789");
  });

  it("offers other numbers seen alongside the stable one, stable first", () => {
    const s = new ScanStabilizer();
    s.push(frame("98765 43210 / 91234 56789"));
    const r = s.push(frame("98765 43210"));
    expect(r?.map((c) => c.e164)).toEqual(["+919876543210", "+919123456789"]);
  });
});

describe("parseQrPayload", () => {
  it("reads WhatsApp links", () => {
    expect(parseQrPayload("https://wa.me/919876543210")?.candidates[0].e164).toBe("+919876543210");
    expect(parseQrPayload("https://api.whatsapp.com/send?phone=919876543210&text=hi")?.source).toBe("whatsapp");
  });

  it("reads tel: links", () => {
    expect(parseQrPayload("tel:+919876543210")?.candidates[0].e164).toBe("+919876543210");
  });

  it("reads Printle shop codes, including the shop name", () => {
    const r = parseQrPayload("printle:shop?phone=%2B919876543210&name=Sharma%20Xerox");
    expect(r).toMatchObject({ source: "printle", shopName: "Sharma Xerox" });
    expect(r?.candidates[0].e164).toBe("+919876543210");
  });

  it("reads a mobile-number UPI ID but flags it for checking", () => {
    const r = parseQrPayload("upi://pay?pa=9876543210@ybl&pn=Sharma%20Xerox");
    expect(r?.candidates[0]).toMatchObject({ e164: "+919876543210", confidence: "low" });
    expect(r?.note).toMatch(/payment QR/);
  });

  it("ignores unrelated QR codes without navigating", () => {
    expect(parseQrPayload("https://example.com/menu")).toBeNull();
    expect(parseQrPayload("upi://pay?pa=sharmaxerox@okhdfc")).toBeNull();
  });
});
