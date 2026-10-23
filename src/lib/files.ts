import { LIMITS } from "@/config/app";

export type DocKind = "pdf" | "image";
export type SupportedMime = "application/pdf" | "image/jpeg" | "image/png";

export const ACCEPT_ATTR = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

export interface Inspection {
  ok: boolean;
  kind?: DocKind;
  mime?: SupportedMime;
  pageCount: number | null;
  /** Shown to the user but does not block sharing. */
  warning?: string;
  /** Blocks the file from being added. */
  error?: string;
  encrypted?: boolean;
}

/** Identify a file by its leading bytes rather than trusting the name or browser-reported type. */
export function sniffType(bytes: Uint8Array): SupportedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  // The PDF spec lets the %PDF- header appear anywhere in the first 1024 bytes.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (head.includes("%PDF-")) return "application/pdf";
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

async function readBytes(blob: Blob, end?: number): Promise<Uint8Array> {
  const part = end ? blob.slice(0, end) : blob;
  return new Uint8Array(await part.arrayBuffer());
}

/** Count PDF pages with pdf-lib. Distinguishes corrupted files from password-protected ones. */
export async function inspectPdf(bytes: Uint8Array): Promise<Pick<Inspection, "pageCount" | "error" | "warning" | "encrypted">> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = doc.getPageCount();
    if (pageCount === 0) return { pageCount: null, error: "This PDF has no pages." };
    return { pageCount };
  } catch (err) {
    const name = (err as Error)?.name ?? "";
    const message = (err as Error)?.message ?? "";
    if (name === "EncryptedPDFError" || /encrypt/i.test(message)) {
      try {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
        return {
          pageCount: doc.getPageCount() || null,
          encrypted: true,
          warning: "Password-protected. The shop will need the password to print it.",
        };
      } catch {
        return { pageCount: null, encrypted: true, warning: "Password-protected. Page count unavailable." };
      }
    }
    return { pageCount: null, error: "This PDF looks damaged and can't be opened. Try exporting it again." };
  }
}

export async function inspectFile(file: File): Promise<Inspection> {
  if (file.size === 0) return { ok: false, pageCount: null, error: "This file is empty." };
  if (file.size > LIMITS.maxFileBytes) {
    return { ok: false, pageCount: null, error: `Too large (${formatBytes(file.size)}). The limit is ${formatBytes(LIMITS.maxFileBytes)}.` };
  }
  const mime = sniffType(await readBytes(file, 1024));
  if (!mime) {
    return { ok: false, pageCount: null, error: "Unsupported file. Add a PDF, JPG or PNG." };
  }
  if (mime === "application/pdf") {
    const info = await inspectPdf(await readBytes(file));
    return { ok: !info.error, kind: "pdf", mime, ...info };
  }
  return { ok: true, kind: "image", mime, pageCount: 1 };
}

/** Make sure the shared file has the right extension and type, whatever the picker reported. */
export function normalizedFile(file: File, mime: SupportedMime): File {
  const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  const hasExt = new RegExp(`\\.${ext === "jpg" ? "jpe?g" : ext}$`, "i").test(file.name);
  const name = hasExt ? file.name : `${file.name.replace(/\.[^.]*$/, "") || "document"}.${ext}`;
  if (name === file.name && file.type === mime) return file;
  return new File([file], name, { type: mime, lastModified: file.lastModified });
}
