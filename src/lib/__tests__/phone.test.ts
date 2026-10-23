import { describe, expect, it } from "vitest";
import { correctConfusables, extractPhoneCandidates, interpretNumber, parseManualNumber } from "../phone";

describe("Indian number normalization", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["(+91) 98765 43210", "+919876543210"],
    ["91 98765 43210", "+919876543210"],
    ["098765 43210", "+919876543210"],
    ["0091 98765 43210", "+919876543210"],
  ])("%s → %s", (input, e164) => {
    const c = interpretNumber(input, "IN");
    expect(c?.e164).toBe(e164);
    expect(c?.kind).toBe("mobile");
    expect(c?.confidence).toBe("high");
    expect(c?.waDigits).toBe(e164.slice(1));
  });

  it("formats for display", () => {
    expect(interpretNumber("9876543210", "IN")?.display).toBe("+91 98765 43210");
  });

  it("recognises landlines written with an STD code", () => {
    const c = interpretNumber("022-2654 3210", "IN");
    expect(c?.e164).toBe("+912226543210");
    expect(c?.kind).toBe("landline");
  });

  it("keeps international numbers that have a + prefix", () => {
    expect(interpretNumber("+44 20 7946 0958", "IN")?.e164).toBe("+442079460958");
    expect(interpretNumber("+971 50 123 4567", "IN")?.country).toBe("AE");
  });
});

describe("ambiguous and invalid numbers", () => {
  it.each(["12345", "1234567890", "0000000000", "9999999999", "98765", "123456789012345678"])("rejects %s", (input) => {
    expect(interpretNumber(input, "IN")).toBeNull();
  });

  it("does not guess at 10 digits that aren't a mobile and lack a trunk 0", () => {
    expect(interpretNumber("2226543210", "IN")).toBeNull();
  });

  it("does not read 12 digits as +91 unless the rest is a mobile", () => {
    expect(interpretNumber("912226543210", "IN")).toBeNull();
  });
});

describe("OCR text extraction", () => {
  it("finds a number among sign text", () => {
    const c = extractPhoneCandidates("SHARMA XEROX\nMob: 98765 43210\nOpen 9am-9pm");
    expect(c.map((x) => x.e164)).toEqual(["+919876543210"]);
  });

  it("returns multiple candidates, mobile first", () => {
    const c = extractPhoneCandidates("Ph: 022-2654 3210\nWhatsApp 98765 43210 / 91234 56789");
    expect(c.map((x) => x.e164)).toEqual(["+919876543210", "+919123456789", "+912226543210"]);
  });

  it("splits two numbers on one line separated only by spaces", () => {
    const c = extractPhoneCandidates("98765 43210 91234 56789");
    expect(c.map((x) => x.e164).sort()).toEqual(["+919123456789", "+919876543210"]);
  });

  it("deduplicates the same number written two ways", () => {
    expect(extractPhoneCandidates("9876543210 or +91 98765 43210")).toHaveLength(1);
  });

  it("corrects OCR look-alikes but flags the candidate", () => {
    const [c] = extractPhoneCandidates("Call 98765 432l0");
    expect(c.e164).toBe("+919876543210");
    expect(c.corrected).toBe(true);
    expect(c.confidence).toBe("medium");
  });

  it("does not turn ordinary words into digits", () => {
    expect(correctConfusables("Call Hello Mobile").corrected).toBe(false);
  });

  it("ignores dates, prices and short codes", () => {
    expect(extractPhoneCandidates("Rs 2.50/page  12-03-2024  Shop No. 14  GST 27AAACB1234")).toEqual([]);
  });

  it("returns nothing for empty OCR output", () => {
    expect(extractPhoneCandidates("")).toEqual([]);
  });
});

describe("manual entry", () => {
  it("accepts a valid mobile", () => {
    const r = parseManualNumber("98765 43210");
    expect(r.ok && r.candidate.e164).toBe("+919876543210");
  });

  it("explains a too-short number", () => {
    expect(parseManualNumber("98765")).toEqual({ ok: false, error: "That number looks too short." });
  });

  it("explains 10-digit numbers that can't be Indian mobiles", () => {
    const r = parseManualNumber("1234567890");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/start with 6, 7, 8 or 9/);
  });

  it("warns that landlines rarely have WhatsApp", () => {
    const r = parseManualNumber("022 2654 3210");
    expect(r.ok && r.warning).toMatch(/landline/i);
  });

  it("requires something to be entered", () => {
    expect(parseManualNumber("  ").ok).toBe(false);
  });
});
