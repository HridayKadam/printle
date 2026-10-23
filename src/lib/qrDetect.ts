/** Find a QR code in a video frame or canvas. Uses the native BarcodeDetector when present, else jsQR. */
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

let native: Detector | null | undefined;

function nativeDetector(): Detector | null {
  if (native !== undefined) return native;
  const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try {
    native = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    native = null;
  }
  return native;
}

export async function detectQr(source: HTMLVideoElement | HTMLCanvasElement, scratch: HTMLCanvasElement): Promise<string | null> {
  const det = nativeDetector();
  if (det) {
    try {
      const codes = await det.detect(source);
      return codes[0]?.rawValue ?? null;
    } catch {
      // fall back to jsQR
    }
  }
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  if (!w || !h) return null;
  const scale = Math.min(1, 800 / Math.max(w, h));
  scratch.width = Math.round(w * scale);
  scratch.height = Math.round(h * scale);
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, scratch.width, scratch.height);
  const { default: jsQR } = await import("jsqr");
  const img = ctx.getImageData(0, 0, scratch.width, scratch.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
}
