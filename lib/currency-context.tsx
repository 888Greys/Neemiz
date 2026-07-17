"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CURRENCY_BY_CODE,
  DEFAULT_CURRENCY,
  convertFromKes,
  convertToKes,
  formatInCurrency,
  isSupportedCurrency,
  type DisplayCurrency,
} from "@/lib/currency-config";
import { usdToKesWithRates } from "@/lib/play-usd";

export const CURRENCY_COOKIE = "display_currency";

interface CurrencyContextValue {
  /** Active display currency code (KES, USD, USDT, …). */
  code: string;
  currency: DisplayCurrency;
  /** KES value of 1 unit of each currency code (live FX, from the server). */
  toKES: Record<string, number>;
  /** Change the display currency (persists to a 1-year cookie). */
  setCurrency: (code: string) => void;
  /** Convert a canonical KES amount into the active display currency (number). */
  convert: (amountKes: number) => number;
  /** Inverse of `convert`: turn a display-currency amount the user entered back
   *  into canonical KES, for posting to the (KES-only) server. */
  toKes: (displayAmount: number) => number;
  /** Convert + format a KES amount, e.g. "$ 12.34" / "KSh 1,590.00". */
  format: (amountKes: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  initialCode,
  toKES,
  children,
}: {
  initialCode: string;
  toKES: Record<string, number>;
  children: ReactNode;
}) {
  const [code, setCode] = useState(isSupportedCurrency(initialCode) ? initialCode : DEFAULT_CURRENCY);

  function writeCookie(next: string) {
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }

  const setCurrency = useCallback((next: string) => {
    if (!isSupportedCurrency(next)) return;
    setCode(next);
    writeCookie(next);
    // Persist to the user's account (Binance-style) so the choice follows them
    // across devices. No-op / 401 when signed out — ignored.
    fetch("/api/account/currency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: next }),
    }).catch(() => {});
  }, []);

  // On mount, if the signed-in user has a saved account currency that differs
  // from what the server rendered (e.g. fresh device with no cookie yet), adopt
  // it and sync the cookie. The account preference is the source of truth.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/currency")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { code?: string | null } | null) => {
        const saved = data?.code;
        if (!cancelled && isSupportedCurrency(saved) && saved !== code) {
          setCode(saved!);
          writeCookie(saved!);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const currency = CURRENCY_BY_CODE[code] ?? CURRENCY_BY_CODE[DEFAULT_CURRENCY];
    return {
      code,
      currency,
      toKES,
      setCurrency,
      convert: (amountKes: number) => convertFromKes(amountKes, code, toKES),
      toKes: (displayAmount: number) => convertToKes(displayAmount, code, toKES),
      format: (amountKes: number) => formatInCurrency(convertFromKes(amountKes, code, toKES), code),
    };
  }, [code, toKES, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/** Full currency context. Throws if used outside the provider. */
export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within <CurrencyProvider>");
  return ctx;
}

/**
 * Convenience hook for formatting money. Returns a `format(kes)` function plus
 * the active currency. Falls back to a KES formatter if used outside the
 * provider (defensive — never throws in a money display).
 */
export function useMoney(): { format: (amountKes: number) => string; code: string } {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return { format: (a: number) => formatInCurrency(a, DEFAULT_CURRENCY), code: DEFAULT_CURRENCY };
  }
  return { format: ctx.format, code: ctx.code };
}

/**
 * Lock display/input to USD for Binary & Forex without changing the user's
 * global currency preference (cookie / account). Ledger amounts stay KES;
 * convert uses the parent FX map; toKes matches server play mins (ceil).
 */
export function PlayUsdProvider({ children }: { children: ReactNode }) {
  const parent = useCurrency();
  const value = useMemo<CurrencyContextValue>(() => {
    const currency = CURRENCY_BY_CODE.USD;
    const toKES = parent.toKES;
    return {
      code: "USD",
      currency,
      toKES,
      setCurrency: () => {
        /* locked while on Binary / Forex */
      },
      convert: (amountKes: number) => convertFromKes(amountKes, "USD", toKES),
      // Same ceil as lib/play-usd.minPlayStakeKes — Math.round alone can land
      // 1 KSh under the API floor and reject a true $1 stake.
      toKes: (displayAmount: number) => usdToKesWithRates(displayAmount, toKES),
      format: (amountKes: number) =>
        formatInCurrency(convertFromKes(amountKes, "USD", toKES), "USD"),
    };
  }, [parent.toKES]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
