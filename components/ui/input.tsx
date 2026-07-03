"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

// ─── Input ───────────────────────────────────────────────────────────────────
// Token-driven text field with a built-in label + error slot and wired-up
// accessibility (label htmlFor, aria-invalid, aria-describedby). Replaces the
// hand-rolled `<input className="rounded-lg bg-white/[0.08] …">` variants.

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold text-on-surface-variant">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-lg bg-surface-container-high px-3 text-sm text-on-surface",
          "ring-1 ring-outline-variant outline-none transition-[box-shadow] duration-fast",
          "placeholder:text-on-surface-variant/50",
          "focus-visible:ring-2 focus-visible:ring-primary-fixed/70",
          "disabled:opacity-50 disabled:pointer-events-none",
          error && "ring-error/60 focus-visible:ring-error/70",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs font-medium text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
