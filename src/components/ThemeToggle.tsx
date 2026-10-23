"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/config/app";
import { safeStorage } from "@/lib/storage";
import { Icon } from "./Icon";

type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0d1018" : "#f6f7fb");
}

/** Runs before first paint (inlined in <head>) so there's no flash of the wrong theme. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEYS.theme}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = (safeStorage("local")?.getItem(STORAGE_KEYS.theme) as Theme | null) ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from storage after mount
    setTheme(saved);
    setIsDark(document.documentElement.classList.contains("dark"));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const t = (safeStorage("local")?.getItem(STORAGE_KEYS.theme) as Theme | null) ?? "system";
      if (t === "system") {
        applyTheme("system");
        setIsDark(mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cycle = () => {
    // Toggle between light and dark; long-term "system" is the default until the user picks.
    const next: Theme = isDark ? "light" : "dark";
    safeStorage("local")?.setItem(STORAGE_KEYS.theme, next);
    applyTheme(next);
    setTheme(next);
    setIsDark(next === "dark");
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className="h-11 w-11 grid place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "system" ? "Following system theme" : undefined}
    >
      <Icon name={isDark ? "sun" : "moon"} />
    </button>
  );
}
