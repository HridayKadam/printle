"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { captureRegion, getOcrWorker, imageFileToCanvas, recognizeText, terminateOcr } from "@/lib/ocr";
import { extractPhoneCandidates, type PhoneCandidate } from "@/lib/phone";
import { parseQrPayload } from "@/lib/qr";
import { detectQr } from "@/lib/qrDetect";
import { ScanStabilizer } from "@/lib/scanStabilizer";
import { useSession } from "@/store/session";
import { Icon } from "./Icon";
import { Button, LinkButton, Notice, Spinner } from "./ui";

type Status = "starting" | "scanning" | "paused" | "denied" | "no-camera" | "busy" | "unsupported" | "error";

interface Results {
  candidates: PhoneCandidate[];
  shopName?: string;
  note?: string;
  source: "camera" | "photo" | "qr";
}

const TICK_MS = 300;
const DARK_LUMA = 55;

export function Scanner() {
  const router = useRouter();
  const setPhone = useSession((s) => s.setPhone);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrCanvas = useRef<HTMLCanvasElement | null>(null);
  const qrCanvas = useRef<HTMLCanvasElement | null>(null);
  const stabilizer = useRef(new ScanStabilizer());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const frames = useRef(0);
  // The loop reschedules itself through a ref so it always runs the latest tick.
  const tickRef = useRef<() => void>(() => undefined);

  const [status, setStatus] = useState<Status>("starting");
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [qrInfo, setQrInfo] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorchOn(false);
  }, []);

  const showResults = useCallback(
    (r: Results) => {
      // The stabilizer locks after its first result, but guard here too so only one sheet ever opens.
      setResults((prev) => prev ?? r);
      stopCamera();
      setStatus("paused");
      navigator.vibrate?.(30);
    },
    [stopCamera],
  );

  const tick = useCallback(async () => {
    if (!active.current) return;
    const video = videoRef.current;
    if (video && !document.hidden && !stabilizer.current.isLocked) {
      ocrCanvas.current ??= document.createElement("canvas");
      qrCanvas.current ??= document.createElement("canvas");
      try {
        // QR first: cheap, and definitive when present.
        if (frames.current % 2 === 0) {
          const payload = await detectQr(video, qrCanvas.current);
          if (payload) {
            const parsed = parseQrPayload(payload);
            if (parsed) {
              stabilizer.current.lock();
              showResults({ candidates: parsed.candidates, shopName: parsed.shopName, note: parsed.note, source: "qr" });
              return;
            }
            setQrInfo("That QR code doesn't contain a phone number. Point at the shop's number instead.");
          }
        }
        const frame = captureRegion(video, ocrCanvas.current);
        if (frame && ocrReady) {
          setHint(frame.luminance < DARK_LUMA ? "It's quite dark. Turn on the flash or move closer to the light." : null);
          const text = await recognizeText(frame.canvas);
          if (!active.current) return;
          const stable = stabilizer.current.push(extractPhoneCandidates(text));
          if (stable) {
            showResults({ candidates: stable, source: "camera" });
            return;
          }
          frames.current++;
          if (frames.current === 20) setHint("Hold steady and fit the number inside the frame. Tap the flash in low light.");
        }
      } catch {
        // A single bad frame is not fatal; keep scanning.
      }
    }
    timer.current = setTimeout(() => tickRef.current(), TICK_MS);
  }, [ocrReady, showResults]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startCamera = useCallback(async () => {
    setStatus("starting");
    setResults(null);
    setQrInfo(null);
    stabilizer.current.reset();
    frames.current = 0;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(!!caps.torch);
      active.current = true;
      setStatus("scanning");
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setStatus("no-camera");
      else if (name === "NotReadableError" || name === "AbortError") setStatus("busy");
      else setStatus("error");
    }
  }, []);

  // Start the camera on arrival: the user already chose "Scan".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting an external system (camera)
    startCamera();
    getOcrWorker()
      .then(() => setOcrReady(true))
      .catch(() => setOcrFailed(true));
    return () => {
      stopCamera();
      terminateOcr();
    };
  }, [startCamera, stopCamera]);

  // (Re)start the frame loop whenever scanning begins or OCR becomes ready.
  useEffect(() => {
    if (status !== "scanning") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(tick, TICK_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, tick]);

  // Release the camera when the app goes to the background; resume when back.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && streamRef.current) {
        stopCamera();
        setStatus("paused");
      } else if (!document.hidden && status === "paused" && !results) {
        startCamera();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [status, results, startCamera, stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchAvailable(false);
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const canvas = await imageFileToCanvas(file);
      qrCanvas.current ??= document.createElement("canvas");
      const payload = await detectQr(canvas, qrCanvas.current).catch(() => null);
      const parsed = payload ? parseQrPayload(payload) : null;
      if (parsed) {
        showResults({ candidates: parsed.candidates, shopName: parsed.shopName, note: parsed.note, source: "qr" });
        return;
      }
      const candidates = extractPhoneCandidates(await recognizeText(canvas));
      if (candidates.length) showResults({ candidates, source: "photo" });
      else setPhotoError("No phone number found in that photo. Try a closer, sharper shot, or type the number.");
    } catch {
      setPhotoError("Couldn't read that image. Try another photo or type the number.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const choose = (c: PhoneCandidate) => {
    setPhone(c, { name: results?.shopName });
    router.push("/number/");
  };

  const cameraProblem =
    status === "denied"
      ? "Camera access is blocked. Allow it in your browser's site settings, or use a photo instead."
      : status === "no-camera"
        ? "No camera found on this device."
        : status === "busy"
          ? "The camera is being used by another app. Close it and try again."
          : status === "unsupported"
            ? "This browser can't open the camera here. Use a photo or type the number."
            : status === "error"
              ? "The camera couldn't start."
              : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl bg-black aspect-[3/4] max-h-[62dvh] w-full">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" aria-label="Camera preview" />

        {/* Scan frame matches the region captured for OCR (see captureRegion). */}
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-x-[6%] top-[34%] h-[32%] rounded-2xl border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <div className="scan-line absolute inset-x-3 h-0.5 rounded bg-primary shadow-[0_0_12px_var(--primary)]" />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 p-3 flex justify-between items-start">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-medium text-white" aria-live="polite">
            {status === "starting" ? "Starting camera…" : status === "scanning" ? (ocrReady ? "Looking for a number…" : "Preparing scanner…") : status === "paused" ? "Paused" : "Camera off"}
          </span>
          {torchAvailable && status === "scanning" && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torchOn}
              aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
              className={`h-11 w-11 grid place-items-center rounded-full ${torchOn ? "bg-white text-black" : "bg-black/60 text-white"}`}
            >
              <Icon name="flash" />
            </button>
          )}
        </div>

        {status === "scanning" && (
          <p className="absolute inset-x-0 bottom-0 p-4 text-center text-[15px] font-medium text-white bg-gradient-to-t from-black/70">
            {hint ?? "Point at the phone number on the shop's sign or counter"}
          </p>
        )}

        {cameraProblem && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <Icon name="alert" size={32} className="mx-auto mb-2" />
              <p className="text-[15px]">{cameraProblem}</p>
              {status !== "unsupported" && status !== "no-camera" && (
                <Button variant="secondary" className="mt-4" icon="refresh" onClick={startCamera}>
                  Try again
                </Button>
              )}
            </div>
          </div>
        )}
        {status === "paused" && !results && (
          <div className="absolute inset-0 grid place-items-center">
            <Button onClick={startCamera} icon="scan">
              Resume scanning
            </Button>
          </div>
        )}
      </div>

      {ocrFailed && <Notice tone="danger">The text scanner couldn&apos;t load. Check your connection once, then try again — after that it works offline.</Notice>}
      {qrInfo && !results && <Notice tone="info">{qrInfo}</Notice>}
      {photoError && <Notice tone="warning">{photoError}</Notice>}

      <div className="grid grid-cols-2 gap-3">
        <label className="relative">
          <input
            type="file"
            accept="image/*"
            className="peer sr-only"
            onChange={(e) => {
              onPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
            disabled={photoBusy}
          />
          <span className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[15px] font-semibold hover:bg-surface-2 peer-focus-visible:ring-3 peer-focus-visible:ring-primary/40">
            {photoBusy ? <Spinner /> : <Icon name="image" />}
            {photoBusy ? "Reading…" : "Use a photo"}
          </span>
        </label>
        <LinkButton href="/number/" variant="secondary" icon="keypad">
          Type it
        </LinkButton>
      </div>

      {results && <ResultsSheet results={results} onChoose={choose} onRescan={startCamera} />}
    </div>
  );
}

function ResultsSheet({ results, onChoose, onRescan }: { results: Results; onChoose: (c: PhoneCandidate) => void; onRescan: () => void }) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => firstRef.current?.focus(), []);
  const multiple = results.candidates.length > 1;
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="results-title">
      <div className="animate-in w-full max-w-xl mx-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <h2 id="results-title" className="text-[19px] font-bold">
          {multiple ? "Which number is the shop's?" : "Number found"}
        </h2>
        <p className="text-[14px] text-muted mt-1">
          {results.shopName ? `${results.shopName} · ` : ""}
          {multiple ? "We found more than one. Pick the WhatsApp number." : "Check it matches the sign. You can edit it next."}
        </p>
        {results.note && <div className="mt-3"><Notice tone="warning">{results.note}</Notice></div>}
        <ul className="mt-4 space-y-2">
          {results.candidates.map((c, i) => (
            <li key={c.e164}>
              <button
                ref={i === 0 ? firstRef : undefined}
                type="button"
                onClick={() => onChoose(c)}
                className="w-full flex items-center gap-3 rounded-2xl border border-line p-4 text-left hover:border-primary hover:bg-primary-soft"
              >
                <span className="flex-1">
                  <span className="block text-[20px] font-bold tabular-nums">{c.display}</span>
                  <span className="block text-[13px] text-muted">
                    {c.kind === "mobile" ? "Mobile" : c.kind === "landline" ? "Landline – may not have WhatsApp" : "Phone"}
                    {c.corrected || c.confidence === "low" ? " · Check the digits" : ""}
                  </span>
                </span>
                <Icon name="chevron" className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" icon="refresh" onClick={onRescan}>
            Scan again
          </Button>
          <LinkButton href="/number/" variant="secondary" icon="keypad">
            Type instead
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
