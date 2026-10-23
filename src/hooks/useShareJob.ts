"use client";

import { useMemo } from "react";
import { estimateCost } from "@/lib/cost";
import { buildShopMessage } from "@/lib/message";
import { readyDocs, useSession } from "@/store/session";

/** The generated or user-edited message, plus the cost estimate it is based on. */
export function useShareJob() {
  const allDocs = useSession((s) => s.docs);
  const settings = useSession((s) => s.settings);
  const note = useSession((s) => s.note);
  const includeFileNames = useSession((s) => s.includeFileNames);
  const rates = useSession((s) => s.rates);
  const combine = useSession((s) => s.combine);
  const draft = useSession((s) => s.messageDraft);

  return useMemo(() => {
    const docs = readyDocs(allDocs);
    const combined = combine && docs.length > 1 && !docs.some((d) => d.encrypted);
    const estimate = estimateCost(docs, settings, rates);
    const generated = buildShopMessage({ docs, settings, includeFileNames, note, estimate, combined });
    return { docs, estimate, generated, message: draft ?? generated, edited: draft !== null && draft !== generated, combined };
  }, [allDocs, settings, note, includeFileNames, rates, combine, draft]);
}
