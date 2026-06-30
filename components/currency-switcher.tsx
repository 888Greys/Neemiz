"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCIES } from "@/lib/currency-config";
import { CurrencyFlag } from "@/components/currency-flag";

/**
 * Compact display-currency picker. Changing it updates the in-page context
 * immediately (client-converted amounts re-render) and refreshes server
 * components so server-rendered money re-resolves on the new currency.
 */
export function CurrencySwitcher({ className = "" }: { className?: string }) {
  const { code, currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? CURRENCIES.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    : CURRENCIES;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(next: string) {
    setCurrency(next);
    setOpen(false);
    router.refresh(); // re-resolve server-rendered amounts on the new currency
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-on-surface-variant ring-1 ring-white/10 transition hover:ring-white/20"
        aria-label="Change display currency"
      >
        <CurrencyFlag currency={currency} size={14} />
        <span>{code}</span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 flex max-h-80 w-60 flex-col rounded-xl border border-white/10 bg-[#121419] shadow-2xl">
          <div className="sticky top-0 border-b border-white/[0.06] bg-[#121419] p-2">
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
                onClick={() => choose(c.code)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition hover:bg-white/[0.06] ${
                  c.code === code ? "bg-white/[0.05] text-white" : "text-slate-300"
                }`}
              >
                <CurrencyFlag currency={c} size={16} />
                <span className="font-bold">{c.code}</span>
                <span className="ml-auto truncate text-[11px] text-slate-500">{c.name}</span>
                {c.kind === "crypto" && (
                  <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-black text-emerald-400">CRYPTO</span>
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
