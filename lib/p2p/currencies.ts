// ─── P2P fiat currencies ──────────────────────────────────────────────────────
// Single source of truth for every fiat the P2P market supports. Used by the
// browse filter, the merchant ad form, the order flow, and all formatting so a
// price in NGN never renders with a KSh symbol or en-KE grouping again.

export interface FiatCurrency {
  code: string;   // ISO 4217, e.g. "KES" — also what we store on P2PAd.fiat
  symbol: string; // display symbol, e.g. "KSh"
  name: string;   // human name
  flag: string;   // emoji flag for selectors
  locale: string; // BCP-47 locale for number grouping
}

export const FIAT_CURRENCIES: FiatCurrency[] = [
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling",     flag: "🇰🇪", locale: "en-KE" },
  { code: "NGN", symbol: "₦",   name: "Nigerian Naira",      flag: "🇳🇬", locale: "en-NG" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi",       flag: "🇬🇭", locale: "en-GH" },
  { code: "ZAR", symbol: "R",   name: "South African Rand",  flag: "🇿🇦", locale: "en-ZA" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling",  flag: "🇹🇿", locale: "en-TZ" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling",    flag: "🇺🇬", locale: "en-UG" },
  { code: "USD", symbol: "$",   name: "US Dollar",           flag: "🇺🇸", locale: "en-US" },
  { code: "EUR", symbol: "€",   name: "Euro",                flag: "🇪🇺", locale: "en-IE" },
  { code: "GBP", symbol: "£",   name: "British Pound",       flag: "🇬🇧", locale: "en-GB" },
  { code: "INR", symbol: "₹",   name: "Indian Rupee",        flag: "🇮🇳", locale: "en-IN" },
];

export const DEFAULT_FIAT = "KES";

const BY_CODE = new Map(FIAT_CURRENCIES.map((c) => [c.code, c]));

export function getFiat(code: string | null | undefined): FiatCurrency {
  return (code && BY_CODE.get(code)) || BY_CODE.get(DEFAULT_FIAT)!;
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
