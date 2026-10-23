/** Storage access that never throws (private mode, blocked cookies, SSR). */
export function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    const k = "__printle_probe__";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>();

/** A zustand-compatible StateStorage that falls back to memory. */
export function stateStorage(kind: "local" | "session") {
  return {
    getItem: (name: string) => safeStorage(kind)?.getItem(name) ?? memory.get(`${kind}:${name}`) ?? null,
    setItem: (name: string, value: string) => {
      const s = safeStorage(kind);
      if (s) s.setItem(name, value);
      else memory.set(`${kind}:${name}`, value);
    },
    removeItem: (name: string) => {
      safeStorage(kind)?.removeItem(name);
      memory.delete(`${kind}:${name}`);
    },
  };
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
