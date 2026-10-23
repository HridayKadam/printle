export type PaperSize = "A4" | "A3";
export type ColorMode = "bw" | "color";
export type Sides = "single" | "double";
export type Orientation = "portrait" | "landscape" | "auto";
export type PaperQuality = "standard" | "premium" | "glossy";
export type Finishing = "staple" | "spiral" | "softbind" | "lamination" | "punch";
export type PagesPerSheet = 1 | 2 | 4;

export interface PrintSettings {
  paperSize: PaperSize;
  color: ColorMode;
  sides: Sides;
  orientation: Orientation;
  quality: PaperQuality;
  finishing: Finishing[];
  pagesPerSheet: PagesPerSheet;
  /** Applied to every document unless a document overrides it. */
  copies: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  settings: PrintSettings;
  note?: string;
  builtIn?: boolean;
}

export const DEFAULT_SETTINGS: PrintSettings = {
  paperSize: "A4",
  color: "bw",
  sides: "single",
  orientation: "auto",
  quality: "standard",
  finishing: [],
  pagesPerSheet: 1,
  copies: 1,
};

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "notes",
    name: "College notes",
    description: "B&W, double-sided, 2 pages per side",
    builtIn: true,
    settings: { ...DEFAULT_SETTINGS, sides: "double", pagesPerSheet: 2 },
  },
  {
    id: "assignment",
    name: "Assignment",
    description: "B&W, single-sided, stapled",
    builtIn: true,
    settings: { ...DEFAULT_SETTINGS, finishing: ["staple"] },
    note: "Please staple each assignment separately.",
  },
  {
    id: "resume",
    name: "Resume",
    description: "Premium paper, single-sided",
    builtIn: true,
    settings: { ...DEFAULT_SETTINGS, quality: "premium", orientation: "portrait" },
  },
  {
    id: "id",
    name: "ID copies",
    description: "B&W, actual size, front & back on one page",
    builtIn: true,
    settings: { ...DEFAULT_SETTINGS, orientation: "portrait" },
    note: "ID copies: please print at actual size, front and back on one page.",
  },
];

export const LABELS = {
  paperSize: { A4: "A4", A3: "A3" },
  color: { bw: "Black & white", color: "Colour" },
  sides: { single: "Single-sided", double: "Double-sided" },
  orientation: { auto: "Auto", portrait: "Portrait", landscape: "Landscape" },
  quality: { standard: "Standard (70 GSM)", premium: "Premium (100 GSM)", glossy: "Glossy / photo" },
  finishing: {
    staple: "Staple",
    spiral: "Spiral binding",
    softbind: "Soft binding",
    lamination: "Lamination",
    punch: "Hole punch",
  },
} as const;

export function settingsEqual(a: PrintSettings, b: PrintSettings): boolean {
  return (
    a.paperSize === b.paperSize &&
    a.color === b.color &&
    a.sides === b.sides &&
    a.orientation === b.orientation &&
    a.quality === b.quality &&
    a.pagesPerSheet === b.pagesPerSheet &&
    a.copies === b.copies &&
    [...a.finishing].sort().join() === [...b.finishing].sort().join()
  );
}

/** One-line description, used in recent settings and shop history. */
export function describeSettings(s: PrintSettings): string {
  const parts: string[] = [s.paperSize, LABELS.color[s.color], LABELS.sides[s.sides]];
  if (s.pagesPerSheet > 1) parts.push(`${s.pagesPerSheet}/side`);
  if (s.copies > 1) parts.push(`${s.copies} copies`);
  if (s.finishing.length) parts.push(s.finishing.map((f) => LABELS.finishing[f]).join(", "));
  return parts.join(" · ");
}
