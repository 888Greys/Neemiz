// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATION — the real-tick supply the pricing engine bootstraps from.
//
// The engine (lib/binary/pricing.ts) prices by resampling recent REAL ticks, so
// it needs a fresh, sufficiently-long window per symbol at quote time. This
// module fetches that window from the same server-side Deriv feed used for
// settlement, with a short in-memory cache so a burst of quotes doesn't hammer
// the feed. FAIL-CLOSED: if we can't get enough recent ticks, callers must
// refuse to quote rather than price on thin data.
// ─────────────────────────────────────────────────────────────────────────────

import { getServerTickHistory } from "@/lib/binary-price";
import { measureSymbolEdge } from "@/lib/binary/pricing";

// Enough history for a stable bootstrap even on slow (2s-tick) symbols. Deriv
// caps history at 5000; we ask for a wide window and take what we get.
const TARGET_TICKS = 3000;
const LOOKBACK_SEC = 9000;     // ~3000 ticks even at one tick / ~2–3s
const CACHE_TTL_MS = 3000;     // ticks land ~1s apart; a 3s cache stays fresh

type Entry = { prices: number[]; lastEpoch: number; edge: number; at: number };
const cache = new Map<string, Entry>();

/**
 * Recent real ticks for a symbol, newest last. Cached briefly. Returns the raw
 * prices, the latest tick's epoch, and the measured per-symbol house `edge`
 * (see measureSymbolEdge — computed once per cache refresh). Throws if the feed
 * can't supply a usable window — callers translate that into a 503 / refuse to
 * quote, never a guessed price.
 */
export async function getCalibrationTicks(symbol: string): Promise<{ prices: number[]; entrySpot: number; entryEpoch: number; edge: number }> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { prices: cached.prices, entrySpot: cached.prices[cached.prices.length - 1], entryEpoch: cached.lastEpoch, edge: cached.edge };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const hist = await getServerTickHistory(symbol, nowSec - LOOKBACK_SEC, TARGET_TICKS);
  const prices = hist.map((h) => h.price).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length < 1) throw new Error(`no ticks for ${symbol}`);

  const lastEpoch = hist[hist.length - 1].epoch;
  const edge = measureSymbolEdge(prices);
  cache.set(symbol, { prices, lastEpoch, edge, at: Date.now() });
  return { prices, entrySpot: prices[prices.length - 1], entryEpoch: lastEpoch, edge };
}
