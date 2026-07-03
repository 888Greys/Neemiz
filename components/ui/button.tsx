"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

// ─── Button ──────────────────────────────────────────────────────────────────
// The single, accessible button primitive for the whole app. Consumes the
// design tokens in tailwind.config.ts (primary / surface / on-surface…) rather
// than hardcoded hex, so a theme change is one place, not 68 files.
//
// Craft notes:
//  • `focus-visible` ring for keyboard users (was missing app-wide).
//  • `disabled` + `loading` both block interaction; loading shows a spinner and
//    keeps the label width stable (no layout shift).
//  • `aria-busy` while loading so screen readers announce the pending state.
//  • honors prefers-reduced-motion via the spinner's motion-reduce guard.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold " +
  "transition-[background,color,box-shadow,transform] duration-fast ease-out " +
  "select-none outline-none " +
  "focus-visible:ring-2 focus-visible:ring-primary-fixed/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "active:scale-[0.98] " +
  "disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary:   "bg-primary text-on-primary hover:bg-primary-container shadow-sm shadow-primary/25",
  secondary: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest ring-1 ring-outline-variant",
  ghost:     "bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  outline:   "bg-transparent text-on-surface ring-1 ring-outline-variant hover:bg-surface-container-high",
  danger:    "bg-error text-on-primary hover:brightness-110 shadow-sm shadow-error/25",
};

const sizes: Record<ButtonSize, string> = {
  sm:   "h-9 px-3 text-xs",
  md:   "h-11 px-4 text-sm",
  lg:   "h-12 px-6 text-base",
  icon: "h-11 w-11 p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="absolute inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none"
        />
      )}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
    </button>
  );
});
