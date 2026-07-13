/**
 * Per-country in-app coins.
 *
 * "KES Coin" is an in-app coin pegged 1:1 to the Kenyan Shilling and backed
 * directly by the user's KES wallet balance (see lib/p2p/crypto-balance). This
 * registry generalises that idea so every country can have its own local coin
 * (UG Coin ↔ UGX, TZ Coin ↔ TZS, …), each 1:1 to its local currency.
 *
 * ── Activation ──
 * A coin is `active` only once the platform can actually hold and move that
 * currency — i.e. the account has a wallet balance in that currency plus deposit
 * and withdrawal rails for it. Today the wallet is KES-only, so KES is the only
 * active coin; the rest are defined and ready to switch on as the multi-currency
 * wallet work lands (flip `active: true`). Nothing offers a coin we can't back.
 *
 * The coin's P2P symbol IS its ISO-4217 currency code (KES, UGX, …); the `name`
 * is the display label (KES Coin, UG Coin, …).
 */
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

export const LOCAL_COINS: LocalCoin[] = [
  { currency: "KES", name: "KES Coin", region: "Kenya",        flagCode: "ke", active: true },
  { currency: "UGX", name: "UG Coin",  region: "Uganda",       flagCode: "ug", active: false },
  { currency: "TZS", name: "TZ Coin",  region: "Tanzania",     flagCode: "tz", active: false },
  { currency: "NGN", name: "NG Coin",  region: "Nigeria",      flagCode: "ng", active: false },
  { currency: "GHS", name: "GH Coin",  region: "Ghana",        flagCode: "gh", active: false },
  { currency: "ZAR", name: "ZA Coin",  region: "South Africa", flagCode: "za", active: false },
  { currency: "RWF", name: "RW Coin",  region: "Rwanda",       flagCode: "rw", active: false },
];

/** Coins that are live (currently just KES). */
export const ACTIVE_LOCAL_COINS = LOCAL_COINS.filter((c) => c.active);

/** The set of currency codes that are live local coins — for O(1) checks. */
export const ACTIVE_LOCAL_COIN_SYMBOLS = new Set(ACTIVE_LOCAL_COINS.map((c) => c.currency));

export function localCoinForCurrency(currency?: string | null): LocalCoin | null {
  if (!currency) return null;
  return LOCAL_COINS.find((c) => c.currency === currency.toUpperCase()) ?? null;
}

/** Is this symbol/currency a LIVE local coin? (KES today.) */
export function isActiveLocalCoin(symbol?: string | null): boolean {
  return !!symbol && ACTIVE_LOCAL_COIN_SYMBOLS.has(symbol.toUpperCase());
}

/** Display name for a currency's local coin, e.g. "UG Coin" (falls back gracefully). */
export function localCoinName(currency?: string | null): string {
  return localCoinForCurrency(currency)?.name ?? `${(currency ?? "").toUpperCase()} Coin`;
}
