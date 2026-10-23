import type { Estimate } from "./cost";
import { formatMoney } from "./cost";
import type { JobDoc } from "./job";
import { effectiveCopies, jobTotals } from "./job";
import { parsePageRange } from "./pageRange";
import type { PrintSettings } from "./printSettings";
import { LABELS } from "./printSettings";

export interface MessageInput {
  docs: JobDoc[];
  settings: PrintSettings;
  /** Only true after the user opted in: filenames can reveal personal details. */
  includeFileNames: boolean;
  note: string;
  estimate?: Estimate | null;
  /** Documents are being sent as one combined PDF. */
  combined?: boolean;
}

export function buildShopMessage({ docs, settings, includeFileNames, note, estimate, combined }: MessageInput): string {
  const lines: string[] = ["Hi! I'd like to print these documents.", ""];
  const totals = jobTotals(docs, settings);
  const pagesSuffix = totals.pagesKnown ? ` (${totals.pages} page${totals.pages === 1 ? "" : "s"})` : "";

  if (combined) {
    lines.push(`Documents: 1 combined PDF of ${docs.length}${pagesSuffix}`);
    lines.push(`Copies: ${settings.copies}`);
  } else {
    lines.push(`Documents: ${docs.length}${pagesSuffix}`);
    const copies = docs.map((d) => effectiveCopies(d, settings));
    const uniform = copies.every((c) => c === copies[0]);
    const anyRange = docs.some((d) => d.pageRange.trim() !== "");
    if (uniform) lines.push(`Copies: ${copies[0] ?? settings.copies}${docs.length > 1 ? " each" : ""}`);
    if (!uniform || anyRange || includeFileNames) {
      docs.forEach((d, i) => {
        const label = includeFileNames ? d.name : `Document ${i + 1}`;
        const bits: string[] = [];
        if (!uniform) bits.push(`${copies[i]} cop${copies[i] === 1 ? "y" : "ies"}`);
        const r = parsePageRange(d.pageRange, d.pageCount);
        if (r.ok && r.normalized) bits.push(`pages ${r.normalized}`);
        lines.push(`${i + 1}. ${label}${bits.length ? ` – ${bits.join(", ")}` : ""}`);
      });
    }
  }

  lines.push(`Paper: ${settings.paperSize}${settings.quality !== "standard" ? `, ${LABELS.quality[settings.quality]}` : ""}`);
  lines.push(`Printing: ${LABELS.color[settings.color]}`);
  lines.push(`Sides: ${LABELS.sides[settings.sides]}`);
  if (settings.orientation !== "auto") lines.push(`Orientation: ${LABELS.orientation[settings.orientation]}`);
  if (settings.pagesPerSheet > 1) lines.push(`Pages per side: ${settings.pagesPerSheet}`);
  if (settings.finishing.length) {
    lines.push(`Finishing: ${settings.finishing.map((f) => LABELS.finishing[f]).join(", ")}`);
  }
  if (note.trim()) lines.push(`Special instructions: ${note.trim()}`);
  if (estimate?.ok) {
    lines.push(`My estimate: ${formatMoney(estimate.total, estimate.currency)}`);
  }
  lines.push("", "Please confirm the total price and expected completion time.");
  return lines.join("\n");
}
