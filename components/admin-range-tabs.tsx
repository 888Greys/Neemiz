"use client";

import { ADMIN_RANGES, type AdminRange } from "@/lib/admin/ranges";

// Shared time-range selector used by every windowed admin page, so the filter
// looks and behaves identically across Cockpit, Markets, Money, and Players.
export function RangeTabs({ value, onChange }: { value: AdminRange; onChange: (r: AdminRange) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
      {ADMIN_RANGES.map(([r, l]) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1 text-[10px] font-black transition ${value === r ? "bg-[#087cff] text-white" : "text-slate-500 hover:text-slate-300"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
