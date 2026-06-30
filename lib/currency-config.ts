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
  cc: string;       // ISO-3166 alpha-2 for the flag image ("" for crypto)
  kind: CurrencyKind;
  decimals: number; // typical display precision
}

// Ordered for the picker: KES (home) + USDT (borderless) first, then a broad
// world list. FX for every code comes live from getFxRatesToKES (passes through
// ~160 provider currencies); anything without a rate gracefully shows the KES
// value. `decimals: 0` marks ISO-4217 zero-minor-unit currencies.
export const CURRENCIES: DisplayCurrency[] = [
  { code: "KES",  symbol: "KSh",  locale: "en-KE", name: "Kenyan Shilling",        cc: "ke", kind: "fiat",   decimals: 2 },
  { code: "USDT", symbol: "USDT", locale: "en-US", name: "Tether (USDT)",          cc: "",   kind: "crypto", decimals: 2 },
  // ── Africa ──
  { code: "NGN",  symbol: "₦",    locale: "en-NG", name: "Nigerian Naira",         cc: "ng", kind: "fiat", decimals: 2 },
  { code: "ZAR",  symbol: "R",    locale: "en-ZA", name: "South African Rand",     cc: "za", kind: "fiat", decimals: 2 },
  { code: "GHS",  symbol: "GH₵",  locale: "en-GH", name: "Ghanaian Cedi",          cc: "gh", kind: "fiat", decimals: 2 },
  { code: "TZS",  symbol: "TSh",  locale: "en-TZ", name: "Tanzanian Shilling",     cc: "tz", kind: "fiat", decimals: 0 },
  { code: "UGX",  symbol: "USh",  locale: "en-UG", name: "Ugandan Shilling",       cc: "ug", kind: "fiat", decimals: 0 },
  { code: "RWF",  symbol: "FRw",  locale: "en-RW", name: "Rwandan Franc",          cc: "rw", kind: "fiat", decimals: 0 },
  { code: "ETB",  symbol: "Br",   locale: "en",    name: "Ethiopian Birr",         cc: "et", kind: "fiat", decimals: 2 },
  { code: "EGP",  symbol: "E£",   locale: "ar-EG", name: "Egyptian Pound",         cc: "eg", kind: "fiat", decimals: 2 },
  { code: "MAD",  symbol: "DH",   locale: "ar-MA", name: "Moroccan Dirham",        cc: "ma", kind: "fiat", decimals: 2 },
  { code: "XOF",  symbol: "CFA",  locale: "fr",    name: "West African CFA Franc", cc: "sn", kind: "fiat", decimals: 0 },
  { code: "XAF",  symbol: "FCFA", locale: "fr",    name: "Central African CFA",    cc: "cm", kind: "fiat", decimals: 0 },
  { code: "ZMW",  symbol: "ZK",   locale: "en-ZM", name: "Zambian Kwacha",         cc: "zm", kind: "fiat", decimals: 2 },
  { code: "BWP",  symbol: "P",    locale: "en-BW", name: "Botswana Pula",          cc: "bw", kind: "fiat", decimals: 2 },
  { code: "MUR",  symbol: "₨",    locale: "en-MU", name: "Mauritian Rupee",        cc: "mu", kind: "fiat", decimals: 2 },
  { code: "DZD",  symbol: "DA",   locale: "ar",    name: "Algerian Dinar",         cc: "dz", kind: "fiat", decimals: 2 },
  { code: "TND",  symbol: "DT",   locale: "ar-TN", name: "Tunisian Dinar",         cc: "tn", kind: "fiat", decimals: 2 },
  { code: "MWK",  symbol: "MK",   locale: "en",    name: "Malawian Kwacha",        cc: "mw", kind: "fiat", decimals: 2 },
  { code: "MZN",  symbol: "MT",   locale: "pt",    name: "Mozambican Metical",     cc: "mz", kind: "fiat", decimals: 2 },
  { code: "AOA",  symbol: "Kz",   locale: "pt",    name: "Angolan Kwanza",         cc: "ao", kind: "fiat", decimals: 2 },
  // ── Americas ──
  { code: "USD",  symbol: "$",    locale: "en-US", name: "US Dollar",              cc: "us", kind: "fiat", decimals: 2 },
  { code: "CAD",  symbol: "C$",   locale: "en-CA", name: "Canadian Dollar",        cc: "ca", kind: "fiat", decimals: 2 },
  { code: "BRL",  symbol: "R$",   locale: "pt-BR", name: "Brazilian Real",         cc: "br", kind: "fiat", decimals: 2 },
  { code: "MXN",  symbol: "Mex$", locale: "es-MX", name: "Mexican Peso",           cc: "mx", kind: "fiat", decimals: 2 },
  { code: "ARS",  symbol: "$",    locale: "es-AR", name: "Argentine Peso",         cc: "ar", kind: "fiat", decimals: 2 },
  { code: "COP",  symbol: "$",    locale: "es-CO", name: "Colombian Peso",         cc: "co", kind: "fiat", decimals: 2 },
  { code: "CLP",  symbol: "$",    locale: "es-CL", name: "Chilean Peso",           cc: "cl", kind: "fiat", decimals: 0 },
  { code: "PEN",  symbol: "S/",   locale: "es-PE", name: "Peruvian Sol",           cc: "pe", kind: "fiat", decimals: 2 },
  // ── Europe ──
  { code: "EUR",  symbol: "€",    locale: "en-IE", name: "Euro",                   cc: "eu", kind: "fiat", decimals: 2 },
  { code: "GBP",  symbol: "£",    locale: "en-GB", name: "British Pound",          cc: "gb", kind: "fiat", decimals: 2 },
  { code: "CHF",  symbol: "CHF",  locale: "de-CH", name: "Swiss Franc",            cc: "ch", kind: "fiat", decimals: 2 },
  { code: "RUB",  symbol: "₽",    locale: "ru-RU", name: "Russian Ruble",          cc: "ru", kind: "fiat", decimals: 2 },
  { code: "TRY",  symbol: "₺",    locale: "tr-TR", name: "Turkish Lira",           cc: "tr", kind: "fiat", decimals: 2 },
  { code: "PLN",  symbol: "zł",   locale: "pl-PL", name: "Polish Zloty",           cc: "pl", kind: "fiat", decimals: 2 },
  { code: "SEK",  symbol: "kr",   locale: "sv-SE", name: "Swedish Krona",          cc: "se", kind: "fiat", decimals: 2 },
  { code: "NOK",  symbol: "kr",   locale: "nb-NO", name: "Norwegian Krone",        cc: "no", kind: "fiat", decimals: 2 },
  { code: "DKK",  symbol: "kr",   locale: "da-DK", name: "Danish Krone",           cc: "dk", kind: "fiat", decimals: 2 },
  { code: "CZK",  symbol: "Kč",   locale: "cs-CZ", name: "Czech Koruna",           cc: "cz", kind: "fiat", decimals: 2 },
  { code: "HUF",  symbol: "Ft",   locale: "hu-HU", name: "Hungarian Forint",       cc: "hu", kind: "fiat", decimals: 0 },
  { code: "RON",  symbol: "lei",  locale: "ro-RO", name: "Romanian Leu",           cc: "ro", kind: "fiat", decimals: 2 },
  { code: "UAH",  symbol: "₴",    locale: "uk-UA", name: "Ukrainian Hryvnia",      cc: "ua", kind: "fiat", decimals: 2 },
  // ── Middle East ──
  { code: "AED",  symbol: "د.إ",  locale: "ar-AE", name: "UAE Dirham",             cc: "ae", kind: "fiat", decimals: 2 },
  { code: "SAR",  symbol: "﷼",    locale: "ar-SA", name: "Saudi Riyal",            cc: "sa", kind: "fiat", decimals: 2 },
  { code: "QAR",  symbol: "﷼",    locale: "ar-QA", name: "Qatari Riyal",           cc: "qa", kind: "fiat", decimals: 2 },
  { code: "ILS",  symbol: "₪",    locale: "he-IL", name: "Israeli Shekel",         cc: "il", kind: "fiat", decimals: 2 },
  // ── Asia / Pacific ──
  { code: "INR",  symbol: "₹",    locale: "en-IN", name: "Indian Rupee",           cc: "in", kind: "fiat", decimals: 2 },
  { code: "CNY",  symbol: "¥",    locale: "zh-CN", name: "Chinese Yuan",           cc: "cn", kind: "fiat", decimals: 2 },
  { code: "JPY",  symbol: "¥",    locale: "ja-JP", name: "Japanese Yen",           cc: "jp", kind: "fiat", decimals: 0 },
  { code: "KRW",  symbol: "₩",    locale: "ko-KR", name: "South Korean Won",       cc: "kr", kind: "fiat", decimals: 0 },
  { code: "IDR",  symbol: "Rp",   locale: "id-ID", name: "Indonesian Rupiah",      cc: "id", kind: "fiat", decimals: 0 },
  { code: "PHP",  symbol: "₱",    locale: "en-PH", name: "Philippine Peso",        cc: "ph", kind: "fiat", decimals: 2 },
  { code: "PKR",  symbol: "₨",    locale: "en-PK", name: "Pakistani Rupee",        cc: "pk", kind: "fiat", decimals: 2 },
  { code: "BDT",  symbol: "৳",    locale: "bn-BD", name: "Bangladeshi Taka",       cc: "bd", kind: "fiat", decimals: 2 },
  { code: "VND",  symbol: "₫",    locale: "vi-VN", name: "Vietnamese Dong",        cc: "vn", kind: "fiat", decimals: 0 },
  { code: "THB",  symbol: "฿",    locale: "th-TH", name: "Thai Baht",              cc: "th", kind: "fiat", decimals: 2 },
  { code: "MYR",  symbol: "RM",   locale: "ms-MY", name: "Malaysian Ringgit",      cc: "my", kind: "fiat", decimals: 2 },
  { code: "SGD",  symbol: "S$",   locale: "en-SG", name: "Singapore Dollar",       cc: "sg", kind: "fiat", decimals: 2 },
  { code: "HKD",  symbol: "HK$",  locale: "en-HK", name: "Hong Kong Dollar",       cc: "hk", kind: "fiat", decimals: 2 },
  { code: "AUD",  symbol: "A$",   locale: "en-AU", name: "Australian Dollar",      cc: "au", kind: "fiat", decimals: 2 },
  { code: "NZD",  symbol: "NZ$",  locale: "en-NZ", name: "New Zealand Dollar",     cc: "nz", kind: "fiat", decimals: 2 },
];

export const CURRENCY_BY_CODE: Record<string, DisplayCurrency> =
  Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export const DEFAULT_CURRENCY = "KES";

// Cloudflare CF-IPCountry (ISO-3166 alpha-2) → display currency. Only maps to
// currencies present in CURRENCIES; anything unmapped falls back to USD.
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Africa
  KE: "KES", NG: "NGN", ZA: "ZAR", GH: "GHS", TZ: "TZS", UG: "UGX", RW: "RWF",
  ET: "ETB", EG: "EGP", MA: "MAD", DZ: "DZD", TN: "TND", ZM: "ZMW", BW: "BWP",
  MU: "MUR", MW: "MWK", MZ: "MZN", AO: "AOA",
  SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF", BJ: "XOF", TG: "XOF", NE: "XOF",
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF",
  // Americas
  US: "USD", CA: "CAD", BR: "BRL", MX: "MXN", AR: "ARS", CO: "COP", CL: "CLP",
  PE: "PEN", EC: "USD", PA: "USD",
  // Europe (euro)
  DE: "EUR", FR: "EUR", IE: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", PT: "EUR",
  BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR",
  LV: "EUR", EE: "EUR", LU: "EUR", HR: "EUR", CY: "EUR", MT: "EUR",
  // Europe (non-euro)
  GB: "GBP", CH: "CHF", RU: "RUB", TR: "TRY", PL: "PLN", SE: "SEK", NO: "NOK",
  DK: "DKK", CZ: "CZK", HU: "HUF", RO: "RON", UA: "UAH",
  // Middle East
  AE: "AED", SA: "SAR", QA: "QAR", IL: "ILS",
  // Asia / Pacific
  IN: "INR", CN: "CNY", JP: "JPY", KR: "KRW", ID: "IDR", PH: "PHP", PK: "PKR",
  BD: "BDT", VN: "VND", TH: "THB", MY: "MYR", SG: "SGD", HK: "HKD", AU: "AUD",
  NZ: "NZD",
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
