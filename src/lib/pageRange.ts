export type PageRangeResult =
  | { ok: true; pages: number[] | null; count: number | null; normalized: string }
  | { ok: false; error: string };

/**
 * Parse a page selection like "1-3, 5, 8-". Empty or "all" means every page.
 * `pages` is null when "all pages" is selected and the page count is unknown.
 */
export function parsePageRange(input: string, pageCount: number | null): PageRangeResult {
  const text = input.trim().toLowerCase();
  if (text === "" || text === "all") {
    return { ok: true, pages: pageCount ? range(1, pageCount) : null, count: pageCount, normalized: "" };
  }
  const set = new Set<number>();
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:\s*[-–]\s*(\d*))?$/);
    if (!m) return { ok: false, error: `"${part}" isn't a page or range. Use e.g. 1-3, 5` };
    const start = Number(m[1]);
    const isRange = part.includes("-") || part.includes("–");
    const end = isRange ? (m[2] ? Number(m[2]) : pageCount) : start;
    if (end === null) return { ok: false, error: `"${part}" needs an end page because the page count is unknown.` };
    if (start < 1) return { ok: false, error: "Pages start at 1." };
    if (end < start) return { ok: false, error: `"${part}" goes backwards.` };
    if (pageCount && end > pageCount) {
      return { ok: false, error: `This document has ${pageCount} page${pageCount === 1 ? "" : "s"}.` };
    }
    if (end - start > 10000) return { ok: false, error: "That range is too large." };
    for (let p = start; p <= end; p++) set.add(p);
  }
  const pages = [...set].sort((a, b) => a - b);
  return { ok: true, pages, count: pages.length, normalized: formatPages(pages) };
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** Collapse [1,2,3,5,7,8] into "1-3, 5, 7-8". */
export function formatPages(pages: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < pages.length) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    parts.push(i === j ? `${pages[i]}` : `${pages[i]}-${pages[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
