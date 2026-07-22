/**
 * Internal Deriv relay — sister binary containers route through Nezeem's
 * single in-process Deriv feed instead of opening their own WebSocket.
 * Callers must provide a shared INTERNAL_RELAY_SECRET.
 */
import { startDerivFeed, getLatestTick, getTicksSince, isDerivFeedServing } from "@/lib/deriv-feed";
import { DerivClient } from "neemiz-binary-engine";

const derivClient = new DerivClient({ wsTimeoutMs: 6000 });

const VALID_SYMBOLS = new Set(["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"]);

export async function GET(request: Request) {
  const secret = request.headers.get("x-relay-secret");
  if (!secret || secret !== (process.env.INTERNAL_RELAY_SECRET ?? "")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  startDerivFeed();

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  if (!VALID_SYMBOLS.has(symbol)) {
    return Response.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const action = url.searchParams.get("action") ?? "tick";

  if (action === "tick") {
    const live = getLatestTick(symbol);
    if (!live) return Response.json({ error: "No live tick" }, { status: 503 });
    return Response.json({ price: live.price, epoch: live.epoch });
  }

  if (action === "history") {
    const startEpoch = Number(url.searchParams.get("startEpoch") ?? "0");
    const count = Math.min(Number(url.searchParams.get("count") ?? "100"), 5000);
    if (!startEpoch || startEpoch < 0) {
      return Response.json({ error: "Invalid startEpoch" }, { status: 400 });
    }

    if (isDerivFeedServing(symbol)) {
      const fromFeed = getTicksSince(symbol, startEpoch);
      if (fromFeed && fromFeed.length > 0) {
        const result = fromFeed.length > count ? fromFeed.slice(-count) : fromFeed;
        return Response.json(result);
      }
    }

    try {
      const hist = await derivClient.fetchTickHistory(symbol, startEpoch, count);
      return Response.json(hist.filter((t) => Number.isFinite(t.price) && t.price > 0));
    } catch {
      return Response.json({ error: "History unavailable" }, { status: 503 });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
