"use client";

import { useRef } from "react";
import { ADMIN_RANGES, isDayRange, dayOf, type AdminRangeValue } from "@/lib/admin/ranges";
import { Icon } from "@/components/icon";

// Shared time-range selector used by every windowed admin page, so the filter
// looks and behaves identically across Cockpit, Markets, Money, and Players.
// Beyond the preset tabs it carries a calendar button: picking a date selects
// that single Nairobi calendar day (a "day:YYYY-MM-DD" token).
export function RangeTabs({
  value,
  onChange,
}: {
  value: AdminRangeValue;
  onChange: (r: AdminRangeValue) => void;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const onDay = isDayRange(value);
  // Default the picker to the selected day, else today (Nairobi ≈ local here).
  const pickerValue = onDay ? dayOf(value) : new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
      {ADMIN_RANGES.map(([r, l]) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1 text-[10px] font-black transition ${value === r ? "bg-[#087cff] text-white" : "text-slate-500 hover:text-slate-300"}`}
        >
          {l}
        </button>
      ))}

      {/* Calendar picker — pick any single day. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.click()}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-black transition ${onDay ? "bg-[#087cff] text-white" : "text-slate-500 hover:text-slate-300"}`}
          title="Pick a specific day"
        >
          <Icon name="calendar_month" size={13} />
          {onDay && <span>{dayOf(value)}</span>}
        </button>
        <input
          ref={dateRef}
          type="date"
          value={pickerValue}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => e.target.value && onChange(`day:${e.target.value}`)}
          className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </div>
    </div>
  );
}
