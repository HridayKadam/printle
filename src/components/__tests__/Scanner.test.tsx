/**
 * MOCKS: navigator.mediaDevices (camera) and @/lib/ocr (Tesseract WASM) —
 * neither can run in jsdom. Real OCR was verified manually in a browser.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scanner } from "../Scanner";

vi.mock("@/lib/ocr", () => ({
  getOcrWorker: vi.fn(() => new Promise(() => undefined)),
  recognizeText: vi.fn(async () => ""),
  terminateOcr: vi.fn(async () => undefined),
  captureRegion: vi.fn(() => null),
  imageFileToCanvas: vi.fn(),
}));

function mockCamera(getUserMedia: unknown) {
  Object.defineProperty(navigator, "mediaDevices", { value: getUserMedia ? { getUserMedia } : undefined, configurable: true });
}

afterEach(() => vi.restoreAllMocks());

describe("Scanner", () => {
  it("explains denied camera permission and offers photo and manual entry", async () => {
    mockCamera(vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")));
    render(<Scanner />);
    expect(await screen.findByText(/camera access is blocked/i)).toBeInTheDocument();
    expect(screen.getByText("Use a photo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /type it/i })).toHaveAttribute("href", "/number/");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("handles browsers without camera support", async () => {
    mockCamera(undefined);
    render(<Scanner />);
    expect(await screen.findByText(/can't open the camera here/i)).toBeInTheDocument();
  });

  it("handles a camera that's in use by another app", async () => {
    mockCamera(vi.fn().mockRejectedValue(new DOMException("busy", "NotReadableError")));
    render(<Scanner />);
    expect(await screen.findByText(/being used by another app/i)).toBeInTheDocument();
  });

  it("only asks for the camera, never the microphone", async () => {
    const gum = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    mockCamera(gum);
    render(<Scanner />);
    await screen.findByText(/camera access is blocked/i);
    expect(gum).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
  });
});
