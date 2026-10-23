"use client";

import { create } from "zustand";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
}

const useToasts = create<{ toasts: Toast[]; push(t: Omit<Toast, "id">): void; dismiss(id: number): void }>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(text: string, tone: Toast["tone"] = "info") {
  useToasts.getState().push({ text, tone });
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite" role="status">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`animate-in pointer-events-auto max-w-sm rounded-xl px-4 py-3 text-[14px] font-medium shadow-lg ${
            t.tone === "danger" ? "bg-danger text-white" : t.tone === "success" ? "bg-success text-white" : "bg-ink text-bg"
          }`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
