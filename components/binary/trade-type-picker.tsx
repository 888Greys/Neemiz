"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) inputRef.current?.focus();
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      onClose();
      closeTimer.current = null;
    }, 220);
  }, [closing, onClose]);

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
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end xl:absolute xl:inset-y-0 xl:left-0 xl:right-[340px] xl:z-40 xl:justify-start xl:pt-0"
      role="dialog"
      aria-modal="true"
      aria-label="Trade types"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/55 xl:bg-black/40 ${
          closing ? "animate-sheet-backdrop-out" : "animate-sheet-backdrop-in"
        }`}
      />

      <div
        className={`relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#0b0d12] shadow-2xl ring-1 ring-white/[0.08] xl:max-h-none xl:h-full xl:rounded-none xl:ring-0 xl:border-l xl:border-white/10 ${
          closing
            ? "animate-sheet-out xl:animate-trade-picker-out"
            : "animate-sheet-in xl:animate-trade-picker-in"
        }`}
      >
        {/* Mobile grab + title row — close sits in a calm header, not jammed beside search */}
        <div className="shrink-0 border-b border-white/[0.07]">
          <button
            type="button"
            onClick={requestClose}
            className="flex w-full justify-center pt-2.5 pb-1 xl:hidden"
            aria-label="Close sheet"
          >
            <span className="h-1 w-10 rounded-full bg-white/20" />
          </button>

          <div className="flex items-center gap-3 px-4 pb-3 pt-1 xl:px-4 xl:py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-black tracking-tight text-white">Trade types</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 xl:hidden">
                Pick how you want to trade
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-slate-300 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] hover:text-white active:scale-[0.96]"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 ring-1 ring-white/[0.07] focus-within:ring-sky-500/40">
              <Icon name="search" className="text-[16px] text-slate-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search trade types"
                className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="grid h-6 w-6 place-items-center rounded-full text-slate-500 hover:text-white"
                >
                  <Icon name="close" className="text-[14px]" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left rail — categories */}
          <div className="w-[100px] shrink-0 overflow-y-auto border-r border-white/[0.07] py-2 sm:w-[132px]">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`flex w-full items-center gap-1.5 px-2.5 py-2.5 text-left text-[11px] font-bold transition sm:gap-2 sm:px-3 sm:text-[12px] ${
                  cat === c.id
                    ? "border-l-2 border-emerald-400 bg-emerald-500/10 text-emerald-100"
                    : "border-l-2 border-transparent text-slate-500 hover:text-white"
                }`}
              >
                <Icon name={c.icon} className="shrink-0 text-[15px] sm:text-[16px]" />
                <span className="min-w-0 truncate">{c.label}</span>
              </button>
            ))}
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] [scrollbar-width:thin]">
            {groups.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-slate-600">No trade types match “{q}”.</p>
            ) : (
              groups.map(({ group, items }, gi) => (
                <div
                  key={group}
                  className="mb-4 animate-fav-row"
                  style={{ animationDelay: `${gi * 35}ms` }}
                >
                  <p className="mb-1.5 px-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onSelect(t.id);
                          requestClose();
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition active:scale-[0.99] sm:gap-3 sm:px-3 ${
                          t.id === value
                            ? "bg-sky-500/10 ring-1 ring-inset ring-sky-400/45"
                            : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center gap-0.5 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                          <Icon name={t.upIcon} className="text-[15px] text-emerald-400" />
                          <Icon name={t.downIcon} className="text-[15px] text-red-400" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-white">{t.label}</span>
                          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500 line-clamp-2">
                            {t.howItPays}
                          </span>
                        </span>
                        {t.id === value && (
                          <Icon name="check" className="shrink-0 text-[16px] text-sky-300" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
