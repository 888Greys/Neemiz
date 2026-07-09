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
  cc: string;       // ISO-3166 alpha-2 for the flag image ("" for crypto / unknown)
  kind: CurrencyKind;
  decimals: number; // typical display precision
}

/** Pinned at the top of the picker (home + borderless + majors). */
export const PINNED_CURRENCY_CODES = [
  "KES", "USDT", "USD", "EUR", "GBP", "NGN", "ZAR", "GHS", "TZS", "UGX",
] as const;

// ISO-4217 currencies with zero minor units (common subset).
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF",
  "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF", "HUF", "IDR", "TWD",
]);

/** Curated overrides: better symbols, locales, and flag countries. */
const CURATED: Record<string, Partial<DisplayCurrency>> = {
  KES:  { symbol: "KSh",  locale: "en-KE", name: "Kenyan Shilling",        cc: "ke" },
  USDT: { symbol: "USDT", locale: "en-US", name: "Tether (USDT)",          cc: "", kind: "crypto", decimals: 2 },
  NGN:  { symbol: "₦",    locale: "en-NG", name: "Nigerian Naira",         cc: "ng" },
  ZAR:  { symbol: "R",    locale: "en-ZA", name: "South African Rand",     cc: "za" },
  GHS:  { symbol: "GH₵",  locale: "en-GH", name: "Ghanaian Cedi",          cc: "gh" },
  TZS:  { symbol: "TSh",  locale: "en-TZ", name: "Tanzanian Shilling",     cc: "tz", decimals: 0 },
  UGX:  { symbol: "USh",  locale: "en-UG", name: "Ugandan Shilling",       cc: "ug", decimals: 0 },
  RWF:  { symbol: "FRw",  locale: "en-RW", name: "Rwandan Franc",          cc: "rw", decimals: 0 },
  ETB:  { symbol: "Br",   locale: "en",    name: "Ethiopian Birr",         cc: "et" },
  EGP:  { symbol: "E£",   locale: "ar-EG", name: "Egyptian Pound",         cc: "eg" },
  MAD:  { symbol: "DH",   locale: "ar-MA", name: "Moroccan Dirham",        cc: "ma" },
  XOF:  { symbol: "CFA",  locale: "fr",    name: "West African CFA Franc", cc: "sn", decimals: 0 },
  XAF:  { symbol: "FCFA", locale: "fr",    name: "Central African CFA",    cc: "cm", decimals: 0 },
  ZMW:  { symbol: "ZK",   locale: "en-ZM", name: "Zambian Kwacha",         cc: "zm" },
  BWP:  { symbol: "P",    locale: "en-BW", name: "Botswana Pula",          cc: "bw" },
  MUR:  { symbol: "₨",    locale: "en-MU", name: "Mauritian Rupee",        cc: "mu" },
  DZD:  { symbol: "DA",   locale: "ar",    name: "Algerian Dinar",         cc: "dz" },
  TND:  { symbol: "DT",   locale: "ar-TN", name: "Tunisian Dinar",         cc: "tn" },
  MWK:  { symbol: "MK",   locale: "en",    name: "Malawian Kwacha",        cc: "mw" },
  MZN:  { symbol: "MT",   locale: "pt",    name: "Mozambican Metical",     cc: "mz" },
  AOA:  { symbol: "Kz",   locale: "pt",    name: "Angolan Kwanza",         cc: "ao" },
  USD:  { symbol: "$",    locale: "en-US", name: "US Dollar",              cc: "us" },
  CAD:  { symbol: "C$",   locale: "en-CA", name: "Canadian Dollar",        cc: "ca" },
  BRL:  { symbol: "R$",   locale: "pt-BR", name: "Brazilian Real",         cc: "br" },
  MXN:  { symbol: "Mex$", locale: "es-MX", name: "Mexican Peso",           cc: "mx" },
  ARS:  { symbol: "$",    locale: "es-AR", name: "Argentine Peso",         cc: "ar" },
  COP:  { symbol: "$",    locale: "es-CO", name: "Colombian Peso",         cc: "co" },
  CLP:  { symbol: "$",    locale: "es-CL", name: "Chilean Peso",           cc: "cl", decimals: 0 },
  PEN:  { symbol: "S/",   locale: "es-PE", name: "Peruvian Sol",           cc: "pe" },
  EUR:  { symbol: "€",    locale: "en-IE", name: "Euro",                   cc: "eu" },
  GBP:  { symbol: "£",    locale: "en-GB", name: "British Pound",          cc: "gb" },
  CHF:  { symbol: "CHF",  locale: "de-CH", name: "Swiss Franc",            cc: "ch" },
  RUB:  { symbol: "₽",    locale: "ru-RU", name: "Russian Ruble",          cc: "ru" },
  TRY:  { symbol: "₺",    locale: "tr-TR", name: "Turkish Lira",           cc: "tr" },
  PLN:  { symbol: "zł",   locale: "pl-PL", name: "Polish Zloty",           cc: "pl" },
  SEK:  { symbol: "kr",   locale: "sv-SE", name: "Swedish Krona",          cc: "se" },
  NOK:  { symbol: "kr",   locale: "nb-NO", name: "Norwegian Krone",        cc: "no" },
  DKK:  { symbol: "kr",   locale: "da-DK", name: "Danish Krone",           cc: "dk" },
  CZK:  { symbol: "Kč",   locale: "cs-CZ", name: "Czech Koruna",           cc: "cz" },
  HUF:  { symbol: "Ft",   locale: "hu-HU", name: "Hungarian Forint",       cc: "hu", decimals: 0 },
  RON:  { symbol: "lei",  locale: "ro-RO", name: "Romanian Leu",           cc: "ro" },
  UAH:  { symbol: "₴",    locale: "uk-UA", name: "Ukrainian Hryvnia",      cc: "ua" },
  AED:  { symbol: "د.إ",  locale: "ar-AE", name: "UAE Dirham",             cc: "ae" },
  SAR:  { symbol: "﷼",    locale: "ar-SA", name: "Saudi Riyal",            cc: "sa" },
  QAR:  { symbol: "﷼",    locale: "ar-QA", name: "Qatari Riyal",           cc: "qa" },
  ILS:  { symbol: "₪",    locale: "he-IL", name: "Israeli Shekel",         cc: "il" },
  INR:  { symbol: "₹",    locale: "en-IN", name: "Indian Rupee",           cc: "in" },
  CNY:  { symbol: "¥",    locale: "zh-CN", name: "Chinese Yuan",           cc: "cn" },
  JPY:  { symbol: "¥",    locale: "ja-JP", name: "Japanese Yen",           cc: "jp", decimals: 0 },
  KRW:  { symbol: "₩",    locale: "ko-KR", name: "South Korean Won",       cc: "kr", decimals: 0 },
  IDR:  { symbol: "Rp",   locale: "id-ID", name: "Indonesian Rupiah",      cc: "id", decimals: 0 },
  PHP:  { symbol: "₱",    locale: "en-PH", name: "Philippine Peso",        cc: "ph" },
  PKR:  { symbol: "₨",    locale: "en-PK", name: "Pakistani Rupee",        cc: "pk" },
  BDT:  { symbol: "৳",    locale: "bn-BD", name: "Bangladeshi Taka",       cc: "bd" },
  VND:  { symbol: "₫",    locale: "vi-VN", name: "Vietnamese Dong",        cc: "vn", decimals: 0 },
  THB:  { symbol: "฿",    locale: "th-TH", name: "Thai Baht",              cc: "th" },
  MYR:  { symbol: "RM",   locale: "ms-MY", name: "Malaysian Ringgit",      cc: "my" },
  SGD:  { symbol: "S$",   locale: "en-SG", name: "Singapore Dollar",       cc: "sg" },
  HKD:  { symbol: "HK$",  locale: "en-HK", name: "Hong Kong Dollar",       cc: "hk" },
  AUD:  { symbol: "A$",   locale: "en-AU", name: "Australian Dollar",      cc: "au" },
  NZD:  { symbol: "NZ$",  locale: "en-NZ", name: "New Zealand Dollar",     cc: "nz" },
};

function intlSymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

function intlName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function buildWorldCurrencies(): DisplayCurrency[] {
  const names =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as typeof Intl & { supportedValuesOf(k: string): string[] }).supportedValuesOf("currency")
      : Object.keys(CURATED).filter((c) => c !== "USDT");

  const byCode = new Map<string, DisplayCurrency>();

  for (const code of names) {
    const override = CURATED[code] ?? {};
    byCode.set(code, {
      code,
      symbol: override.symbol ?? intlSymbol(code),
      locale: override.locale ?? "en",
      name: override.name ?? intlName(code),
      cc: override.cc ?? "",
      kind: "fiat",
      decimals: override.decimals ?? (ZERO_DECIMAL.has(code) ? 0 : 2),
    });
  }

  // Always include USDT (not ISO-4217).
  byCode.set("USDT", {
    code: "USDT",
    symbol: "USDT",
    locale: "en-US",
    name: "Tether (USDT)",
    cc: "",
    kind: "crypto",
    decimals: 2,
  });

  // Ensure every curated override exists even if Intl omitted it.
  for (const [code, override] of Object.entries(CURATED)) {
    if (byCode.has(code)) continue;
    byCode.set(code, {
      code,
      symbol: override.symbol ?? code,
      locale: override.locale ?? "en",
      name: override.name ?? code,
      cc: override.cc ?? "",
      kind: override.kind ?? "fiat",
      decimals: override.decimals ?? 2,
    });
  }

  const pinned = PINNED_CURRENCY_CODES
    .map((c) => byCode.get(c))
    .filter((c): c is DisplayCurrency => !!c);

  const pinnedSet = new Set(PINNED_CURRENCY_CODES);
  const rest = [...byCode.values()]
    .filter((c) => !pinnedSet.has(c.code as (typeof PINNED_CURRENCY_CODES)[number]))
    .sort((a, b) => a.code.localeCompare(b.code));

  return [...pinned, ...rest];
}

// Ordered for the picker: pinned majors first, then every ISO currency Intl
// knows (~160). FX comes live from getFxRatesToKES; missing rates fall back
// to showing the KES figure.
export const CURRENCIES: DisplayCurrency[] = buildWorldCurrencies();

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

/**
 * Inverse of convertFromKes: turn an amount the user entered in `code` back into
 * canonical KES, using the same toKES rate map. Used at the input boundary so a
 * user can transact in their display currency while the ledger/server stay KES.
 * Returns the amount unchanged if we lack a rate (mirrors convertFromKes).
 */
export function convertToKes(amount: number, code: string, toKES: Record<string, number>): number {
  const n = Number.isFinite(amount) ? amount : 0;
  if (code === "KES") return n;
  const rateCode = code === "USDT" ? "USD" : code;
  const kesPerUnit = toKES[rateCode];
  if (!kesPerUnit || kesPerUnit <= 0) return n; // no rate → treat as KES
  return n * kesPerUnit;
}

/**
 * Format an already-converted amount with the currency's symbol + locale.
 * Non-base currencies get a "≈" prefix (Binance-style) because the real balance
 * is KES and the converted figure is an indicative value at current FX.
 */
export function formatInCurrency(amount: number, code: string): string {
  const c = CURRENCY_BY_CODE[code] ?? CURRENCY_BY_CODE[DEFAULT_CURRENCY];
  const n = Number.isFinite(amount) ? amount : 0;
  const num = n.toLocaleString(c.locale, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  const approx = code === DEFAULT_CURRENCY ? "" : "≈ ";
  return `${approx}${c.symbol} ${num}`;
}

/** Convert KES → code and format in one step. */
export function formatKesAs(amountKes: number, code: string, toKES: Record<string, number>): string {
  return formatInCurrency(convertFromKes(amountKes, code, toKES), code);
}
