# Printle

Walk up to any print shop, scan the phone number on its sign, pick your documents, and send them on WhatsApp — **without saving the shop owner's number to your contacts.**

Printle is a mobile-first PWA (Next.js + Tailwind CSS, TypeScript). Everything runs on the device: phone numbers are read with on-device OCR, documents stay in the tab's memory, and nothing is uploaded to a server.

```
Scan number → confirm → pick files → print options → review message → Send to Shop
```

---

## Quick start

Requires Node.js 20+ (tested on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. To test the camera on a phone, the page must be served over **HTTPS** (or `localhost`) — browsers block camera access on plain HTTP. Easiest options: deploy a preview (below), or use a tunnel such as `cloudflared tunnel --url http://localhost:3000`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (copies OCR assets first) |
| `npm run build` | Static production build into `out/` |
| `npm start` | Serve `out/` locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest test suite |
| `npm run check` | Lint + typecheck + tests |

### Environment variables

All optional. Copy `.env.example` to `.env.local` to override.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Printle` | Product name in the UI, page titles and PWA manifest |
| `NEXT_PUBLIC_APP_TAGLINE` | see `.env.example` | Home-screen tagline |
| `NEXT_PUBLIC_DEFAULT_REGION` | `IN` | Region for numbers written without a country code |

There are no secrets and no backend.

## Build and deploy

`npm run build` produces a fully static site in `out/` (`output: "export"`). Host it on any static host with HTTPS:

- **Vercel / Netlify / Cloudflare Pages:** build command `npm run build`, output directory `out`.
- **GitHub Pages / S3 / nginx:** upload `out/`. URLs use trailing slashes (`/scan/` → `scan/index.html`).

The OCR engine (~3 MB model + ~4 MB WASM, only one WASM variant is downloaded) is copied from `node_modules` into `public/ocr/` by `scripts/copy-ocr-assets.mjs` before every dev/build run. It is git-ignored and served from your own origin — no CDN calls. A service worker (`public/sw.js`, production only) caches the app shell and OCR engine so scanning works offline after the first visit.

## Dependencies

| Package | Why |
| --- | --- |
| `next`, `react`, `react-dom` | App framework, static export |
| `tailwindcss` | Styling, light/dark themes |
| `tesseract.js`, `@tesseract.js-data/eng` | On-device OCR (WebAssembly) |
| `libphonenumber-js` | Phone number validation, formatting and type (mobile vs landline) |
| `pdf-lib` | Page counts, corruption/encryption detection, merging PDFs and images |
| `jsqr` | QR fallback where the native `BarcodeDetector` is missing |
| `zustand` | Session and preference state |
| `vitest`, Testing Library, `jsdom` | Tests |

---

## How sharing actually works (and its limits)

A web app **cannot** open a WhatsApp chat with a specific number *and* attach files to it in one step, on any platform. Printle does not pretend otherwise. It uses only supported mechanisms:

1. **Open the chat** — a `https://wa.me/<number>?text=<message>` direct-chat link. WhatsApp opens a chat with the shop without creating a contact, with the print message pre-filled. The user taps send. The link opens in a new browsing context so Printle's tab (and the files in memory) survive.
2. **Share the files** — on browsers with Web Share Level 2 (`navigator.canShare({ files })`: Android Chrome, iOS Safari 15+), "Share files" opens the OS share sheet with all documents. The user picks WhatsApp; because step 1 just created the chat, **the shop is at the top of the recent-chats list**.
3. **Fallback** — where file sharing isn't available (most desktop browsers), the user saves the files and drags them into WhatsApp Web/Desktop. The UI says so up front.

Printle **never** claims files were delivered. The share sheet resolving only means the OS accepted the hand-off; the final screen says the app can't see inside WhatsApp and asks the user to check the chat. The "I've sent everything" step is the user's own confirmation.

Other share methods are pluggable in `src/lib/share/methods.ts` (each method is a list of steps per platform capability). Included: **WhatsApp** (recommended), **Other app** (system share sheet — Telegram, email, Nearby Share…), and **Text message** (message only, since SMS can't carry files).

### Why not a native app (yet)?

| | Web/PWA (chosen) | Capacitor | React Native |
| --- | --- | --- | --- |
| Reach | Any phone, no install | App stores | App stores |
| Reuse this code | — | ~100% (wrap `out/`) | Rewrite UI |
| OCR | Tesseract WASM (good on printed digits, ~1 s/frame) | Can add ML Kit / Vision text recognition (faster, better on handwriting) | Same as Capacitor |
| Files survive app switch | Usually; low-memory phones may unload the tab | Yes | Yes |
| Target WhatsApp + attach files in one step | No | Android only, via an intent to `com.whatsapp` with the `jid` extra — undocumented and may break; iOS still can't | Same |

The web version already covers the whole flow, so it ships first. Because the app is a static export with no server dependencies, wrapping it in **Capacitor** later is mechanical (`npx cap add android`, point `webDir` at `out`) and would add native ML Kit OCR and more robust file retention. Note that even native apps cannot officially pre-select a WhatsApp recipient *and* attach files on iOS.

---

## Feature checklist

Legend: ✅ fully functional and tested · 🔶 platform-dependent (works where the browser/OS supports it) · 🧪 tested with mocks only · 📝 instructional (sent as text, not enforced)

### Core flow
| Feature | Status | Notes |
| --- | --- | --- |
| Scan number with live camera OCR | 🔶 | Needs HTTPS + camera. Real OCR verified in a browser via the photo path; camera loop tested with mocks |
| Frame stabilization (number must appear in 2 of 4 frames), single result dialog | ✅ | `ScanStabilizer` unit tests |
| Multiple candidates → user picks | ✅ | |
| Indian normalization (`98765 43210`, `+91-…`, `091…`, `0091…`, `022-…` landlines) | ✅ | 40+ parser tests |
| Ambiguous digits are not silently accepted | ✅ | 10-digit non-mobiles without a trunk `0` are rejected; OCR look-alike corrections (O→0, l→1) are flagged for checking |
| Manual entry and editing | ✅ | |
| Photo upload fallback | ✅ | Verified with real Tesseract in browser |
| Camera denied / busy / missing / unsupported states | 🧪 | `getUserMedia` mocked |
| Low-light hint, torch toggle | 🔶 | Torch only where `MediaTrackCapabilities.torch` exists (mostly Android Chrome) |
| QR codes: `wa.me`, `api.whatsapp.com`, `tel:`, UPI IDs that are mobile numbers, Printle shop codes | ✅ | Parsing tested; detection uses `BarcodeDetector` or jsQR |
| Document basket: PDF/JPG/PNG, multi-select, content-sniffed types, size limits | ✅ | |
| Page counts, corrupted and password-protected PDF handling | ✅ | Real PDFs generated in tests |
| Image previews, reorder, replace, remove, clear all | ✅ | PDF thumbnails show an icon + page count (no PDF rendering) |
| Print options, presets (College notes, Assignment, Resume, ID copies), custom presets | ✅ / 📝 | Settings are instructions to the shop — the UI says so |
| Per-document copies and page ranges | ✅ / 📝 | Ranges are *enforced* only when combining into one PDF |
| Print-job summary and editable message | ✅ | File names excluded unless the user opts in |
| Open WhatsApp chat without saving a contact | ✅ | `wa.me` link; tests assert the URL, not WhatsApp itself |
| Share multiple files via OS share sheet | 🔶 / 🧪 | Web Share Level 2 browsers; mocked in tests |
| Save-files fallback (desktop) | ✅ | |
| Copy number / copy message | ✅ | Clipboard API with `execCommand` fallback |
| Return-from-app detection with next-step prompt | 🧪 | `visibilitychange` simulated |
| Repeated-tap protection | ✅ | |
| Detect files lost while away (tab unloaded) | ✅ | |

### Extras
| Feature | Status |
| --- | --- |
| Recent shops (opt-in, local only), repeat print that requires reselecting documents | ✅ |
| Recent print settings | ✅ |
| Cost estimator (per side rates + extras) | ✅ |
| Page counter, cost calculator, merge PDFs/images tools | ✅ |
| Combine to one PDF before sending | ✅ |
| Light/dark themes, large touch targets, keyboard and screen-reader labels | ✅ |
| Help screen, privacy controls ("Clear all app data") | ✅ |
| Installable PWA + offline shell | 🔶 | Service worker only in production builds |

### Not built
- Shop-side ordering via QR (the scanner already recognizes `printle:shop?phone=…&name=…` and `https://<host>/shop/?phone=…` codes and fills in the shop name).
- PDF page thumbnails (would need `pdfjs-dist`, ~1 MB).
- Receiving files *into* Printle from other apps (Web Share Target).

## Privacy

- OCR runs in a Web Worker on the device; camera frames and photos are never stored or sent.
- Documents are held in memory only. They are never written to `localStorage`/`sessionStorage` (a test asserts this) and are cleared on "Finish", "Clear all", or when the tab closes.
- Session state (shop number, settings) lives in `sessionStorage`; saved shops and presets in `localStorage`, only if the user opts in. "Clear all app data" wipes both.
- No analytics, no logging of numbers or filenames, no accounts, no server.
- Permissions are requested only when needed (camera on the scan screen, nothing else).

## Project layout

```
src/
  app/            Screens: / scan number documents options review send shops tools help
  components/     Scanner, AppShell, UI primitives, icons
  hooks/          Hydration, single-flight taps, return-from-app, share actions
  lib/            phone, ocr, qr, files, pdf, pageRange, job, cost, message, share/*
  store/          session (in-memory docs + sessionStorage) and prefs (localStorage)
scripts/          copy-ocr-assets.mjs
public/           icons, service worker (OCR assets are copied in at build time)
```

## Tests

`npm test` runs 122 tests (Vitest + Testing Library + jsdom). Real implementations are used for phone parsing, PDF parsing/merging (with generated PDFs), file validation, message and cost building, and state. **Mocks are used only for platform features jsdom can't provide**, and each test file that uses them says so in its header:

- `navigator.share` / `canShare` / clipboard — `src/lib/__tests__/share.test.ts`, `src/app/__tests__/flow.test.tsx`
- `getUserMedia` and the Tesseract worker — `src/components/__tests__/Scanner.test.tsx`, `flow.test.tsx`
- Next.js router/link, `URL.createObjectURL`, `matchMedia` — `src/test/setup.ts`

Covered edge cases include: Indian normalization, multiple OCR candidates, ambiguous/invalid numbers, camera denied, cancelled file selection, multiple documents, unsupported formats, corrupted and encrypted PDFs, returning from another app, Share API unavailable, no compatible share target, empty basket, repeated taps, and session/privacy cleanup.
