// Server-side binary (synthetic index) digit source.
//
// SECURITY: binary settlement must NEVER trust a client-supplied exit digit.
// The browser streams Deriv ticks for charting, but the digit a trade settles
// on has to be fetched here, server-side, from the same Deriv feed. If we can't
// get a live tick we refuse to settle rather than fall back to a guessable
// value — trusting the client's digit is exactly what was being exploited to
// mint guaranteed wins (the forex feature had, and fixed, the same hole).

import { quoteToDigit } from "@/lib/binary-digit";

const DERIV_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

// Synthetic index symbols accepted for binary trades. Mirrors VALID_MARKETS in
// app/api/binary/bet/route.ts and MARKETS in components/binary/binary-client.tsx.
const VALID_SYMBOLS = new Set(["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"]);

export function isKnownBinarySymbol(symbol: string): boolean {
  return VALID_SYMBOLS.has(symbol);
}

type CacheEntry = { digit: number; quote: number; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 800; // ticks land ~1s apart; short cache stays fresh & cheap
const WS_TIMEOUT_MS = 6000;

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

  const quote = await fetchDerivTick(symbol);
  if (!Number.isFinite(quote) || quote <= 0) {
    throw new Error(`Invalid live tick for ${symbol}`);
  }
  const digit = quoteToDigit(quote);
  cache.set(symbol, { digit, quote, at: Date.now() });
  return { digit, quote };
}

export type TickPoint = { price: number; epoch: number };

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
  const { prices, times } = await fetchDerivHistory(symbol, startEpoch, Math.min(Math.max(count, 1), 5000));
  const out: TickPoint[] = [];
  for (let i = 0; i < prices.length; i++) {
    const price = prices[i], epoch = times[i];
    if (typeof price === "number" && typeof epoch === "number" && epoch > startEpoch) {
      out.push({ price, epoch });
    }
  }
  out.sort((a, b) => a.epoch - b.epoch);
  return out;
}

function fetchDerivHistory(derivSymbol: string, startEpoch: number, count: number): Promise<{ prices: number[]; times: number[] }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket: WebSocket;
    try {
      socket = new WebSocket(DERIV_WS_URL);
    } catch (err) {
      reject(err instanceof Error ? err : new Error("WebSocket init failed"));
      return;
    }

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* noop */ }
      fn();
    };

    const timer = setTimeout(() => finish(() => reject(new Error("Deriv history timeout"))), WS_TIMEOUT_MS);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        ticks_history: derivSymbol,
        start: startEpoch,
        end: "latest",
        count,
        style: "ticks",
      }));
    };

    socket.onmessage = (event: MessageEvent) => {
      let response: { error?: { message?: string }; history?: { prices?: number[]; times?: number[] } };
      try { response = JSON.parse(String(event.data)); } catch { return; }
      if (response.error) { finish(() => reject(new Error(response.error?.message ?? "Deriv error"))); return; }
      const prices = response.history?.prices, times = response.history?.times;
      if (Array.isArray(prices) && Array.isArray(times)) {
        finish(() => resolve({ prices, times }));
      }
    };

    socket.onerror = () => finish(() => reject(new Error("Deriv stream error")));
    socket.onclose = () => finish(() => reject(new Error("Deriv stream closed")));
  });
}

function fetchDerivTick(derivSymbol: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket: WebSocket;
    try {
      socket = new WebSocket(DERIV_WS_URL);
    } catch (err) {
      reject(err instanceof Error ? err : new Error("WebSocket init failed"));
      return;
    }

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* noop */ }
      fn();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error("Deriv tick timeout"))),
      WS_TIMEOUT_MS,
    );

    socket.onopen = () => {
      socket.send(JSON.stringify({
        ticks_history: derivSymbol,
        count: 1,
        end: "latest",
        style: "ticks",
      }));
    };

    socket.onmessage = (event: MessageEvent) => {
      let response: {
        error?: { message?: string };
        history?: { prices?: number[] };
        tick?: { quote?: number };
      };
      try {
        response = JSON.parse(String(event.data));
      } catch {
        return; // ignore unparseable frames, wait for timeout
      }
      if (response.error) {
        finish(() => reject(new Error(response.error?.message ?? "Deriv error")));
        return;
      }
      const last = response.history?.prices?.[response.history.prices.length - 1];
      const quote = response.tick?.quote;
      const price = typeof last === "number" ? last : typeof quote === "number" ? quote : undefined;
      if (typeof price === "number") finish(() => resolve(price));
    };

    socket.onerror = () => finish(() => reject(new Error("Deriv stream error")));
    socket.onclose = () => finish(() => reject(new Error("Deriv stream closed")));
  });
}
