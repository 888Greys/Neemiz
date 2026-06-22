// Central currency configuration (display layer).
//
// The platform currently runs on a single display currency — the Kenyan
// Shilling. Historically the "KSh" symbol and the "en-KE" money locale were
// hardcoded in ~100 places, which made expanding to other countries a hunt
// across the whole codebase. This module is the single source of truth for how
// money is *displayed*, so a future multi-country rollout is a config change
// rather than a sweep.
//
// SCOPE: display only. This deliberately does NOT:
//   - convert between currencies (no FX),
//   - touch the ledger `currency` field on transactions (still "KES"),
//   - touch P2P fiat/crypto identifiers ("KES" vs "BTC" etc.), which are
//     business logic, not display.
// The full multi-currency migration will build on top of this later.

// Configurable per-deployment; the defaults reproduce today's exact behaviour.
export const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "KSh";
export const MONEY_LOCALE = process.env.NEXT_PUBLIC_MONEY_LOCALE ?? "en-KE";
// ISO ledger code — exported for the eventual migration; not yet wired into the
// transaction ledger (those still write "KES" directly).
export const CURRENCY_CODE = process.env.NEXT_PUBLIC_CURRENCY_CODE ?? "KES";

/** Format a number the way money amounts are shown (locale grouping). */
export function formatAmount(value: number, opts?: Intl.NumberFormatOptions): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(MONEY_LOCALE, opts);
}

/** Format a money value with the currency symbol, e.g. "KSh 1,234.50". */
export function formatMoney(value: number, opts?: Intl.NumberFormatOptions): string {
  return `${CURRENCY_SYMBOL} ${formatAmount(value, opts)}`;
}
