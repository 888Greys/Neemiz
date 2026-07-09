"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCIES, PINNED_CURRENCY_CODES, type DisplayCurrency } from "@/lib/currency-config";
import { CurrencyFlag } from "@/components/currency-flag";
import { Icon } from "@/components/icon";

type Variant = "compact" | "inline" | "sheet";

/**
 * Display-currency picker. Changing it updates the in-page context immediately
 * and refreshes server components so server-rendered money re-resolves.
 *
 * - compact: header chip + dropdown
 * - inline: full-width trigger + dropdown
 * - sheet: full searchable list for Profile / Wallet
 */
export function CurrencySwitcher({
  className = "",
  inline = false,
  variant,
  onPicked,
}: {
  className?: string;
  /** Legacy: same as variant="inline" */
  inline?: boolean;
  variant?: Variant;
  onPicked?: () => void;
}) {
  const mode: Variant = variant ?? (inline ? "inline" : "compact");
  const { code, currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [q]);

  const pinnedSet = useMemo(() => new Set<string>(PINNED_CURRENCY_CODES), []);
  const pinned = useMemo(
    () => (q ? [] : filtered.filter((c) => pinnedSet.has(c.code))),
    [filtered, pinnedSet, q],
  );
  const rest = useMemo(
    () => (q ? filtered : filtered.filter((c) => !pinnedSet.has(c.code))),
    [filtered, pinnedSet, q],
  );

  useEffect(() => {
    if (mode === "sheet") return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mode]);

  function choose(next: string) {
    setCurrency(next);
    setOpen(false);
    setQuery("");
    router.refresh();
    onPicked?.();
  }

  if (mode === "sheet") {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#111316] px-4 pb-3 pt-1">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/[0.06] focus-within:ring-[#087cff]/45">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search currency…"
              className="h-11 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-slate-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[11px] font-bold text-slate-500 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
            Display only. Balances are held in KES; FX is indicative.
          </p>
        </div>

        <div className="no-scrollbar max-h-[min(60dvh,420px)] overflow-y-auto px-2 py-2">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-slate-500">No match</p>
          )}

          {pinned.length > 0 && (
            <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              Popular
            </p>
          )}
          {pinned.map((c) => (
            <CurrencyRow key={c.code} c={c} active={c.code === code} onChoose={choose} />
          ))}

          {rest.length > 0 && (
            <p className="px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
              {q ? "Results" : "All currencies"}
            </p>
          )}
          {rest.map((c) => (
            <CurrencyRow key={c.code} c={c} active={c.code === code} onChoose={choose} />
          ))}
        </div>
      </div>
    );
  }

  const isInline = mode === "inline";

  return (
    <div ref={ref} className={`relative ${isInline ? "w-full" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-on-surface-variant ring-1 ring-white/10 transition hover:ring-white/20 ${isInline ? "w-full justify-between" : ""}`}
        aria-label="Change display currency"
      >
        <CurrencyFlag currency={currency} size={14} />
        <span className={isInline ? "mr-auto ml-1.5" : ""}>{code}</span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open && (
        <div
          className={`${
            isInline
              ? "relative mt-1.5 flex max-h-64 w-full flex-col"
              : "absolute right-0 z-50 mt-1 flex max-h-80 w-60 flex-col"
          } rounded-xl border border-white/10 bg-[#18191f] shadow-2xl`}
        >
          <div className="sticky top-0 border-b border-white/[0.06] bg-[#18191f] p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search currency…"
              className="w-full rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[12px] text-white outline-none ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-white/25"
            />
          </div>
          <div className="overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-center text-[11px] text-slate-500">No match</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => choose(c.code)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition hover:bg-white/[0.06] ${
                  c.code === code ? "bg-white/[0.05] text-white" : "text-slate-300"
                }`}
              >
                <CurrencyFlag currency={c} size={16} />
                <span className="font-bold">{c.code}</span>
                <span className="ml-auto truncate text-[11px] text-slate-500">{c.name}</span>
                {c.kind === "crypto" && (
                  <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-black text-emerald-400">
                    CRYPTO
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="border-t border-white/[0.06] px-2.5 py-1.5 text-[9px] leading-tight text-slate-600">
            Display only. Balances are held in KES; FX is indicative.
          </p>
        </div>
      )}
    </div>
  );
}

function CurrencyRow({
  c,
  active,
  onChoose,
}: {
  c: DisplayCurrency;
  active: boolean;
  onChoose: (code: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChoose(c.code)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active ? "bg-[#087cff]/10" : "hover:bg-white/[0.04]"
      }`}
    >
      <CurrencyFlag currency={c} size={18} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-black ${active ? "text-white" : "text-slate-200"}`}>
          {c.code}
        </span>
        <span className="block truncate text-[11px] text-slate-500">{c.name}</span>
      </span>
      {c.kind === "crypto" && (
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-black text-emerald-400">
          CRYPTO
        </span>
      )}
      {active && <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />}
    </button>
  );
}
