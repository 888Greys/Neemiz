/**
 * Convert on-platform crypto balances to a USDT-equivalent total (Bybit-style).
 * Uses CoinGecko spot vs USD (USDT ≈ 1 USD for display).
 */

import { getSpotRate } from "@/lib/p2p/spot";

export type CryptoBalRow = {
  crypto: string;
  network: string;
  available: number;
  locked: number;
};

/** USDT per 1 unit of `crypto`. Stablecoins ≈ 1; others from spot. */
export async function usdtPerUnit(crypto: string): Promise<number | null> {
  const c = crypto.trim().toUpperCase();
  if (c === "USDT" || c === "USDC" || c === "BUSD" || c === "DAI") return 1;
  // Prefer USD quote (USDT peg); fall back to USDT pair if needed.
  const usd = await getSpotRate(c, "usd");
  if (usd != null && usd > 0) return usd;
  return getSpotRate(c, "usdt");
}

export async function totalUsdtEquivalent(
  rows: CryptoBalRow[],
): Promise<{ totalUsdt: number; priced: number; unpriced: string[] }> {
  const unpriced: string[] = [];
  let totalUsdt = 0;
  let priced = 0;

  // Deduplicate rate fetches per symbol.
  const rateCache = new Map<string, number | null>();

  for (const row of rows) {
    const c = row.crypto.toUpperCase();
    if (c === "KES") continue;
    const qty = Number(row.available) + Number(row.locked);
    if (!(qty > 0)) continue;

    let rate = rateCache.get(c);
    if (rate === undefined) {
      rate = await usdtPerUnit(c);
      rateCache.set(c, rate);
    }
    if (rate == null || !(rate > 0)) {
      unpriced.push(c);
      continue;
    }
    totalUsdt += qty * rate;
    priced += 1;
  }

  return { totalUsdt, priced, unpriced: [...new Set(unpriced)] };
}
