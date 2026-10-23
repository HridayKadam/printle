// Copies the Tesseract worker, WASM core and English model into public/ocr so
// OCR runs entirely from this app's own origin (no CDN, works offline once cached).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");

const tesseractDir = dirname(require.resolve("tesseract.js/package.json"));
const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
const langDir = dirname(require.resolve("@tesseract.js-data/eng/package.json"));

mkdirSync(join(out, "core"), { recursive: true });
mkdirSync(join(out, "lang"), { recursive: true });

cpSync(join(tesseractDir, "dist", "worker.min.js"), join(out, "worker.min.js"));
for (const file of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
]) {
  cpSync(join(coreDir, file), join(out, "core", file));
}
const model = join(langDir, "4.0.0_best_int", "eng.traineddata.gz");
if (!existsSync(model)) throw new Error(`OCR model not found at ${model}`);
cpSync(model, join(out, "lang", "eng.traineddata.gz"));

console.log("OCR assets copied to public/ocr");
