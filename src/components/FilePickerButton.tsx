"use client";

import { useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { buttonClass } from "./ui";

/** A button that opens the OS file picker. Cancelling the picker is a no-op. */
export function FilePickerButton({
  onFiles,
  accept,
  multiple = true,
  capture,
  icon,
  children,
  variant = "secondary",
  size = "md",
  full,
  label,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  capture?: "environment" | "user";
  icon?: IconName;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "lg" | "md" | "sm";
  full?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={buttonClass(variant, size, full)} onClick={() => input.current?.click()} aria-label={label}>
        {icon && <Icon name={icon} />}
        {children}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        capture={capture}
        data-testid={label ? `picker-${label}` : undefined}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
