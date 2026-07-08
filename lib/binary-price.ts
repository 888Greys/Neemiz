// Server-side binary (synthetic index) digit source.
//
// SECURITY: binary settlement must NEVER trust a client-supplied exit digit.
// The browser streams Deriv ticks for charting, but the digit a trade settles
// on has to be fetched here, server-side, from the same Deriv feed. If we can't
// get a live tick we refuse to settle rather than fall back to a guessable
// value — trusting the client's digit is exactly what was being exploited to
// mint guaranteed wins (the forex feature had, and fixed, the same hole).

import { quoteToDigit, DerivClient, type TickPoint } from "neemiz-binary-engine";

// Synthetic index symbols accepted for binary trades. Mirrors VALID_MARKETS in
// app/api/binary/bet/route.ts and MARKETS in components/binary/binary-client.tsx.
const VALID_SYMBOLS = new Set(["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"]);

export function isKnownBinarySymbol(symbol: string): boolean {
  return VALID_SYMBOLS.has(symbol);
}

type CacheEntry = { digit: number; quote: number; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 800; // ticks land ~1s apart; short cache stays fresh & cheap

const derivClient = new DerivClient({
  wsTimeoutMs: 6000
});

/**
 * Fetch the latest live tick for a synthetic-index symbol from Deriv and derive
 * its last digit, server-side. Throws if the symbol is unknown or no live tick
 * can be obtained.
 */
export async function getServerBinaryDigit(symbol: string): Promise<{ digit: number; quote: number }> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { digit: cached.digit, quote: cached.quote };
  }

  const quote = await derivClient.fetchLatestPrice(symbol);
  if (!Number.isFinite(quote) || quote <= 0) {
    throw new Error(`Invalid live tick for ${symbol}`);
  }
  const digit = quoteToDigit(quote);
  cache.set(symbol, { digit, quote, at: Date.now() });
  return { digit, quote };
}

export type { TickPoint };

export type ContractExitDigit =
  | { ready: true; digit: number; quote: number; epoch: number }
  | { ready: false };

/**
 * Deterministic settlement digit for a digit contract: the last digit of the
 * `durationTicks`-th tick STRICTLY AFTER `entryEpoch`. This is the exit tick the
 * contract was priced against (pricing simulates `w.forward[duration-1]`), so
 * price and settlement share the same tick and the player cannot influence the
 * outcome by choosing WHEN to settle.
 *
 * Returns `{ ready: false }` when the exit tick hasn't been produced by the feed
 * yet — the caller keeps the trade PENDING and retries, exactly like directional
 * settlement. Throws only when the feed itself can't be reached (network/outage)
 * so callers can distinguish "wait" from "refuse to settle".
 */
export async function getContractExitDigit(
  symbol: string,
  entryEpoch: number,
  durationTicks: number,
): Promise<ContractExitDigit> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);
  // Ask for a little slack beyond the exit tick to tolerate feed jitter.
  const hist = await getServerTickHistory(symbol, entryEpoch, durationTicks + 20);
  const forward = hist
    .filter((t) => t.epoch > entryEpoch && Number.isFinite(t.price) && t.price > 0)
    .sort((a, b) => a.epoch - b.epoch);
  if (forward.length < durationTicks) return { ready: false };
  const exit = forward[durationTicks - 1];
  return { ready: true, digit: quoteToDigit(exit.price), quote: exit.price, epoch: exit.epoch };
}

/**
 * Fetch the Deriv tick history for a symbol from `startEpoch` (exclusive) up to
 * the latest tick, server-side. Used for accumulator settlement, which has to
 * replay the whole tick path to find a barrier breach. Returns chronological
 * { price, epoch } points strictly after startEpoch. Throws on unknown symbol
 * or no obtainable history.
 */
export async function getServerTickHistory(
  symbol: string,
  startEpoch: number,
  count = 1000,
): Promise<TickPoint[]> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);
  return derivClient.fetchTickHistory(symbol, startEpoch, Math.min(Math.max(count, 1), 5000));
}

/**
 * Fetch the CURRENT live entry tick for a contract, server-side and UNCACHED.
 *
 * The entry spot a directional trade is priced/settled against must be the tick
 * at placement time — never a cached one. A stale entry (e.g. from the 3s
 * calibration cache) lets a player watch the live feed and bet in the direction
 * the price already moved, getting a lagging entry that nudges their win
 * probability above 50%. This always hits Deriv fresh so there is no such gap.
 */
export async function getLiveEntrySpot(symbol: string): Promise<{ spot: number; epoch: number }> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);
  const nowSec = Math.floor(Date.now() / 1000);
  const hist = await derivClient.fetchTickHistory(symbol, nowSec - 30, 5);
  const last = hist[hist.length - 1];
  if (!last || !Number.isFinite(last.price) || last.price <= 0) throw new Error(`No live entry tick for ${symbol}`);
  return { spot: last.price, epoch: last.epoch };
}
