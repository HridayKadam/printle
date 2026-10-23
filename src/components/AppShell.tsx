"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { APP_NAME } from "@/config/app";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const FLOW = [
  { key: "number", label: "Shop" },
  { key: "documents", label: "Files" },
  { key: "options", label: "Options" },
  { key: "review", label: "Review" },
  { key: "send", label: "Send" },
] as const;

export type FlowStep = (typeof FLOW)[number]["key"];

export function AppShell({
  title,
  back,
  step,
  children,
  footer,
  hideHeader,
}: {
  title?: string;
  /** Path to go back to; uses history when it's available. */
  back?: string;
  step?: FlowStep;
  children: ReactNode;
  /** Sticky bottom action area, within thumb reach. */
  footer?: ReactNode;
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const goBack = () => {
    if (back) router.push(back);
    else router.back();
  };
  const stepIndex = step ? FLOW.findIndex((f) => f.key === step) : -1;

  return (
    <div className="min-h-dvh flex flex-col">
      {!hideHeader && (
        <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line/60">
          <div className="mx-auto max-w-xl flex items-center gap-1 px-2 h-14">
            {back !== undefined ? (
              <button type="button" onClick={goBack} className="h-11 w-11 grid place-items-center rounded-xl hover:bg-surface-2" aria-label="Back">
                <Icon name="back" />
              </button>
            ) : (
              <Link href="/" className="h-11 px-2 flex items-center gap-2 font-bold text-[17px]" aria-label={`${APP_NAME} home`}>
                <Logo />
                {APP_NAME}
              </Link>
            )}
            <h1 className="flex-1 truncate text-[17px] font-semibold">{back !== undefined ? title : ""}</h1>
            <ThemeToggle />
          </div>
          {stepIndex >= 0 && (
            <nav aria-label="Progress" className="mx-auto max-w-xl px-4 pb-2">
              <ol className="flex gap-1.5">
                {FLOW.map((f, i) => (
                  <li key={f.key} className="flex-1">
                    <div className={`h-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-line"}`} />
                    <span
                      className={`mt-1 block text-[11px] font-medium ${i === stepIndex ? "text-ink" : "text-muted"}`}
                      aria-current={i === stepIndex ? "step" : undefined}
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </header>
      )}
      <main className="flex-1 mx-auto w-full max-w-xl px-4 pt-4 pb-6">{children}</main>
      {footer && (
        <div className="sticky bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        </div>
      )}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M10 8h9l4 4v12H10z" fill="none" stroke="var(--primary-contrast)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 17h5M14 21h3" stroke="var(--primary-contrast)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
