"use client";

import { useEffect, useMemo, useState } from "react";
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
}: {
  value: TradeTypeId;
  onSelect: (id: TradeTypeId) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<TradeCategory>("all");
  const [q, setQ] = useState("");
  // Slide-in: mount off-screen, then animate to 0 on the next frame.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      TRADE_TYPES.filter(
        (t) =>
          t.categories.includes(cat) &&
          (term === "" || t.label.toLowerCase().includes(term)),
      ),
    [cat, term],
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
      <div className="absolute inset-0 z-30 bg-black/40 xl:right-[340px]" onClick={onClose} />

      {/* Drawer — slides in from the right, its right edge meeting the trade
          panel so chart (left) + panel (right) stay visible to compare. */}
      <div
        role="dialog"
        aria-label="Trade types"
        className={`absolute inset-y-0 right-0 z-40 flex w-full transform border-l border-white/10 bg-[#0b0d12] shadow-2xl transition-transform duration-300 ease-out xl:right-[340px] xl:w-[470px] ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
      {/* Left rail — categories */}
      <div className="w-[150px] shrink-0 border-r border-white/[0.07] py-3">
        <p className="px-4 pb-2 text-[13px] font-black text-white">Trade types</p>
        {TRADE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] font-bold transition ${
              cat === c.id
                ? "border-l-2 border-red-500 bg-white/[0.04] text-white"
                : "border-l-2 border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Icon name={c.icon} className="text-[16px]" />
            {c.label}
          </button>
        ))}
      </div>

      {/* Right — search + grouped list */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-white/[0.05] px-3 ring-1 ring-white/[0.07] focus-within:ring-sky-500/50">
            <Icon name="search" className="text-[16px] text-slate-500" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="h-9 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-600">No trade types match “{q}”.</p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group} className="mb-4">
                <p className="mb-1.5 text-[13px] font-black text-white">{group}</p>
                <div className="space-y-1">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { onSelect(t.id); onClose(); }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        t.id === value ? "bg-white/[0.07] ring-1 ring-inset ring-sky-500/40" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="flex items-center gap-0.5">
                        <Icon name={t.upIcon} className="text-[16px] text-emerald-400" />
                        <Icon name={t.downIcon} className="text-[16px] text-red-400" />
                      </span>
                      <span className="text-[13px] font-bold text-white">{t.label}</span>
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
