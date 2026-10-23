import type { PhoneCandidate } from "./phone";
import { rankCandidates } from "./phone";

const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 } as const;

/**
 * Live OCR produces a stream of noisy frames. A number is only reported once it
 * has been read in `minHits` of the last `window` frames, and the stabilizer
 * then locks so the UI shows exactly one result sheet until it is reset.
 */
export class ScanStabilizer {
  private frames: PhoneCandidate[][] = [];
  private locked = false;

  constructor(
    private readonly window = 4,
    private readonly minHits = 2,
  ) {}

  /** Feed one frame's candidates. Returns the stable candidates the first time a number stabilizes. */
  push(candidates: PhoneCandidate[]): PhoneCandidate[] | null {
    if (this.locked) return null;
    this.frames.push(candidates);
    if (this.frames.length > this.window) this.frames.shift();

    const hits = new Map<string, { c: PhoneCandidate; n: number }>();
    for (const frame of this.frames) {
      const unique = new Map(frame.map((x) => [x.e164, x]));
      for (const c of unique.values()) {
        const h = hits.get(c.e164);
        const better = !h || CONFIDENCE_RANK[c.confidence] < CONFIDENCE_RANK[h.c.confidence];
        hits.set(c.e164, { c: better ? c : h.c, n: (h?.n ?? 0) + 1 });
      }
    }
    const stable = new Set([...hits.values()].filter((h) => h.n >= this.minHits).map((h) => h.c.e164));
    if (stable.size === 0) return null;
    this.locked = true;
    // Also offer numbers seen only once: signs often show two numbers side by side.
    const ranked = rankCandidates([...hits.values()].map((h) => h.c));
    return [...ranked.filter((c) => stable.has(c.e164)), ...ranked.filter((c) => !stable.has(c.e164))];
  }

  /** Lock immediately with a definitive result (e.g. a QR code). */
  lock() {
    this.locked = true;
  }

  get isLocked() {
    return this.locked;
  }

  reset() {
    this.frames = [];
    this.locked = false;
  }
}
