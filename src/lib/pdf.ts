import type { PDFDocument as PDFDocumentType } from "pdf-lib";
import { parsePageRange } from "./pageRange";

export interface CombineInput {
  file: File;
  kind: "pdf" | "image";
  mime: string;
  pageRange: string;
  pageCount: number | null;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 24;

/**
 * Combine PDFs and images into one PDF, in order, keeping only each document's
 * selected pages. Images are fitted inside an A4 page, keeping their aspect ratio.
 */
export async function combineToPdf(inputs: CombineInput[], name = "printle-combined.pdf"): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const input of inputs) {
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    if (input.kind === "pdf") {
      const src = await PDFDocument.load(bytes);
      const sel = parsePageRange(input.pageRange, src.getPageCount());
      if (!sel.ok) throw new Error(`${input.file.name}: ${sel.error}`);
      const indices = (sel.pages ?? src.getPageIndices().map((i) => i + 1)).map((p) => p - 1);
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
    } else {
      await addImagePage(out, bytes, input.mime);
    }
  }
  const saved = await out.save();
  return new File([saved as BlobPart], name, { type: "application/pdf" });
}

async function addImagePage(doc: PDFDocumentType, bytes: Uint8Array, mime: string) {
  const img = mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const landscape = img.width > img.height;
  const [w, h] = landscape ? [A4[1], A4[0]] : A4;
  const scale = Math.min((w - MARGIN * 2) / img.width, (h - MARGIN * 2) / img.height, 1);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const page = doc.addPage([w, h]);
  page.drawImage(img, { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh });
}
