/**
 * Cron endpoint: sweeps OPEN leveraged contracts (Multipliers, Turbos) and
 * settles terminal events server-side, independent of any open browser.
 *
 * For each contract it replays the Deriv tick path from entry to now:
 *   - stop-out (Multiplier) -> STOPPED (payout 0)
 *   - knockout (Turbo)      -> KNOCKED_OUT (payout 0)
 *   - take-profit / stop-loss / profit cap reached -> CLOSED at that payout
 *   - still alive, no terminal event -> left OPEN (only the user cashes out a
 *     healthy live contract; the profit cap guarantees it eventually resolves)
 *   - old + cannot be resolved (feed gap/outage) -> VOID refund, so an outage
 *     never strands a player's stake.
 *
 * VPS cron should run this every ~1 min. Auth: Bearer CRON_SECRET.
 *
 *   ?minAgeSec=3     skip contracts younger than N seconds (default 3)
 *   ?maxAgeSec=86400 OPEN contracts older than N seconds that still can't be
 *                    resolved are refunded (default 86400 = 24h)
 *   ?limit=300       cap per run (default 300, max 1000)
 */
import { db } from "@/lib/db";
import { getServerTickHistory } from "@/lib/binary-price";
import { resolveLeveraged } from "@/lib/leveraged";
import { finalizeLeveraged, voidLeveraged, type LeveragedTerminal } from "@/lib/leveraged-settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params    = new URL(req.url).searchParams;
  const minAgeSec = Number(params.get("minAgeSec") ?? 3);
  const maxAgeSec = Number(params.get("maxAgeSec") ?? 86_400);
  const limit     = Math.min(Number(params.get("limit") ?? 300), 1000);

  const now    = Date.now();
  const nowSec = Math.floor(now / 1000);
  const newest = new Date(now - minAgeSec * 1000);

  const open = await db.leveragedTrade.findMany({
    where:   { status: "OPEN", createdAt: { lte: newest } },
    orderBy: { createdAt: "asc" },
    take:    limit,
  });

  let closed = 0, stopped = 0, knockedOut = 0, voided = 0, stillOpen = 0, already = 0;
  let creditedKes = 0;
  const errors: string[] = [];

  for (const trade of open) {
    const ageSec = nowSec - trade.entryEpoch;

    let ticks;
    try {
      ticks = await getServerTickHistory(trade.market, trade.entryEpoch, ageSec + 100);
    } catch {
      if (ageSec > maxAgeSec) {
        try {
          const r = await voidLeveraged(trade, "feed_unavailable_stale");
          if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); } else already++;
        } catch (ve) { errors.push(`${trade.id} void: ${ve instanceof Error ? ve.message : "error"}`); }
      } else {
        stillOpen++;
      }
      continue;
    }

    const outcome = resolveLeveraged({
      kind: trade.kind,
      direction: trade.direction as "UP" | "DOWN",
      entrySpot: Number(trade.entrySpot),
      stake: Number(trade.stake),
      multiplier: trade.multiplier,
      barrier: trade.barrier == null ? null : Number(trade.barrier),
      payoutPerPoint: trade.payoutPerPoint == null ? null : Number(trade.payoutPerPoint),
      takeProfit: trade.takeProfit == null ? null : Number(trade.takeProfit),
      stopLoss: trade.stopLoss == null ? null : Number(trade.stopLoss),
      closeEpoch: nowSec,
    }, ticks);

    try {
      if (outcome.kind === "OPEN") {
        if (ageSec > maxAgeSec) {
          const r = await voidLeveraged(trade, "stale_unterminated");
          if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); } else already++;
        } else {
          stillOpen++;
        }
        continue;
      }

      const status: LeveragedTerminal =
        outcome.kind === "STOPPED" ? "STOPPED" : outcome.kind === "KNOCKED_OUT" ? "KNOCKED_OUT" : "CLOSED";
      const r = await finalizeLeveraged(trade, {
        status, grossPayout: outcome.grossPayout, exitSpot: outcome.exitSpot, reason: outcome.reason,
      });
      if (r.outcome === "already") { already++; }
      else if (r.outcome === "closed") { closed++; creditedKes += r.creditedPayout; }
      else if (r.outcome === "stopped") { stopped++; }
      else if (r.outcome === "knocked_out") { knockedOut++; }
    } catch (e) {
      errors.push(`${trade.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({
    ok: true,
    scanned: open.length,
    closed, stopped, knockedOut, voided, stillOpen, already,
    creditedKes: Number(creditedKes.toFixed(2)),
    errors,
  });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
