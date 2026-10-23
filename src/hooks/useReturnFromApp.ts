"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onReturn` when the page becomes visible again after being hidden for
 * at least `minAwayMs` — e.g. the user switched to WhatsApp and came back.
 */
export function useReturnFromApp(onReturn: (awayMs: number) => void, minAwayMs = 800) {
  const hiddenAt = useRef<number | null>(null);
  const cb = useRef(onReturn);
  useEffect(() => {
    cb.current = onReturn;
  });
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null) {
        const away = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (away >= minAwayMs) cb.current(away);
      }
    };
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("pageshow", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("pageshow", onChange);
    };
  }, [minAwayMs]);
}
