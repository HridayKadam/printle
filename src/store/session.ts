"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LIMITS, STORAGE_KEYS } from "@/config/app";
import { EMPTY_RATES, type Rates } from "@/lib/cost";
import { formatBytes, inspectFile, normalizedFile, type SupportedMime } from "@/lib/files";
import type { JobDoc } from "@/lib/job";
import type { PhoneCandidate } from "@/lib/phone";
import { DEFAULT_SETTINGS, type Preset, type PrintSettings } from "@/lib/printSettings";
import type { ShareMethodId } from "@/lib/share/methods";
import { stateStorage, uid } from "@/lib/storage";

export interface DocItem extends JobDoc {
  file: File;
  size: number;
  mime: SupportedMime | null;
  status: "checking" | "ready" | "error";
  error?: string;
  warning?: string;
  encrypted?: boolean;
  /** Object URL for image thumbnails; revoked when the document is removed. */
  previewUrl?: string;
}

export interface Handoff {
  method: ShareMethodId;
  startedAt: number;
  chatOpened: boolean;
  filesShared: boolean;
  /** The user told us they finished in the other app. */
  confirmedByUser: boolean;
}

export interface Rejection {
  name: string;
  reason: string;
}

interface SessionState {
  phone: PhoneCandidate | null;
  shopId: string | null;
  shopName: string;
  /** Held in memory only. Never written to storage. */
  docs: DocItem[];
  /** Persisted flag so we can tell the user if the browser dropped their files. */
  hadDocs: boolean;
  /** Files that were refused, with the reason. Shown on the documents screen. */
  rejections: Rejection[];
  settings: PrintSettings;
  presetId: string | null;
  note: string;
  includeFileNames: boolean;
  messageDraft: string | null;
  combine: boolean;
  rates: Rates;
  method: ShareMethodId;
  handoff: Handoff | null;

  setPhone(phone: PhoneCandidate | null, shop?: { id?: string | null; name?: string }): void;
  addFiles(files: File[]): Rejection[];
  dismissRejections(): void;
  replaceDoc(id: string, file: File): Rejection[];
  removeDoc(id: string): void;
  moveDoc(id: string, delta: -1 | 1): void;
  updateDoc(id: string, patch: Partial<Pick<DocItem, "copies" | "pageRange">>): void;
  clearDocs(): void;
  setSettings(patch: Partial<PrintSettings>): void;
  applyPreset(preset: Preset): void;
  setNote(note: string): void;
  setIncludeFileNames(v: boolean): void;
  setMessageDraft(v: string | null): void;
  setCombine(v: boolean): void;
  setRates(r: Partial<Rates>): void;
  setMethod(m: ShareMethodId): void;
  startHandoff(method: ShareMethodId): void;
  updateHandoff(patch: Partial<Handoff>): void;
  loadRepeat(input: { phone: PhoneCandidate; shopId: string; shopName: string; settings?: PrintSettings; rates?: Rates }): void;
  resetSession(): void;
}

const initial = {
  phone: null,
  shopId: null,
  shopName: "",
  docs: [] as DocItem[],
  hadDocs: false,
  rejections: [] as Rejection[],
  settings: DEFAULT_SETTINGS,
  presetId: null,
  note: "",
  includeFileNames: false,
  messageDraft: null,
  combine: false,
  rates: EMPTY_RATES,
  method: "whatsapp" as ShareMethodId,
  handoff: null,
};

function revoke(doc: DocItem) {
  if (doc.previewUrl) URL.revokeObjectURL(doc.previewUrl);
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => {
      const inspectInto = (id: string, file: File) => {
        inspectFile(file).then(
          (info) => {
            if (!info.ok) {
              // Unusable files leave the basket straight away; the reason is shown instead.
              set((s) => {
                const docs = s.docs.filter((d) => d.id !== id);
                return {
                  docs,
                  hadDocs: docs.length > 0,
                  rejections: [...s.rejections, { name: file.name, reason: info.error ?? "Can't use this file." }],
                };
              });
              return;
            }
            set((s) => ({
              docs: s.docs.map((d) => {
                if (d.id !== id) return d;
                const normalized = info.mime ? normalizedFile(file, info.mime) : file;
                const previewUrl = info.kind === "image" ? URL.createObjectURL(normalized) : undefined;
                return {
                  ...d,
                  file: normalized,
                  name: normalized.name,
                  status: "ready",
                  kind: info.kind ?? d.kind,
                  mime: info.mime ?? null,
                  pageCount: info.pageCount,
                  warning: info.warning,
                  encrypted: info.encrypted,
                  previewUrl,
                };
              }),
            }));
          },
          () => {
            set((s) => {
              const docs = s.docs.filter((d) => d.id !== id);
              return { docs, hadDocs: docs.length > 0, rejections: [...s.rejections, { name: file.name, reason: "Couldn't read this file." }] };
            });
          },
        );
      };

      const makeDoc = (file: File): DocItem => ({
        id: uid(),
        file,
        name: file.name || "document",
        size: file.size,
        kind: /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name) ? "pdf" : "image",
        mime: null,
        pageCount: null,
        copies: null,
        pageRange: "",
        status: "checking",
      });

      return {
        ...initial,

        setPhone: (phone, shop) =>
          set({ phone, shopId: shop?.id ?? null, shopName: shop?.name ?? "", handoff: null }),

        addFiles: (files) => {
          const rejected: Rejection[] = [];
          const accepted: DocItem[] = [];
          let count = get().docs.length;
          let total = get().docs.reduce((n, d) => n + d.size, 0);
          for (const file of files) {
            if (count >= LIMITS.maxFiles) {
              rejected.push({ name: file.name, reason: `You can add up to ${LIMITS.maxFiles} files.` });
              continue;
            }
            if (total + file.size > LIMITS.maxTotalBytes) {
              rejected.push({ name: file.name, reason: `Total size would exceed ${formatBytes(LIMITS.maxTotalBytes)}.` });
              continue;
            }
            const dup = get().docs.some((d) => d.name === file.name && d.size === file.size && d.file.lastModified === file.lastModified);
            if (dup) {
              rejected.push({ name: file.name, reason: "Already added." });
              continue;
            }
            accepted.push(makeDoc(file));
            count++;
            total += file.size;
          }
          set((s) => ({
            docs: [...s.docs, ...accepted],
            hadDocs: s.docs.length + accepted.length > 0,
            rejections: rejected,
            messageDraft: accepted.length ? null : s.messageDraft,
          }));
          accepted.forEach((d) => inspectInto(d.id, d.file));
          return rejected;
        },

        dismissRejections: () => set({ rejections: [] }),

        replaceDoc: (id, file) => {
          const old = get().docs.find((d) => d.id === id);
          if (!old) return [];
          if (file.size > LIMITS.maxFileBytes) {
            const r = [{ name: file.name, reason: `Too large. The limit is ${formatBytes(LIMITS.maxFileBytes)}.` }];
            set({ rejections: r });
            return r;
          }
          revoke(old);
          const next = { ...makeDoc(file), id, copies: old.copies };
          set((s) => ({ docs: s.docs.map((d) => (d.id === id ? next : d)), messageDraft: null }));
          inspectInto(id, file);
          return [];
        },

        removeDoc: (id) =>
          set((s) => {
            const doc = s.docs.find((d) => d.id === id);
            if (doc) revoke(doc);
            const docs = s.docs.filter((d) => d.id !== id);
            return { docs, hadDocs: docs.length > 0, messageDraft: null };
          }),

        moveDoc: (id, delta) =>
          set((s) => {
            const i = s.docs.findIndex((d) => d.id === id);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= s.docs.length) return s;
            const docs = [...s.docs];
            [docs[i], docs[j]] = [docs[j], docs[i]];
            return { docs, messageDraft: null };
          }),

        updateDoc: (id, patch) =>
          set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)), messageDraft: null })),

        clearDocs: () =>
          set((s) => {
            s.docs.forEach(revoke);
            return { docs: [], hadDocs: false, rejections: [], messageDraft: null, combine: false };
          }),

        setSettings: (patch) =>
          set((s) => ({ settings: { ...s.settings, ...patch }, presetId: "custom", messageDraft: null })),

        applyPreset: (preset) =>
          set((s) => ({
            settings: { ...preset.settings, copies: s.settings.copies },
            presetId: preset.id,
            note: preset.note && !s.note ? preset.note : s.note,
            messageDraft: null,
          })),

        setNote: (note) => set({ note, messageDraft: null }),
        setIncludeFileNames: (includeFileNames) => set({ includeFileNames, messageDraft: null }),
        setMessageDraft: (messageDraft) => set({ messageDraft }),
        setCombine: (combine) => set({ combine, messageDraft: null }),
        setRates: (r) => set((s) => ({ rates: { ...s.rates, ...r }, messageDraft: null })),
        setMethod: (method) => set({ method }),

        startHandoff: (method) =>
          set({ handoff: { method, startedAt: Date.now(), chatOpened: false, filesShared: false, confirmedByUser: false } }),
        updateHandoff: (patch) => set((s) => (s.handoff ? { handoff: { ...s.handoff, ...patch } } : s)),

        loadRepeat: ({ phone, shopId, shopName, settings, rates }) => {
          get().docs.forEach(revoke);
          set({
            ...initial,
            phone,
            shopId,
            shopName,
            settings: settings ?? DEFAULT_SETTINGS,
            presetId: settings ? "custom" : null,
            rates: rates ?? EMPTY_RATES,
          });
        },

        resetSession: () => {
          get().docs.forEach(revoke);
          set({ ...initial });
        },
      };
    },
    {
      name: STORAGE_KEYS.session,
      // sessionStorage: cleared when the tab closes. Files are never persisted.
      storage: createJSONStorage(() => stateStorage("session")),
      skipHydration: true,
      partialize: (s) => ({
        phone: s.phone,
        shopId: s.shopId,
        shopName: s.shopName,
        hadDocs: s.hadDocs,
        settings: s.settings,
        presetId: s.presetId,
        note: s.note,
        includeFileNames: s.includeFileNames,
        messageDraft: s.messageDraft,
        combine: s.combine,
        rates: s.rates,
        method: s.method,
        handoff: s.handoff,
      }),
    },
  ),
);

/** Documents that are ready to be shared, in order. */
export function readyDocs(docs: DocItem[]): DocItem[] {
  return docs.filter((d) => d.status === "ready");
}
