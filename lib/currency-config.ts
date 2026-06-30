// Multi-currency DISPLAY registry + pure conversion helpers (no React, no I/O —
// safe to import from both server and client).
//
// The platform ledger stays in KES (the canonical value). This module only
// governs how a KES amount is *shown* to a user who has picked, or been
// geo-matched to, another display currency. Conversion uses live FX rates
// (KES per 1 unit of each currency) supplied by lib/p2p/fx.getFxRatesToKES().

export type CurrencyKind = "fiat" | "crypto";

export interface DisplayCurrency {
  code: string;     // ISO-4217 for fiat, "USDT" for the stablecoin
  symbol: string;   // display symbol/prefix
  locale: string;   // Intl locale for grouping
  name: string;     // human label
  flag: string;     // emoji flag / icon
  kind: CurrencyKind;
  decimals: number; // typical display precision
}

// Ordered for the picker. KES first (home), USDT highlighted as the borderless
// option, then the fiats we have FX coverage for (see lib/p2p/fx).
export const CURRENCIES: DisplayCurrency[] = [
  { code: "KES",  symbol: "KSh",  locale: "en-KE", name: "Kenyan Shilling",   flag: "🇰🇪", kind: "fiat",   decimals: 2 },
  { code: "USDT", symbol: "USDT", locale: "en-US", name: "Tether (USDT)",     flag: "🪙", kind: "crypto", decimals: 2 },
  { code: "USD",  symbol: "$",    locale: "en-US", name: "US Dollar",         flag: "🇺🇸", kind: "fiat",   decimals: 2 },
  { code: "NGN",  symbol: "₦",    locale: "en-NG", name: "Nigerian Naira",    flag: "🇳🇬", kind: "fiat",   decimals: 2 },
  { code: "GHS",  symbol: "GH₵",  locale: "en-GH", name: "Ghanaian Cedi",     flag: "🇬🇭", kind: "fiat",   decimals: 2 },
  { code: "ZAR",  symbol: "R",    locale: "en-ZA", name: "South African Rand",flag: "🇿🇦", kind: "fiat",   decimals: 2 },
  { code: "TZS",  symbol: "TSh",  locale: "en-TZ", name: "Tanzanian Shilling",flag: "🇹🇿", kind: "fiat",   decimals: 2 },
  { code: "UGX",  symbol: "USh",  locale: "en-UG", name: "Ugandan Shilling",  flag: "🇺🇬", kind: "fiat",   decimals: 0 },
  { code: "EUR",  symbol: "€",    locale: "en-IE", name: "Euro",              flag: "🇪🇺", kind: "fiat",   decimals: 2 },
  { code: "GBP",  symbol: "£",    locale: "en-GB", name: "British Pound",     flag: "🇬🇧", kind: "fiat",   decimals: 2 },
];

export const CURRENCY_BY_CODE: Record<string, DisplayCurrency> =
  Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export const DEFAULT_CURRENCY = "KES";

// Cloudflare CF-IPCountry (ISO-3166 alpha-2) → display currency. Anything not
// mapped falls back to USD (sensible international default).
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  KE: "KES", NG: "NGN", GH: "GHS", ZA: "ZAR", TZ: "TZS", UG: "UGX",
  US: "USD", GB: "GBP",
  DE: "EUR", FR: "EUR", IE: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", PT: "EUR",
};

export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return DEFAULT_CURRENCY;
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? "USD";
}

export function isSupportedCurrency(code: string | null | undefined): boolean {
  return !!code && code in CURRENCY_BY_CODE;
}

/**
 * Convert a canonical KES amount into `code` using a toKES rate map
 * (KES value of 1 unit of each code, as produced by getFxRatesToKES). USDT
 * tracks USD. Returns the KES amount unchanged if we lack a rate.
 */
export function convertFromKes(amountKes: number, code: string, toKES: Record<string, number>): number {
  const n = Number.isFinite(amountKes) ? amountKes : 0;
  if (code === "KES") return n;
  const rateCode = code === "USDT" ? "USD" : code;
  const kesPerUnit = toKES[rateCode];
  if (!kesPerUnit || kesPerUnit <= 0) return n; // no rate → show KES value
  return n / kesPerUnit;
}

/** Format an already-converted amount with the currency's symbol + locale. */
export function formatInCurrency(amount: number, code: string): string {
  const c = CURRENCY_BY_CODE[code] ?? CURRENCY_BY_CODE[DEFAULT_CURRENCY];
  const n = Number.isFinite(amount) ? amount : 0;
  const num = n.toLocaleString(c.locale, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  return `${c.symbol} ${num}`;
}

/** Convert KES → code and format in one step. */
export function formatKesAs(amountKes: number, code: string, toKES: Record<string, number>): string {
  return formatInCurrency(convertFromKes(amountKes, code, toKES), code);
}
