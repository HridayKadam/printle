import { parsePageRange } from "./pageRange";
import type { PrintSettings } from "./printSettings";

/** The subset of a document that print maths and the shop message need. */
export interface JobDoc {
  id: string;
  name: string;
  kind: "pdf" | "image";
  pageCount: number | null;
  /** null = use the job-wide copies setting. */
  copies: number | null;
  pageRange: string;
}

export function effectiveCopies(doc: JobDoc, settings: PrintSettings): number {
  return doc.copies ?? settings.copies;
}

/** Pages selected in one copy of a document, or null when unknown. */
export function selectedPageCount(doc: JobDoc): number | null {
  const r = parsePageRange(doc.pageRange, doc.pageCount);
  return r.ok ? r.count : null;
}

export interface JobTotals {
  documents: number;
  /** All page counts are known and every range is valid. */
  pagesKnown: boolean;
  /** Pages in one copy of every document. */
  pages: number;
  /** Printed sides across all copies (what shops usually charge for). */
  impressions: number;
  /** Physical sheets of paper across all copies. */
  sheets: number;
}

export function jobTotals(docs: JobDoc[], settings: PrintSettings): JobTotals {
  let pagesKnown = docs.length > 0;
  let pages = 0;
  let impressions = 0;
  let sheets = 0;
  for (const doc of docs) {
    const n = selectedPageCount(doc);
    if (n === null) {
      pagesKnown = false;
      continue;
    }
    const copies = effectiveCopies(doc, settings);
    const sides = Math.ceil(n / settings.pagesPerSheet);
    pages += n;
    impressions += sides * copies;
    sheets += Math.ceil(sides / (settings.sides === "double" ? 2 : 1)) * copies;
  }
  return { documents: docs.length, pagesKnown, pages, impressions, sheets };
}
