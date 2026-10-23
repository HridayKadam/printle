"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/config/app";
import type { Rates } from "@/lib/cost";
import type { PhoneCandidate } from "@/lib/phone";
import { settingsEqual, type Preset, type PrintSettings } from "@/lib/printSettings";
import { stateStorage, uid } from "@/lib/storage";

/** A shop the user chose to remember. Stored only on this device, never as a phone contact. */
export interface Shop {
  id: string;
  nickname: string;
  phone: PhoneCandidate;
  lastUsed: number;
  timesUsed: number;
  location?: string;
  notes?: string;
  rates?: Rates;
  lastSettings?: PrintSettings;
}

interface PrefsState {
  shops: Shop[];
  customPresets: Preset[];
  recentSettings: PrintSettings[];
  onboarded: boolean;

  saveShop(input: Omit<Shop, "id" | "lastUsed" | "timesUsed"> & { id?: string }): Shop;
  touchShop(id: string, patch?: Partial<Pick<Shop, "rates" | "lastSettings">>): void;
  updateShop(id: string, patch: Partial<Pick<Shop, "nickname" | "location" | "notes">>): void;
  removeShop(id: string): void;
  clearShops(): void;
  findShopByNumber(e164: string): Shop | undefined;

  savePreset(name: string, settings: PrintSettings, note?: string): void;
  removePreset(id: string): void;
  rememberSettings(s: PrintSettings): void;
  clearRecentSettings(): void;
  setOnboarded(v: boolean): void;
  clearAll(): void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      shops: [],
      customPresets: [],
      recentSettings: [],
      onboarded: false,

      saveShop: (input) => {
        const existing = get().shops.find((s) => s.id === input.id || s.phone.e164 === input.phone.e164);
        const shop: Shop = existing
          ? { ...existing, ...input, id: existing.id, lastUsed: Date.now() }
          : { ...input, id: uid(), lastUsed: Date.now(), timesUsed: 0 };
        set((s) => ({ shops: [shop, ...s.shops.filter((x) => x.id !== shop.id)] }));
        return shop;
      },
      touchShop: (id, patch) =>
        set((s) => ({
          shops: s.shops
            .map((x) => (x.id === id ? { ...x, ...patch, lastUsed: Date.now(), timesUsed: x.timesUsed + 1 } : x))
            .sort((a, b) => b.lastUsed - a.lastUsed),
        })),
      updateShop: (id, patch) => set((s) => ({ shops: s.shops.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeShop: (id) => set((s) => ({ shops: s.shops.filter((x) => x.id !== id) })),
      clearShops: () => set({ shops: [] }),
      findShopByNumber: (e164) => get().shops.find((s) => s.phone.e164 === e164),

      savePreset: (name, settings, note) =>
        set((s) => ({
          customPresets: [
            ...s.customPresets,
            { id: `custom-${uid()}`, name, description: "Your preset", settings, note },
          ],
        })),
      removePreset: (id) => set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) })),
      rememberSettings: (settings) =>
        set((s) => ({
          recentSettings: [settings, ...s.recentSettings.filter((r) => !settingsEqual(r, settings))].slice(0, 5),
        })),
      clearRecentSettings: () => set({ recentSettings: [] }),
      setOnboarded: (onboarded) => set({ onboarded }),
      clearAll: () => set({ shops: [], customPresets: [], recentSettings: [], onboarded: false }),
    }),
    {
      name: STORAGE_KEYS.prefs,
      storage: createJSONStorage(() => stateStorage("local")),
      skipHydration: true,
    },
  ),
);
