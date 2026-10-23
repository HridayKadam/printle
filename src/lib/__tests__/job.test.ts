import { describe, expect, it } from "vitest";
import { estimateCost, EMPTY_RATES } from "../cost";
import type { JobDoc } from "../job";
import { jobTotals } from "../job";
import { buildShopMessage } from "../message";
import { DEFAULT_SETTINGS } from "../printSettings";

const doc = (over: Partial<JobDoc> = {}): JobDoc => ({
  id: Math.random().toString(),
  name: "Assignment.pdf",
  kind: "pdf",
  pageCount: 4,
  copies: null,
  pageRange: "",
  ...over,
});

describe("jobTotals", () => {
  it("counts pages, printed sides and sheets", () => {
    const t = jobTotals([doc(), doc({ pageCount: 3 })], { ...DEFAULT_SETTINGS, copies: 2, sides: "double" });
    expect(t).toEqual({ documents: 2, pagesKnown: true, pages: 7, impressions: 14, sheets: 8 });
  });

  it("applies page ranges, per-document copies and pages per side", () => {
    const t = jobTotals([doc({ pageCount: 10, pageRange: "1-4", copies: 3 })], { ...DEFAULT_SETTINGS, pagesPerSheet: 2 });
    expect(t).toMatchObject({ pages: 4, impressions: 6, sheets: 6 });
  });

  it("reports unknown pages instead of guessing", () => {
    expect(jobTotals([doc({ pageCount: null })], DEFAULT_SETTINGS).pagesKnown).toBe(false);
    expect(jobTotals([], DEFAULT_SETTINGS).pagesKnown).toBe(false);
  });
});

describe("estimateCost", () => {
  it("needs a rate", () => {
    expect(estimateCost([doc()], DEFAULT_SETTINGS, EMPTY_RATES)).toEqual({ ok: false, reason: "no-rate" });
  });

  it("uses the colour rate for colour jobs and adds extras", () => {
    const e = estimateCost([doc()], { ...DEFAULT_SETTINGS, color: "color", copies: 2 }, { ...EMPTY_RATES, bw: 2, color: 10, extras: 30 });
    expect(e).toMatchObject({ ok: true, total: 110, impressions: 8, rate: 10 });
  });

  it("refuses to estimate with unknown page counts", () => {
    expect(estimateCost([doc({ pageCount: null })], DEFAULT_SETTINGS, { ...EMPTY_RATES, bw: 2 })).toEqual({ ok: false, reason: "unknown-pages" });
  });
});

describe("buildShopMessage", () => {
  const base = { settings: DEFAULT_SETTINGS, includeFileNames: false, note: "" };

  it("matches the selected settings", () => {
    const msg = buildShopMessage({
      ...base,
      docs: [doc(), doc(), doc()],
      settings: { ...DEFAULT_SETTINGS, copies: 2, sides: "double", finishing: ["staple"] },
      note: "Please staple the assignment.",
    });
    expect(msg).toBe(
      [
        "Hi! I'd like to print these documents.",
        "",
        "Documents: 3 (12 pages)",
        "Copies: 2 each",
        "Paper: A4",
        "Printing: Black & white",
        "Sides: Double-sided",
        "Finishing: Staple",
        "Special instructions: Please staple the assignment.",
        "",
        "Please confirm the total price and expected completion time.",
      ].join("\n"),
    );
  });

  it("never includes file names unless the user opts in", () => {
    const docs = [doc({ name: "Aadhaar_Ravi_Kumar.pdf" })];
    expect(buildShopMessage({ ...base, docs })).not.toContain("Aadhaar");
    expect(buildShopMessage({ ...base, docs, includeFileNames: true })).toContain("1. Aadhaar_Ravi_Kumar.pdf");
  });

  it("lists documents by number when copies or ranges differ", () => {
    const msg = buildShopMessage({ ...base, docs: [doc({ copies: 3 }), doc({ pageRange: "1-2" })] });
    expect(msg).toContain("1. Document 1 – 3 copies");
    expect(msg).toContain("2. Document 2 – 1 copy, pages 1-2");
    expect(msg).not.toContain("Copies:");
  });

  it("includes an estimate only when one was calculated", () => {
    const estimate = estimateCost([doc()], DEFAULT_SETTINGS, { ...EMPTY_RATES, bw: 2 });
    expect(buildShopMessage({ ...base, docs: [doc()], estimate })).toContain("My estimate: ₹8");
    expect(buildShopMessage({ ...base, docs: [doc()], estimate: null })).not.toContain("estimate");
  });

  it("describes a combined PDF", () => {
    expect(buildShopMessage({ ...base, docs: [doc(), doc()], combined: true })).toContain("Documents: 1 combined PDF of 2 (8 pages)");
  });

  it("omits defaults the shop doesn't need", () => {
    const msg = buildShopMessage({ ...base, docs: [doc()] });
    expect(msg).not.toMatch(/Orientation|Pages per side|Finishing|Special/);
  });
});
