/**
 * Per-country in-app coins.
 *
 * "KES Coin" is an in-app coin pegged 1:1 to the Kenyan Shilling and backed
 * directly by the user's KES wallet balance (see lib/p2p/crypto-balance). This
 * registry generalises that idea so EVERY country Nezeem supports has its own
 * local coin (UG Coin ↔ UGX, TZ Coin ↔ TZS, NG Coin ↔ NGN, …), each pegged 1:1
 * to its local currency.
 *
 * ── Source of truth ──
 * The list is DERIVED from the world-country / fiat catalogue (the same source
 * FIAT_CURRENCIES is built from), one coin per registered currency, so adding a
 * country to Nezeem automatically gives it a coin — no hand-maintained list.
 *
 * ── Activation ──
 * An `active` coin is listed everywhere and tradeable on P2P. KES is special:
 * it aliases the user's fiat wallet (User.walletBalance) so M-Pesa deposits fund
 * it and P2P sells count as withdrawals. Every OTHER active local coin rides the
 * generic crypto escrow rails instead (UserCryptoBalance + P2PCryptoBalance) as
 * a 1:1-pegged in-app balance with NO on-chain deposit/withdraw. Balances are
 * seeded directly (admin/house merchant) since there is no external rail; from
 * there they trade like any other P2P asset. These coins are a P2P-only
 * marketing instrument — they cannot be withdrawn to a blockchain or bank.
 *
 * The coin's P2P symbol IS its ISO-4217 currency code (KES, UGX, …); the `name`
 * is the display label (KES Coin, UG Coin, …).
 */
import { WORLD_COUNTRIES } from "@/lib/payments/world-countries";

export type LocalCoin = {
  /** ISO 4217 currency code — also the coin's P2P symbol. */
  currency: string;
  /** Display name, e.g. "KES Coin", "UG Coin". */
  name: string;
  /** Country/region for UI copy. */
  region: string;
  /** ISO 3166-1 alpha-2 (lowercase) for the flag icon. */
  flagCode: string;
  /** Live only when the platform can hold + move this currency (1:1 backed). */
  active: boolean;
};

// Currency codes that are NOT eligible for an in-app coin (e.g. they collide
// with a real on-chain asset symbol). None today, but keep the guard explicit.
const EXCLUDED_CURRENCIES = new Set<string>(["USDT", "USDC", "BTC", "ETH", "BNB", "TRX"]);

// Preferred display names for major markets (keeps the original short labels).
// Everything else defaults to "<CODE> Coin".
const CURATED_NAMES: Record<string, string> = {
  KES: "KES Coin", UGX: "UG Coin", TZS: "TZ Coin", NGN: "NG Coin",
  GHS: "GH Coin", ZAR: "ZA Coin", RWF: "RW Coin",
};

// Representative flag + region for currencies shared by many countries, where
// the first world-country entry would be a misleading flag (e.g. EUR → Andorra).
const REP_OVERRIDES: Record<string, { flagCode: string; region: string }> = {
  EUR: { flagCode: "eu", region: "Eurozone" },
  USD: { flagCode: "us", region: "United States" },
  GBP: { flagCode: "gb", region: "United Kingdom" },
  XOF: { flagCode: "sn", region: "West Africa (CFA)" },
  XAF: { flagCode: "cm", region: "Central Africa (CFA)" },
  XCD: { flagCode: "ag", region: "East Caribbean" },
  XPF: { flagCode: "pf", region: "French Pacific" },
  ANG: { flagCode: "cw", region: "Caribbean Guilder" },
  AUD: { flagCode: "au", region: "Australia" },
  NZD: { flagCode: "nz", region: "New Zealand" },
};

// Order preference so common markets surface first in pickers.
const PRIORITY = ["KES", "UGX", "TZS", "NGN", "GHS", "ZAR", "RWF", "ETB", "XOF", "XAF",
  "USD", "EUR", "GBP", "INR", "ZMW", "MWK", "ZWG", "EGP", "MAD"];

function buildLocalCoins(): LocalCoin[] {
  const byCurrency = new Map<string, LocalCoin>();
  for (const w of WORLD_COUNTRIES) {
    const code = w.currency.toUpperCase();
    if (EXCLUDED_CURRENCIES.has(code) || byCurrency.has(code)) continue;
    const override = REP_OVERRIDES[code];
    byCurrency.set(code, {
      currency: code,
      name: CURATED_NAMES[code] ?? `${code} Coin`,
      region: override?.region ?? w.name,
      flagCode: override?.flagCode ?? w.code.toLowerCase(),
      // Every registered country's coin is live. KES is fiat-wallet-backed; the
      // rest ride the generic crypto escrow rails as in-app P2P coins.
      active: true,
    });
  }
  const rank = (c: string) => { const i = PRIORITY.indexOf(c); return i === -1 ? PRIORITY.length : i; };
  return [...byCurrency.values()].sort((a, b) =>
    rank(a.currency) - rank(b.currency) || a.currency.localeCompare(b.currency));
}

export const LOCAL_COINS: LocalCoin[] = buildLocalCoins();

/** Coins that are live. */
export const ACTIVE_LOCAL_COINS = LOCAL_COINS.filter((c) => c.active);

/** The set of currency codes that are live local coins — for O(1) checks. */
export const ACTIVE_LOCAL_COIN_SYMBOLS = new Set(ACTIVE_LOCAL_COINS.map((c) => c.currency));

/** Live local-coin currency codes, in registry order — for building UI/whitelist arrays. */
export const ACTIVE_LOCAL_COIN_CODES = ACTIVE_LOCAL_COINS.map((c) => c.currency);

/** Flag icon URL for a local coin (its P2P coin icon), or null if unknown. */
export function localCoinIconUrl(currency?: string | null): string | null {
  const coin = localCoinForCurrency(currency);
  return coin ? `https://flagcdn.com/w80/${coin.flagCode}.png` : null;
}

export function localCoinForCurrency(currency?: string | null): LocalCoin | null {
  if (!currency) return null;
  return LOCAL_COINS.find((c) => c.currency === currency.toUpperCase()) ?? null;
}

/** Is this symbol/currency a LIVE local coin? */
export function isActiveLocalCoin(symbol?: string | null): boolean {
  return !!symbol && ACTIVE_LOCAL_COIN_SYMBOLS.has(symbol.toUpperCase());
}

/** Display name for a currency's local coin, e.g. "UG Coin" (falls back gracefully). */
export function localCoinName(currency?: string | null): string {
  return localCoinForCurrency(currency)?.name ?? `${(currency ?? "").toUpperCase()} Coin`;
}
