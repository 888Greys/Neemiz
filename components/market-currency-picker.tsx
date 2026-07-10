"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { MARKETS, type Market } from "@/lib/payments/country-methods";

/** ISO 4217 → flagcdn country/region code (best-effort). */
const CURRENCY_FLAG: Record<string, string> = {
  USD: "us", EUR: "eu", GBP: "gb", CHF: "ch", SEK: "se", NOK: "no", DKK: "dk", PLN: "pl",
  KES: "ke", NGN: "ng", GHS: "gh", ZAR: "za", TZS: "tz", UGX: "ug", RWF: "rw", ETB: "et",
  EGP: "eg", XOF: "sn", XAF: "cm", BWP: "bw", MWK: "mw", MZN: "mz", ZMW: "zm", CDF: "cd",
  BRL: "br", MXN: "mx", ARS: "ar", COP: "co",
  INR: "in", BDT: "bd", PKR: "pk", PHP: "ph", IDR: "id", MYR: "my", THB: "th", VND: "vn",
  CNY: "cn", JPY: "jp", KRW: "kr", AUD: "au", CAD: "ca",
  AED: "ae", SAR: "sa", TRY: "tr", KZT: "kz", BHD: "bh", KWD: "kw", JOD: "jo", ILS: "il",
  MAD: "ma", RUB: "ru", SGD: "sg", HKD: "hk", NZD: "nz",
};

export function currencyFlagUrl(code: string): string {
  const cc = CURRENCY_FLAG[code] ?? code.slice(0, 2).toLowerCase();
  return `https://flagcdn.com/w80/${cc}.png`;
}

type Props = {
  value: string;
  onChange: (currency: string) => void;
  /** When true, show the full-page list. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  markets?: Market[];
};

/**
 * Full-page market/currency picker that collapses to a compact trigger after pick.
 */
export function MarketCurrencyPicker({
  value,
  onChange,
  open,
  onOpenChange,
  title = "Choose market",
  markets = MARKETS,
}: Props) {
  const [query, setQuery] = useState("");
  const selected = markets.find((m) => m.currency === value) ?? markets[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(
      (m) =>
        m.currency.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.region.toLowerCase().includes(q),
    );
  }, [markets, query]);

  if (open) {
    return (
      <div className="flex min-h-[min(70dvh,560px)] flex-col">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
            aria-label="Close"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
          <h2 className="text-[15px] font-black tracking-tight text-white">{title}</h2>
        </div>
        <div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 focus-within:border-[#087cff]/50">
          <Icon name="search" className="text-[18px] text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country or currency"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-slate-600"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-slate-500 hover:text-white">
              <Icon name="cancel" className="text-[18px]" />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {filtered.length === 0 && (
            <p className="py-12 text-center text-[13px] font-semibold text-slate-500">No markets found</p>
          )}
          <ul className="divide-y divide-white/[0.05]">
            {filtered.map((m) => {
              const active = m.currency === value;
              return (
                <li key={m.currency}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(m.currency);
                      setQuery("");
                      onOpenChange(false);
                    }}
                    className={`flex w-full items-center gap-3 px-1 py-3.5 text-left transition active:scale-[0.99] ${
                      active ? "bg-[#087cff]/[0.08]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currencyFlagUrl(m.currency)}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-white">{m.region}</span>
                      <span className="block text-[12px] font-medium text-slate-500">
                        {m.currency} · {m.label}
                      </span>
                    </span>
                    {active && <Icon name="check_circle" className="shrink-0 text-[20px] text-[#087cff]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.05] active:scale-[0.99]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currencyFlagUrl(selected.currency)}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Market</span>
        <span className="block text-[15px] font-black text-white">
          {selected.region}
          <span className="ml-1.5 font-bold text-slate-400">{selected.currency}</span>
        </span>
      </span>
      <Icon name="expand_more" className="shrink-0 text-[22px] text-slate-500" />
    </button>
  );
}
