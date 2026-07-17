// ─── Live crypto spot rates (CoinGecko + FX fallback) ─────────────────────────
// 1 <crypto> in <fiat>, used as the true "market" reference for the P2P margin
// badge and headline rate line. Cached 2 min via Next's data cache to stay
// within CoinGecko's free tier. When CoinGecko lacks a fiat (e.g. ALL), we
// triangulate via USD + the open.er-api.com FX table so Market margin pricing
// still works worldwide. Returns null on any failure so callers can fall back.

import { getFxRatesToKES } from "@/lib/p2p/fx";

const COINGECKO_IDS: Record<string, string> = {
  USDT: "tether",
  USDC: "usd-coin",
  BTC:  "bitcoin",
  ETH:  "ethereum",
  BNB:  "binancecoin",
};

async function fetchCoinGeckoRate(id: string, vs: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}`,
      { next: { revalidate: 120 } },
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, Record<string, number>>;
    const rate = data?.[id]?.[vs];
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/** crypto_usd × (KES per USD) / (KES per fiat) → crypto in fiat. */
export function triangulateSpotViaUsd(
  cryptoUsd: number,
  toKES: Record<string, number>,
  fiat: string,
): number | null {
  if (!(cryptoUsd > 0)) return null;
  const code = fiat.toUpperCase();
  if (code === "USD") return cryptoUsd;
  const usdKes = toKES["USD"];
  const fiatKes = toKES[code];
  if (!(usdKes > 0) || !(fiatKes > 0)) return null;
  const rate = cryptoUsd * (usdKes / fiatKes);
  return rate > 0 ? rate : null;
}

export async function getSpotRate(crypto: string, fiat: string): Promise<number | null> {
  const id = COINGECKO_IDS[crypto?.toUpperCase()];
  const vs = (fiat ?? "").toUpperCase();
  if (!id || !vs) return null;

  // Prefer CoinGecko's direct quote when the fiat is supported.
  const direct = await fetchCoinGeckoRate(id, vs.toLowerCase());
  if (direct != null) return direct;

  // Fallback: crypto/USD from CoinGecko, then FX into the merchant's fiat.
  const usd = vs === "USD" ? null : await fetchCoinGeckoRate(id, "usd");
  if (usd == null) return null;

  try {
    const fx = await getFxRatesToKES();
    return triangulateSpotViaUsd(usd, fx.toKES, vs);
  } catch {
    return null;
  }
}
