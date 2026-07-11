// Server-side binary (synthetic index) tick source.
//
// SECURITY: binary settlement must NEVER trust a client-supplied exit digit, and
// it must NEVER settle on "the latest live tick" — that let a player watch the
// feed and only settle once the current digit favoured their bet. A digit
// contract settles on the DETERMINISTIC exit tick: the durationTicks-th tick
// after its committed entryEpoch, fetched here server-side from the same public
// Deriv feed used for pricing. If that tick can't be obtained we refuse to
// settle (retry) rather than fall back to any guessable value.

import { quoteToDigit, DerivClient, type TickPoint } from "neemiz-binary-engine";
import { resolveDigitExitTick } from "@/lib/binary/kernel";
import { getLatestTick, getTicksSince, startDerivFeed } from "@/lib/deriv-feed";

// Synthetic index symbols accepted for binary trades. Mirrors VALID_MARKETS in
// app/api/binary/bet/route.ts and MARKETS in components/binary/binary-client.tsx.
const VALID_SYMBOLS = new Set(["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"]);

export function isKnownBinarySymbol(symbol: string): boolean {
  return VALID_SYMBOLS.has(symbol);
}

const derivClient = new DerivClient({
  wsTimeoutMs: 6000
});

export type { TickPoint };

export type ContractExitDigit =
  | { ready: true; digit: number; quote: number; epoch: number }
  | { ready: false };

/**
 * Deterministic settlement digit for a digit contract: the last digit of the
 * `durationTicks`-th tick STRICTLY AFTER `entryEpoch`. This is the exit tick the
 * contract was priced against (pricing simulates `w.forward[duration-1]`), so
 * price and settlement share the same tick and the player cannot influence the
 * outcome by choosing WHEN to settle. The tick selection itself is the pure,
 * unit-tested `resolveDigitExitTick` kernel — this only supplies the real ticks.
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
  const exit = resolveDigitExitTick(hist, entryEpoch, durationTicks);
  if (!exit) return { ready: false };
  return { ready: true, digit: quoteToDigit(exit.price), quote: exit.price, epoch: exit.epoch };
}

/**
 * Fetch the Deriv tick history for a symbol from `startEpoch` (exclusive) up to
 * the latest tick, server-side. Used for accumulator settlement, which has to
 * replay the whole tick path to find a barrier breach. Returns chronological
 * { price, epoch } points strictly after startEpoch. Throws on unknown symbol
 * or no obtainable history.
 *
 * Prefers the shared in-process Deriv feed when it can prove continuity from
 * startEpoch; otherwise falls back to a one-shot WebSocket history fetch.
 */
export async function getServerTickHistory(
  symbol: string,
  startEpoch: number,
  count = 1000,
): Promise<TickPoint[]> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);

  // Warm the feed on first use in this process (no-op if already started / disabled).
  startDerivFeed();

  const fromFeed = getTicksSince(symbol, startEpoch);
  if (fromFeed && fromFeed.length > 0) {
    // Cap to requested count from the end (most recent), matching history semantics.
    return fromFeed.length > count ? fromFeed.slice(-count) : fromFeed;
  }

  return derivClient.fetchTickHistory(symbol, startEpoch, Math.min(Math.max(count, 1), 5000));
}

/**
 * Fetch the CURRENT live entry tick for a contract, server-side and UNCACHED.
 *
 * The entry spot a directional trade is priced/settled against must be the tick
 * at placement time — never a cached one. A stale entry (e.g. from the 3s
 * calibration cache) lets a player watch the live feed and bet in the direction
 * the price already moved, getting a lagging entry that nudges their win
 * probability above 50%. Prefers the shared feed when fresh; otherwise hits
 * Deriv with a one-shot history fetch.
 */
export async function getLiveEntrySpot(symbol: string): Promise<{ spot: number; epoch: number }> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);

  startDerivFeed();
  const live = getLatestTick(symbol);
  if (live) return { spot: live.price, epoch: live.epoch };

  const nowSec = Math.floor(Date.now() / 1000);
  const hist = await derivClient.fetchTickHistory(symbol, nowSec - 30, 5);
  const last = hist[hist.length - 1];
  if (!last || !Number.isFinite(last.price) || last.price <= 0) throw new Error(`No live entry tick for ${symbol}`);
  return { spot: last.price, epoch: last.epoch };
}
