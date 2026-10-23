import { PDFDocument } from "pdf-lib";

/** A real PDF with `pages` blank A4 pages, built with pdf-lib. */
export async function makePdf(pages = 1, name = "doc.pdf"): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return new File([(await doc.save()) as BlobPart], name, { type: "application/pdf" });
}

/** A PDF whose trailer declares encryption, which pdf-lib refuses to load by default. */
export async function makeEncryptedPdf(pages = 2): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  const bytes = await doc.save({ useObjectStreams: false });
  const text = new TextDecoder("latin1").decode(bytes).replace("/Root", "/Encrypt 1 0 R\n/Root");
  const out = Uint8Array.from(text, (c) => c.charCodeAt(0));
  return new File([out], "locked.pdf", { type: "application/pdf" });
}

/** 1×1 PNG. */
export const PNG_BYTES = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

export function makePng(name = "photo.png"): File {
  return new File([PNG_BYTES], name, { type: "image/png" });
}
