// ─── Live crypto spot rates (CoinGecko) ───────────────────────────────────────
// 1 <crypto> in <fiat>, used as the true "market" reference for the P2P margin
// badge and headline rate line. Cached 2 min via Next's data cache to stay
// within CoinGecko's free tier. Returns null on any failure so callers can fall
// back to the median-of-offers reference.

const COINGECKO_IDS: Record<string, string> = {
  USDT: "tether",
  USDC: "usd-coin",
  BTC:  "bitcoin",
  ETH:  "ethereum",
  BNB:  "binancecoin",
};

export async function getSpotRate(crypto: string, fiat: string): Promise<number | null> {
  const id = COINGECKO_IDS[crypto?.toUpperCase()];
  const vs = (fiat ?? "").toLowerCase();
  if (!id || !vs) return null;
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
