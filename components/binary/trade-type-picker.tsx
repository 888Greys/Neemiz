"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import {
  TRADE_TYPES,
  TRADE_CATEGORIES,
  type TradeCategory,
  type TradeTypeId,
} from "./trade-types";

export function TradeTypePicker({
  value,
  onSelect,
  onClose,
  allowed,
}: {
  value: TradeTypeId;
  onSelect: (id: TradeTypeId) => void;
  onClose: () => void;
  allowed: Set<TradeTypeId>;
}) {
  const allowedTypes = useMemo(() => TRADE_TYPES.filter((t) => allowed.has(t.id)), [allowed]);

  const visibleCategories = useMemo(() => {
    return TRADE_CATEGORIES.filter((c) =>
      allowedTypes.some((t) => t.categories.includes(c.id))
    );
  }, [allowedTypes]);

  const [cat, setCat] = useState<TradeCategory>(() => {
    const hasOptions = allowedTypes.some((t) => t.categories.includes("options"));
    return hasOptions ? "options" : "all";
  });
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Auto-focus the search only on desktop. On mobile, focusing pops the
  // keyboard and squashes the layout — let it land on the list instead.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) inputRef.current?.focus();
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      allowedTypes.filter(
        (t) =>
          t.categories.includes(cat) &&
          (term === "" || t.label.toLowerCase().includes(term)),
      ),
    [allowedTypes, cat, term],
  );

  // Group the filtered list by section heading, preserving catalogue order.
  const groups = useMemo(() => {
    const out: { group: string; items: typeof TRADE_TYPES }[] = [];
    for (const t of filtered) {
      const last = out[out.length - 1];
      if (last && last.group === t.group) last.items.push(t);
      else out.push({ group: t.group, items: [t] });
    }
    return out;
  }, [filtered]);

  return (
    <>
      {/* Backdrop over the chart area only — the trade panel (right) stays
          visible and interactive, like Deriv. */}
      <div className="fixed inset-x-0 bottom-14 top-14 z-30 bg-black/40 xl:absolute xl:inset-y-0 xl:left-0 xl:right-[340px]" onClick={onClose} />

      {/* Drawer — slides in from the right, its right edge meeting the trade
          panel so chart (left) + panel (right) stay visible to compare. */}
      <div
        role="dialog"
        aria-label="Trade types"
        className="fixed inset-x-0 bottom-14 top-14 z-40 flex w-full border-l border-white/10 bg-[#0b0d12] shadow-2xl xl:absolute xl:inset-x-auto xl:inset-y-0 xl:bottom-auto xl:right-[340px] xl:top-auto xl:w-[470px]"
      >
      {/* Left rail — categories */}
      <div className="w-[106px] shrink-0 border-r border-white/[0.07] py-2 sm:w-[150px] sm:py-3">
        <p className="px-2 pb-2 text-[11px] font-black text-white sm:px-4 sm:text-[13px]">Trade types</p>
        {visibleCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`flex w-full items-center gap-1.5 px-2 py-2 text-left text-[10px] font-bold transition sm:gap-2.5 sm:px-4 sm:py-2.5 sm:text-[12px] ${
              cat === c.id
                ? "border-l-2 border-red-500 bg-white/[0.04] text-white"
                : "border-l-2 border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Icon name={c.icon} className="shrink-0 text-[14px] sm:text-[16px]" />
            <span className="min-w-0 truncate">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Right — search + grouped list */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-2 py-2 sm:px-3 sm:py-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-white/[0.05] px-3 ring-1 ring-white/[0.07] focus-within:ring-sky-500/50">
            <Icon name="search" className="text-[16px] text-slate-500" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="h-8 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600 sm:h-9 sm:text-sm"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.05] text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="text-[13px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:thin] sm:px-3 sm:py-3">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-600">No trade types match “{q}”.</p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} className="mb-4">
                <p className="mb-1.5 text-[12px] font-black text-white sm:text-[13px]">{group}</p>
                <div className="space-y-1">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { onSelect(t.id); onClose(); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition sm:gap-3 sm:px-3 sm:py-2.5 ${
                        t.id === value ? "bg-white/[0.07] ring-1 ring-inset ring-sky-500/40" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="flex items-center gap-0.5">
                        <Icon name={t.upIcon} className="text-[16px] text-emerald-400" />
                        <Icon name={t.downIcon} className="text-[16px] text-red-400" />
                      </span>
                      <span className="min-w-0 truncate text-[12px] font-bold text-white sm:text-[13px]">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </>
  );
}
