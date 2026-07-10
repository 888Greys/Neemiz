"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import {
  WORLD_COUNTRIES,
  WORLD_BY_CODE,
  countryFlagUrl,
  findCountryByCurrency,
  type WorldCountry,
} from "@/lib/payments/world-countries";

/** @deprecated Prefer countryFlagUrl — kept for fiat codes that map via currency. */
export function currencyFlagUrl(code: string): string {
  const c = findCountryByCurrency(code);
  if (c) return countryFlagUrl(c.code);
  const map: Record<string, string> = {
    USD: "us", EUR: "eu", GBP: "gb", XOF: "sn", XAF: "cm", XCD: "ag",
  };
  return `https://flagcdn.com/w40/${(map[code] ?? code.slice(0, 2)).toLowerCase()}.png`;
}

type Props = {
  countryCode: string;
  onChange: (next: { countryCode: string; currency: string }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
};

/**
 * Country picker as a bottom sheet (Payment Methods chrome) — does not cover the full top.
 * Collapses to a small chip after pick.
 */
export function MarketCurrencyPicker({
  countryCode,
  onChange,
  open,
  onOpenChange,
  title = "Choose country",
}: Props) {
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const selected: WorldCountry =
    WORLD_BY_CODE[countryCode] ?? findCountryByCurrency("USD") ?? WORLD_COUNTRIES[0];

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WORLD_COUNTRIES;
    return WORLD_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.currencyName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  const collapsed = (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/15 active:scale-[0.99]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={countryFlagUrl(selected.code)}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">Country</span>
        <span className="block truncate text-[13px] font-bold text-white">
          {selected.name}
          <span className="ml-1 font-semibold text-slate-400">{selected.currency}</span>
        </span>
      </span>
      <Icon name="expand_more" className="shrink-0 text-[18px] text-slate-500" />
    </button>
  );

  if (!open) return collapsed;
  if (!mounted) return null;

  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-[#1c1c1e] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 className="text-[17px] font-bold text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500">{filtered.length}</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"
              aria-label="Close"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-3">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or currency"
              className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-slate-500 hover:text-white">
                <Icon name="cancel" className="text-[16px]" />
              </button>
            )}
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          style={{ touchAction: "pan-y" }}
        >
          {filtered.length === 0 && (
            <p className="py-10 text-center text-[13px] font-semibold text-slate-500">No countries found</p>
          )}
          <ul>
            {filtered.map((c) => {
              const active = c.code === selected.code;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ countryCode: c.code, currency: c.currency });
                      setQuery("");
                      onOpenChange(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] ${
                      active ? "bg-white/[0.08]" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={countryFlagUrl(c.code)}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                      loading="lazy"
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-[12px] font-bold text-slate-500">{c.currency}</span>
                    {active && <Icon name="check" className="shrink-0 text-[18px] text-white" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
