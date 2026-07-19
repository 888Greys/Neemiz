"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";

const UNSIGNED_RE = /^\d*\.?\d*$/;
const SIGNED_RE = /^-?\d*\.?\d*$/;
const INT_RE = /^\d*$/;
const SIGNED_INT_RE = /^-?\d*$/;

type Props = {
  value: number;
  onCommit: (n: number) => void;
  /** Step for +/- buttons. */
  step?: number;
  /** Allow a leading `-` while typing / committing. */
  signed?: boolean;
  /** Integers only (duration ticks, etc.). */
  integer?: boolean;
  /** Display decimals when not drafting (ignored when integer). Default 2. */
  decimals?: number;
  /** Clamp / normalize on blur, Enter, and steppers — never while typing. */
  clamp: (n: number) => number;
  /** Value used when the field is left empty / invalid. Defaults to clamp(0). */
  emptyValue?: number;
  /** Desktop empty-field hint while focused (e.g. `0.0`). Mobile stays blank. */
  placeholderDesktop?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
  className?: string;
  inputClassName?: string;
  /** Optional trailing slot (e.g. "ticks"). */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Fired when the input gains / loses focus (e.g. chart barrier pulse). */
  onFocusChange?: (focused: boolean) => void;
};

/**
 * Stepper with a draft string while typing. Focus clears to blank; clamp only
 * on blur / Enter / +/-. Prevents leftover `0` becoming `01` on keystroke.
 */
export function DraftNumberField({
  value,
  onCommit,
  step = 1,
  signed = false,
  integer = false,
  decimals = 2,
  clamp,
  emptyValue,
  placeholderDesktop = "0.0",
  decreaseLabel = "Decrease",
  increaseLabel = "Increase",
  className = "",
  inputClassName = "",
  trailing,
  disabled = false,
  onFocusChange,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const committed = Number.isFinite(value)
    ? integer
      ? String(Math.round(value))
      : String(Number(value.toFixed(decimals)))
    : "";

  useEffect(() => {
    if (!focused) setDraft(null);
  }, [value, focused]);

  const shown = draft !== null ? draft : committed;
  const placeholder =
    focused && draft === ""
      ? isDesktop
        ? integer
          ? "0"
          : placeholderDesktop
        : ""
      : "";

  const draftRe = integer
    ? signed
      ? SIGNED_INT_RE
      : INT_RE
    : signed
      ? SIGNED_RE
      : UNSIGNED_RE;

  function resolveEmpty(): number {
    return emptyValue !== undefined ? clamp(emptyValue) : clamp(0);
  }

  function commit(raw: string) {
    const cleaned = raw.trim();
    if (
      cleaned === "" ||
      cleaned === "-" ||
      cleaned === "." ||
      cleaned === "-."
    ) {
      onCommit(resolveEmpty());
      setDraft(null);
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      onCommit(resolveEmpty());
      setDraft(null);
      return;
    }
    onCommit(clamp(n));
    setDraft(null);
  }

  function nudge(dir: 1 | -1) {
    const base =
      draft !== null && draft !== "" && draft !== "-"
        ? Number(draft)
        : value;
    const next = (Number.isFinite(base) ? base : 0) + dir * step;
    onCommit(clamp(next));
    setDraft(null);
  }

  return (
    <div className={`flex min-w-0 flex-1 items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06] ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => nudge(-1)}
        className="grid h-6 w-7 shrink-0 place-items-center text-slate-300 hover:text-white disabled:opacity-40 sm:h-9 sm:w-10"
        aria-label={decreaseLabel}
      >
        <Icon name="remove" className="text-[14px] sm:text-[18px]" />
      </button>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        disabled={disabled}
        value={shown}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          setDraft("");
          onFocusChange?.(true);
        }}
        onBlur={() => {
          setFocused(false);
          commit(draft ?? "");
          onFocusChange?.(false);
        }}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || draftRe.test(v)) setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none placeholder:text-slate-500 disabled:opacity-40 sm:text-[15px] ${inputClassName}`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => nudge(1)}
        className="grid h-6 w-7 shrink-0 place-items-center text-slate-300 hover:text-white disabled:opacity-40 sm:h-9 sm:w-10"
        aria-label={increaseLabel}
      >
        <Icon name="add" className="text-[14px] sm:text-[18px]" />
      </button>
      {trailing}
    </div>
  );
}
