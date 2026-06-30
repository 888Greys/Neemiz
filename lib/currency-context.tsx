"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  CURRENCY_BY_CODE,
  DEFAULT_CURRENCY,
  convertFromKes,
  formatInCurrency,
  isSupportedCurrency,
  type DisplayCurrency,
} from "@/lib/currency-config";

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
  children: React.ReactNode;
}) {
  const [code, setCode] = useState(isSupportedCurrency(initialCode) ? initialCode : DEFAULT_CURRENCY);

  const setCurrency = useCallback((next: string) => {
    if (!isSupportedCurrency(next)) return;
    setCode(next);
    // 1-year cookie; SameSite=Lax is fine (no cross-site need).
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const currency = CURRENCY_BY_CODE[code] ?? CURRENCY_BY_CODE[DEFAULT_CURRENCY];
    return {
      code,
      currency,
      toKES,
      setCurrency,
      convert: (amountKes: number) => convertFromKes(amountKes, code, toKES),
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
