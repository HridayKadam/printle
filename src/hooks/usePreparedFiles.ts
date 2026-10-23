"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { combineToPdf } from "@/lib/pdf";
import { readyDocs, useSession } from "@/store/session";

interface PreparedState {
  key: string | null;
  file: File | null;
  status: "idle" | "working" | "ready" | "error";
  error?: string;
}

const usePrepared = create<PreparedState>()(() => ({ key: null, file: null, status: "idle" }));

/**
 * The exact files that will be shared. A combined PDF is built ahead of time:
 * share sheets must open directly from a tap, with no slow work in between.
 */
export function usePreparedFiles(): { files: File[]; status: PreparedState["status"]; error?: string } {
  const allDocs = useSession((s) => s.docs);
  const combine = useSession((s) => s.combine);
  const docs = useMemo(() => readyDocs(allDocs), [allDocs]);
  const useCombined = combine && docs.length > 1 && !docs.some((d) => d.encrypted);
  const key = useCombined ? docs.map((d) => `${d.id}:${d.pageRange}`).join("|") : null;
  const prepared = usePrepared();

  useEffect(() => {
    if (!key || usePrepared.getState().key === key) return;
    usePrepared.setState({ key, file: null, status: "working", error: undefined });
    combineToPdf(docs.map((d) => ({ file: d.file, kind: d.kind, mime: d.mime ?? d.file.type, pageRange: d.pageRange, pageCount: d.pageCount })))
      .then((file) => {
        if (usePrepared.getState().key === key) usePrepared.setState({ file, status: "ready" });
      })
      .catch((err: Error) => {
        if (usePrepared.getState().key === key) {
          usePrepared.setState({ status: "error", error: err.message || "Couldn't combine these files." });
        }
      });
  }, [key, docs]);

  if (!useCombined) return { files: docs.map((d) => d.file), status: "ready" };
  if (prepared.key !== key) return { files: [], status: "working" };
  return { files: prepared.file ? [prepared.file] : [], status: prepared.status, error: prepared.error };
}

export function clearPreparedFiles() {
  usePrepared.setState({ key: null, file: null, status: "idle", error: undefined });
}
