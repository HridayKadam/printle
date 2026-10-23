import type { Worker } from "tesseract.js";

/**
 * On-device OCR with Tesseract (WebAssembly). The worker, engine and English
 * model are served from this app's own origin (/ocr), so images never leave
 * the device and nothing is fetched from a CDN.
 */
let workerPromise: Promise<Worker> | null = null;

export function getOcrWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      const base = `${window.location.origin}/ocr`;
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: `${base}/worker.min.js`,
        corePath: `${base}/core`,
        langPath: `${base}/lang`,
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === "loading language traineddata" || m.status === "initializing api") onProgress?.(m.progress);
        },
      });
      // Sparse text suits signs and cards where numbers sit among other text.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function recognizeText(image: HTMLCanvasElement | Blob | File): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(image);
  return data.text ?? "";
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const p = workerPromise;
  workerPromise = null;
  try {
    (await p).terminate();
  } catch {
    // already gone
  }
}

/**
 * Crop the scan-frame region from a video frame, scale it for OCR and boost
 * contrast. Returns the canvas and the mean luminance (0-255) for low-light hints.
 */
export function captureRegion(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  region = { x: 0.06, y: 0.34, w: 0.88, h: 0.32 },
): { canvas: HTMLCanvasElement; luminance: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sx = vw * region.x;
  const sy = vh * region.y;
  const sw = vw * region.w;
  const sh = vh * region.h;
  const scale = Math.min(1, 1400 / sw);
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return { canvas, luminance: enhance(ctx, canvas.width, canvas.height) };
}

/** Greyscale + contrast stretch in place. Returns mean luminance before stretching. */
export function enhance(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = y;
    sum += y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) * 255) / range;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return sum / (d.length / 4);
}

/** Downscale a large photo before OCR: phone cameras produce 12MP+ images. */
export async function imageFileToCanvas(file: Blob, maxSide = 2000): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  enhance(ctx, canvas.width, canvas.height);
  return canvas;
}
