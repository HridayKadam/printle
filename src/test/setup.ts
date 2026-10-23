import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

// MOCK (platform): Next's router and Link need the App Router runtime, which
// doesn't exist in jsdom. Tests assert on `routerPush` instead.
export const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

// MOCK (platform): jsdom has no object URLs or matchMedia.
if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => "blob:mock");
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  routerPush.mockReset();
});
