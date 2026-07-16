// ─── P2P fiat currencies ──────────────────────────────────────────────────────
// Single source of truth for every fiat the P2P market supports. Built from the
// world-country catalogue so ad/browse pickers can offer every country, while
// curated entries keep preferred symbols / locales for major markets.

import { WORLD_COUNTRIES } from "@/lib/payments/world-countries";

export interface FiatCurrency {
  code: string;   // ISO 4217, e.g. "KES" — also what we store on P2PAd.fiat
  symbol: string; // display symbol, e.g. "KSh"
  name: string;   // human name
  locale: string; // BCP-47 locale for number grouping
  flag?: string;  // (optional) emoji — UI renders real flag images by code instead
}

/** Preferred symbol/locale for well-known currencies (overrides world defaults). */
const CURATED: FiatCurrency[] = [
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling",      locale: "en-KE" },
  { code: "NGN", symbol: "₦",   name: "Nigerian Naira",       locale: "en-NG" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi",        locale: "en-GH" },
  { code: "ZAR", symbol: "R",   name: "South African Rand",   locale: "en-ZA" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling",   locale: "en-TZ" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling",     locale: "en-UG" },
  { code: "RWF", symbol: "FRw", name: "Rwandan Franc",        locale: "en-RW" },
  { code: "ETB", symbol: "Br",  name: "Ethiopian Birr",       locale: "en-ET" },
  { code: "XOF", symbol: "CFA", name: "West African CFA Franc", locale: "fr-SN" },
  { code: "XAF", symbol: "FCFA",name: "Central African CFA Franc", locale: "fr-CM" },
  { code: "USD", symbol: "$",   name: "US Dollar",            locale: "en-US" },
  { code: "EUR", symbol: "€",   name: "Euro",                 locale: "en-IE" },
  { code: "GBP", symbol: "£",   name: "British Pound",        locale: "en-GB" },
  { code: "INR", symbol: "₹",   name: "Indian Rupee",         locale: "en-IN" },
  { code: "JPY", symbol: "¥",   name: "Japanese Yen",         locale: "ja-JP" },
  { code: "CNY", symbol: "¥",   name: "Chinese Yuan",         locale: "zh-CN" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham",           locale: "en-AE" },
  { code: "SAR", symbol: "﷼",   name: "Saudi Riyal",          locale: "en-SA" },
  { code: "EGP", symbol: "E£",  name: "Egyptian Pound",       locale: "en-EG" },
  { code: "MAD", symbol: "DH",  name: "Moroccan Dirham",      locale: "fr-MA" },
  { code: "AUD", symbol: "A$",  name: "Australian Dollar",    locale: "en-AU" },
  { code: "CAD", symbol: "C$",  name: "Canadian Dollar",      locale: "en-CA" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc",          locale: "de-CH" },
  { code: "BRL", symbol: "R$",  name: "Brazilian Real",       locale: "pt-BR" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso",         locale: "es-MX" },
  { code: "RUB", symbol: "₽",   name: "Russian Ruble",        locale: "ru-RU" },
  { code: "TRY", symbol: "₺",   name: "Turkish Lira",         locale: "tr-TR" },
  { code: "SGD", symbol: "S$",  name: "Singapore Dollar",     locale: "en-SG" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar",     locale: "en-HK" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar",   locale: "en-NZ" },
  { code: "SEK", symbol: "kr",  name: "Swedish Krona",        locale: "sv-SE" },
  { code: "NOK", symbol: "kr",  name: "Norwegian Krone",      locale: "nb-NO" },
  { code: "DKK", symbol: "kr",  name: "Danish Krone",         locale: "da-DK" },
  { code: "PLN", symbol: "zł",  name: "Polish Zloty",         locale: "pl-PL" },
  { code: "THB", symbol: "฿",   name: "Thai Baht",            locale: "th-TH" },
  { code: "IDR", symbol: "Rp",  name: "Indonesian Rupiah",    locale: "id-ID" },
  { code: "MYR", symbol: "RM",  name: "Malaysian Ringgit",    locale: "ms-MY" },
  { code: "PHP", symbol: "₱",   name: "Philippine Peso",      locale: "en-PH" },
  { code: "VND", symbol: "₫",   name: "Vietnamese Dong",      locale: "vi-VN" },
  { code: "KRW", symbol: "₩",   name: "South Korean Won",     locale: "ko-KR" },
  { code: "PKR", symbol: "Rs",  name: "Pakistani Rupee",      locale: "en-PK" },
  { code: "BDT", symbol: "৳",   name: "Bangladeshi Taka",     locale: "bn-BD" },
  { code: "ARS", symbol: "AR$", name: "Argentine Peso",       locale: "es-AR" },
  { code: "COP", symbol: "COL$",name: "Colombian Peso",       locale: "es-CO" },
];

function buildFiatCurrencies(): FiatCurrency[] {
  const byCode = new Map<string, FiatCurrency>();
  for (const c of CURATED) byCode.set(c.code, c);
  for (const w of WORLD_COUNTRIES) {
    if (byCode.has(w.currency)) continue;
    byCode.set(w.currency, {
      code: w.currency,
      symbol: w.currency,
      name: w.currencyName,
      locale: "en-US",
    });
  }
  // Curated first (Africa + majors), then the rest A–Z by code.
  const curatedCodes = new Set(CURATED.map((c) => c.code));
  const rest = [...byCode.values()]
    .filter((c) => !curatedCodes.has(c.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return [...CURATED, ...rest];
}

export const FIAT_CURRENCIES: FiatCurrency[] = buildFiatCurrencies();

export const DEFAULT_FIAT = "KES";

const BY_CODE = new Map(FIAT_CURRENCIES.map((c) => [c.code, c]));

export function getFiat(code: string | null | undefined): FiatCurrency {
  return (code && BY_CODE.get(code)) || BY_CODE.get(DEFAULT_FIAT)!;
}

/** True only for a fiat we actually support (used to validate user/cookie input). */
export function isSupportedFiat(code: string | null | undefined): boolean {
  return !!code && (code === "__ALL__" || BY_CODE.has(code));
}

// ─── Geo detection ────────────────────────────────────────────────────────────
// ISO 3166-1 alpha-2 country code → supported fiat. Only countries whose
// currency we support are listed; anything else falls back to DEFAULT_FIAT.
const COUNTRY_TO_FIAT: Record<string, string> = {
  KE: "KES", NG: "NGN", GH: "GHS", ZA: "ZAR", TZ: "TZS", UG: "UGX",
  RW: "RWF", ET: "ETB",
  US: "USD", GB: "GBP", IN: "INR",
  // Eurozone → EUR
  AT: "EUR", BE: "EUR", HR: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR",
  MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR",
};

/**
 * Detect the visitor's fiat from request headers, with a layered fallback:
 *   1. Edge geo headers (x-vercel-ip-country on Vercel, cf-ipcountry on Cloudflare)
 *   2. accept-language region tag (e.g. "en-KE" → KE)
 *   3. DEFAULT_FIAT
 * Pure function — pass a getHeader accessor so it stays framework-agnostic.
 */
export function detectFiatFromHeaders(getHeader: (name: string) => string | null | undefined): string {
  const geoHeaders = ["x-vercel-ip-country", "cf-ipcountry", "x-country", "x-geo-country", "x-country-code"];
  for (const h of geoHeaders) {
    const country = (getHeader(h) ?? "").trim().toUpperCase();
    const mapped = COUNTRY_TO_FIAT[country];
    if (mapped) return mapped;
    // Any world country whose currency we support
    const fromWorld = WORLD_COUNTRIES.find((c) => c.code === country);
    if (fromWorld && BY_CODE.has(fromWorld.currency)) return fromWorld.currency;
  }
  const lang = getHeader("accept-language") ?? "";
  const m = /-([A-Za-z]{2})\b/.exec(lang);
  if (m) {
    const country = m[1].toUpperCase();
    const mapped = COUNTRY_TO_FIAT[country];
    if (mapped) return mapped;
    const fromWorld = WORLD_COUNTRIES.find((c) => c.code === country);
    if (fromWorld && BY_CODE.has(fromWorld.currency)) return fromWorld.currency;
  }
  return DEFAULT_FIAT;
}

export function fiatSymbol(code: string | null | undefined): string {
  return getFiat(code).symbol;
}

/**
 * Format a fiat amount for the given currency code.
 * - Uses the currency's own locale for digit grouping.
 * - Prefixes the currency symbol (e.g. "KSh 12,500", "₦ 18,000.50").
 *
 * @param opts.symbol   include the symbol prefix (default true)
 * @param opts.decimals fixed fraction digits (default: up to 2, no trailing zeros)
 */
export function formatFiat(
  amount: number,
  code: string | null | undefined,
  opts: { symbol?: boolean; decimals?: number } = {},
): string {
  const fiat = getFiat(code);
  const { symbol = true, decimals } = opts;
  const num = Number.isFinite(amount) ? amount : 0;
  const formatted = num.toLocaleString(fiat.locale, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 2,
  });
  return symbol ? `${fiat.symbol} ${formatted}` : formatted;
}
