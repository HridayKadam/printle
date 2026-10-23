"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "whatsapp";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:brightness-95",
  whatsapp: "bg-whatsapp text-white hover:brightness-110 shadow-sm",
};

const SIZES = {
  lg: "min-h-14 px-5 text-[17px] rounded-2xl gap-2.5",
  md: "min-h-12 px-4 text-[15px] rounded-xl gap-2",
  sm: "min-h-10 px-3 text-sm rounded-lg gap-1.5",
};

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", full = false) {
  return [
    "inline-flex items-center justify-center font-semibold transition-colors select-none",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    full ? "w-full" : "",
  ].join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  icon?: IconName;
  full?: boolean;
  busy?: boolean;
}

export function Button({ variant, size, icon, full, busy, children, className = "", disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${buttonClass(variant, size, full)} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant,
  size,
  icon,
  full,
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  icon?: IconName;
  full?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant, size, full)} ${className}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface border border-line ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-6 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  icon,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
  icon?: IconName;
}) {
  const tones = {
    info: "bg-primary-soft text-ink",
    warning: "bg-warning-soft text-ink",
    danger: "bg-danger-soft text-ink",
    success: "bg-success-soft text-ink",
  };
  const iconColor = { info: "text-primary", warning: "text-warning", danger: "text-danger", success: "text-success" };
  const fallback: Record<string, IconName> = { info: "info", warning: "alert", danger: "alert", success: "check" };
  return (
    <div className={`flex gap-3 rounded-xl p-3.5 text-[14px] leading-snug ${tones[tone]}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon name={icon ?? fallback[tone]} size={20} className={`shrink-0 mt-px ${iconColor[tone]}`} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="py-2">
      <div id={id} className="text-[14px] font-medium text-muted mb-1.5">
        {label}
      </div>
      <div className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`min-h-11 rounded-lg px-2 text-[14px] font-semibold transition-colors ${
                active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-start gap-3 py-2.5 cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {description ? <span className="block text-[13px] text-muted mt-0.5">{description}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-primary/40" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function CountStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface" role="group" aria-label={label}>
      <button
        type="button"
        className="h-11 w-11 grid place-items-center rounded-l-xl hover:bg-surface-2 disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Icon name="minus" size={18} />
      </button>
      <output className="w-10 text-center text-[16px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="h-11 w-11 grid place-items-center rounded-r-xl hover:bg-surface-2 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="h-14 w-14 rounded-2xl bg-primary-soft text-primary grid place-items-center mb-3">
        <Icon name={icon} size={26} />
      </div>
      <p className="text-[16px] font-semibold">{title}</p>
      {children ? <div className="text-[14px] text-muted mt-1 max-w-xs">{children}</div> : null}
    </div>
  );
}
