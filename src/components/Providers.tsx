"use client";

import { useEffect, type ReactNode } from "react";
import { useHydration } from "@/hooks/useHydrated";
import { usePrefs } from "@/store/prefs";
import { useSession } from "@/store/session";
import { Toaster } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  const setHydrated = useHydration((s) => s.setHydrated);

  useEffect(() => {
    Promise.all([useSession.persist.rehydrate(), usePrefs.persist.rehydrate()]).finally(setHydrated);
  }, [setHydrated]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a bonus; the app works without it.
    });
  }, []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
