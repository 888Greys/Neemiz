// Server-side binary (synthetic index) tick source — relay → local → direct fallback.
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

const VALID_SYMBOLS = new Set(["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"]);

export function isKnownBinarySymbol(symbol: string): boolean {
  return VALID_SYMBOLS.has(symbol);
}

const derivClient = new DerivClient({ wsTimeoutMs: 6000 });
const RELAY_URL = process.env.DERIV_RELAY_URL?.trim();
const RELAY_SECRET = process.env.INTERNAL_RELAY_SECRET?.trim();

export type { TickPoint };

export type ContractExitDigit =
  | { ready: true; digit: number; quote: number; epoch: number }
  | { ready: false };

async function fetchFromRelay<T>(path: string): Promise<T | null> {
  if (!RELAY_URL || !RELAY_SECRET) return null;
  try {
    const res = await fetch(`${RELAY_URL}${path}`, {
      headers: { "x-relay-secret": RELAY_SECRET },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getContractExitDigit(
  symbol: string,
  entryEpoch: number,
  durationTicks: number,
): Promise<ContractExitDigit> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);
  const hist = await getServerTickHistory(symbol, entryEpoch, durationTicks + 20);
  const exit = resolveDigitExitTick(hist, entryEpoch, durationTicks);
  if (!exit) return { ready: false };
  return { ready: true, digit: quoteToDigit(exit.price), quote: exit.price, epoch: exit.epoch };
}

export async function getServerTickHistory(
  symbol: string,
  startEpoch: number,
  count = 1000,
): Promise<TickPoint[]> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);

  // Relay path — binary sister containers talk to Nezeem's single feed
  if (RELAY_URL) {
    try {
      const relayRes = await fetchFromRelay<TickPoint[]>(
        `?action=history&symbol=${encodeURIComponent(symbol)}&startEpoch=${startEpoch}&count=${count}`,
      );
      if (relayRes && relayRes.length > 0) return relayRes;
    } catch (err) {
      console.warn(`[binary-price] Relay history fetch failed for ${symbol}, falling back to direct feed`, err);
    }
  }

  // Local feed path — Nezeem container
  startDerivFeed();
  const fromFeed = getTicksSince(symbol, startEpoch);
  if (fromFeed && fromFeed.length > 0) {
    return fromFeed.length > count ? fromFeed.slice(-count) : fromFeed;
  }
  return derivClient.fetchTickHistory(symbol, startEpoch, Math.min(Math.max(count, 1), 5000));
}

export async function getLiveEntrySpot(symbol: string): Promise<{ spot: number; epoch: number }> {
  if (!VALID_SYMBOLS.has(symbol)) throw new Error(`Unsupported binary symbol: ${symbol}`);

  if (RELAY_URL) {
    try {
      const relayRes = await fetchFromRelay<{ price: number; epoch: number }>(
        `?action=tick&symbol=${encodeURIComponent(symbol)}`,
      );
      if (relayRes && Number.isFinite(relayRes.price) && relayRes.price > 0) {
        return { spot: relayRes.price, epoch: relayRes.epoch };
      }
    } catch (err) {
      console.warn(`[binary-price] Relay tick fetch failed for ${symbol}, falling back to direct feed`, err);
    }
  }

  startDerivFeed();
  const live = getLatestTick(symbol);
  if (live) return { spot: live.price, epoch: live.epoch };

  const nowSec = Math.floor(Date.now() / 1000);
  try {
    const hist = await derivClient.fetchTickHistory(symbol, nowSec - 30, 10);
    const last = hist[hist.length - 1];
    if (last && Number.isFinite(last.price) && last.price > 0) {
      return { spot: last.price, epoch: last.epoch };
    }
  } catch (err) {
    console.warn(`[binary-price] fetchTickHistory failed for ${symbol}, trying wide search`, err);
  }

  const fallbackHist = await derivClient.fetchTickHistory(symbol, nowSec - 300, 10);
  const last = fallbackHist[fallbackHist.length - 1];
  if (!last || !Number.isFinite(last.price) || last.price <= 0) throw new Error(`No live entry tick for ${symbol}`);
  return { spot: last.price, epoch: last.epoch };
}
