// Server-side forex price source.
//
// SECURITY: forex open/close must NEVER trust a client-supplied price. The
// browser streams Deriv ticks for charting, but settlement prices have to be
// fetched here, server-side, from the same Deriv feed. If we can't get a live
// price we reject the trade rather than fall back to a guessable value — a
// known fallback price is exactly what was being exploited to mint winnings.

import { getLatestTick, startDerivFeed } from "@/lib/deriv-feed";

const DERIV_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

// Mirror of the MARKETS table in components/forex/forex-client.tsx.
const SYMBOL_MAP: Record<string, { derivSymbol: string; precision: number }> = {
  "EUR/USD": { derivSymbol: "frxEURUSD", precision: 5 },
  "GBP/USD": { derivSymbol: "frxGBPUSD", precision: 5 },
  "USD/JPY": { derivSymbol: "frxUSDJPY", precision: 3 },
  "USD/CHF": { derivSymbol: "frxUSDCHF", precision: 5 },
  "AUD/USD": { derivSymbol: "frxAUDUSD", precision: 5 },
  "USD/CAD": { derivSymbol: "frxUSDCAD", precision: 5 },
  "NZD/USD": { derivSymbol: "frxNZDUSD", precision: 5 },
  "EUR/GBP": { derivSymbol: "frxEURGBP", precision: 5 },
};

export function isKnownForexSymbol(symbol: string): boolean {
  return symbol in SYMBOL_MAP;
}

export function forexPrecision(symbol: string): number {
  return SYMBOL_MAP[symbol]?.precision ?? 5;
}

type CacheEntry = { price: number; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3000; // ticks every ~1-2s; 3s cache keeps it fresh & cheap
const WS_TIMEOUT_MS = 6000;

/**
 * Fetch the latest live mid price for a forex symbol from Deriv, server-side.
 * Prefers the shared in-process tick feed; falls back to a one-shot WS fetch.
 * Throws if the symbol is unknown or no live price can be obtained.
 */
export async function getServerForexPrice(symbol: string): Promise<number> {
  const market = SYMBOL_MAP[symbol];
  if (!market) throw new Error(`Unsupported forex symbol: ${symbol}`);

  startDerivFeed();
  const fromFeed = getLatestTick(market.derivSymbol);
  if (fromFeed) {
    cache.set(symbol, { price: fromFeed.price, at: Date.now() });
    return fromFeed.price;
  }

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.price;

  const price = await fetchDerivTick(market.derivSymbol);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid live price for ${symbol}`);
  }
  cache.set(symbol, { price, at: Date.now() });
  return price;
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
      () => finish(() => reject(new Error("Deriv price timeout"))),
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
