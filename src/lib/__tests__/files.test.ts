import { describe, expect, it } from "vitest";
import { makeEncryptedPdf, makePdf, makePng } from "@/test/fixtures";
import { inspectFile, normalizedFile, sniffType } from "../files";
import { combineToPdf } from "../pdf";
import { PDFDocument } from "pdf-lib";

describe("sniffType", () => {
  it("identifies files by content, not name", () => {
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("PK\u0003\u0004 docx"))).toBeNull();
  });
});

describe("inspectFile", () => {
  it("counts PDF pages", async () => {
    expect(await inspectFile(await makePdf(3))).toMatchObject({ ok: true, kind: "pdf", pageCount: 3 });
  });

  it("accepts PNG images as one page", async () => {
    expect(await inspectFile(makePng())).toMatchObject({ ok: true, kind: "image", mime: "image/png", pageCount: 1 });
  });

  it("rejects unsupported formats even with a PDF extension", async () => {
    const fake = new File(["PK\u0003\u0004 this is a zip"], "notes.pdf", { type: "application/pdf" });
    expect(await inspectFile(fake)).toMatchObject({ ok: false, error: expect.stringMatching(/Unsupported/) });
  });

  it("rejects corrupted PDFs with a helpful message", async () => {
    const broken = new File(["%PDF-1.4\n garbage without objects"], "broken.pdf");
    expect(await inspectFile(broken)).toMatchObject({ ok: false, error: expect.stringMatching(/damaged/) });
  });

  it("rejects empty files", async () => {
    expect(await inspectFile(new File([], "empty.pdf"))).toMatchObject({ ok: false, error: "This file is empty." });
  });

  it("allows password-protected PDFs with a warning", async () => {
    const r = await inspectFile(await makeEncryptedPdf(2));
    expect(r.ok).toBe(true);
    expect(r.encrypted).toBe(true);
    expect(r.warning).toMatch(/password/i);
  });

  it("fixes missing extensions so the shop can open the file", () => {
    const f = normalizedFile(new File(["x"], "scan", { type: "" }), "image/jpeg");
    expect(f.name).toBe("scan.jpg");
    expect(f.type).toBe("image/jpeg");
  });
});

describe("combineToPdf", () => {
  it("merges PDFs and images in order, keeping selected pages", async () => {
    const out = await combineToPdf([
      { file: await makePdf(5), kind: "pdf", mime: "application/pdf", pageRange: "2-3", pageCount: 5 },
      { file: makePng(), kind: "image", mime: "image/png", pageRange: "", pageCount: 1 },
      { file: await makePdf(2), kind: "pdf", mime: "application/pdf", pageRange: "", pageCount: 2 },
    ]);
    const doc = await PDFDocument.load(new Uint8Array(await out.arrayBuffer()));
    expect(doc.getPageCount()).toBe(5);
    expect(out.name).toBe("printle-combined.pdf");
  });

  it("reports an invalid page range", async () => {
    await expect(
      combineToPdf([{ file: await makePdf(2, "a.pdf"), kind: "pdf", mime: "application/pdf", pageRange: "5", pageCount: 2 }]),
    ).rejects.toThrow(/a.pdf/);
  });
});
