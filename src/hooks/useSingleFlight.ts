"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wrap an async action so repeated taps while it runs are ignored.
 * Share sheets in particular throw if a second share starts before the first closes.
 */
export function useSingleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (running.current) return undefined;
      running.current = true;
      setBusy(true);
      try {
        return await fn(...args);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [fn],
  );
  return [run, busy] as const;
}
