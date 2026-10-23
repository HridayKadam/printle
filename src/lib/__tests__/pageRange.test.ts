import { describe, expect, it } from "vitest";
import { formatPages, parsePageRange } from "../pageRange";

describe("parsePageRange", () => {
  it("treats empty and 'all' as every page", () => {
    expect(parsePageRange("", 5)).toMatchObject({ ok: true, count: 5, normalized: "" });
    expect(parsePageRange("all", 3)).toMatchObject({ ok: true, count: 3 });
    expect(parsePageRange("", null)).toMatchObject({ ok: true, count: null, pages: null });
  });

  it("parses lists and ranges, merging overlaps", () => {
    const r = parsePageRange("1-3, 5, 2, 7-8", 10);
    expect(r).toMatchObject({ ok: true, count: 6, normalized: "1-3, 5, 7-8" });
  });

  it("supports open-ended ranges when the page count is known", () => {
    expect(parsePageRange("4-", 6)).toMatchObject({ ok: true, count: 3, normalized: "4-6" });
    expect(parsePageRange("4-", null).ok).toBe(false);
  });

  it.each([
    ["5-3", /backwards/],
    ["0", /start at 1/],
    ["abc", /isn't a page/],
    ["1-20", /has 10 pages/],
  ])("rejects %s", (input, msg) => {
    const r = parsePageRange(input, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  });

  it("formats page lists compactly", () => {
    expect(formatPages([1, 2, 3, 5, 7, 8])).toBe("1-3, 5, 7-8");
  });
});
