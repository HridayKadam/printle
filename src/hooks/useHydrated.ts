"use client";

import { create } from "zustand";

/** Becomes true once persisted stores have been read on the client. */
export const useHydration = create<{ hydrated: boolean; setHydrated(): void }>()((set) => ({
  hydrated: false,
  setHydrated: () => set({ hydrated: true }),
}));

export function useHydrated() {
  return useHydration((s) => s.hydrated);
}
