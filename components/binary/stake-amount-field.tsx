"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

type Props = {
  /** Canonical stake in KES (ledger). */
  stakeKes: number;
  setStakeKes: (kes: number) => void;
  minStakeKes: number;
  /** Display currency unit shown beside the field (e.g. "$" or "KSh"). */
  unit: string;
  /** Convert KES → display units for the field. */
  toDisplay: (kes: number) => number;
  /** Convert typed display units → KES. */
  toKes: (display: number) => number;
  className?: string;
  fieldClassName?: string;
};

/**
 * Editable stake stepper. Draft string while typing so clearing/partial input
 * isn’t clamped back to min on every keystroke. Desktop empty-field hint: $0.0
 * (or `{unit}0.0`); mobile placeholder stays blank.
 */
export function StakeAmountField({
  stakeKes,
  setStakeKes,
  minStakeKes,
  unit,
  toDisplay,
  toKes,
  className = "",
  fieldClassName = "",
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

  const displayValue = toDisplay(stakeKes);
  const committed = Number.isFinite(displayValue)
    ? String(Number(displayValue.toFixed(2)))
    : "";

  useEffect(() => {
    if (!focused) setDraft(null);
  }, [stakeKes, focused]);

  const shown = draft !== null ? draft : committed;
  const placeholder =
    focused && draft === ""
      ? isDesktop
        ? unit === "$" || unit === "USD"
          ? "$0.0"
          : `${unit}0.0`
        : ""
      : "";

  function commit(raw: string) {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    if (cleaned === "" || cleaned === ".") {
      setStakeKes(minStakeKes);
      setDraft(null);
      return;
    }
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) {
      setStakeKes(minStakeKes);
      setDraft(null);
      return;
    }
    setStakeKes(Math.max(minStakeKes, Math.round(toKes(n))));
    setDraft(null);
  }

  function nudge(deltaDisplay: number) {
    const base = draft !== null && draft !== "" ? Number(draft) : displayValue;
    const next = (Number.isFinite(base) ? base : 0) + deltaDisplay;
    setStakeKes(Math.max(minStakeKes, Math.round(toKes(Math.max(0, next)))));
    setDraft(null);
  }

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <div
        className={`flex flex-1 items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06] ${fieldClassName}`}
      >
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="grid h-6 w-7 shrink-0 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10"
          aria-label="Decrease stake"
        >
          <Icon name="remove" className="text-[14px] sm:text-[18px]" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          placeholder={placeholder}
          onFocus={() => {
            setFocused(true);
            setDraft("");
          }}
          onBlur={() => {
            setFocused(false);
            commit(draft ?? "");
          }}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none placeholder:text-slate-500 sm:text-[15px]"
        />
        <button
          type="button"
          onClick={() => nudge(1)}
          className="grid h-6 w-7 shrink-0 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10"
          aria-label="Increase stake"
        >
          <Icon name="add" className="text-[14px] sm:text-[18px]" />
        </button>
      </div>
      <span className="flex items-center rounded-md bg-[#0f1319] px-2 text-[11px] font-black text-slate-200 ring-1 ring-white/[0.06] sm:px-3 sm:text-[13px]">
        {unit}
      </span>
    </div>
  );
}
