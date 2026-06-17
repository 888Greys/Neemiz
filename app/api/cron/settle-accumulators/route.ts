/**
 * Cron endpoint: sweeps OPEN accumulator contracts and settles them
 * server-side, independent of any open browser.
 *
 * For each contract it replays the Deriv tick path from entry to now:
 *   - barrier breached  -> BUSTED (payout 0)
 *   - take-profit / max-ticks cap reached -> CLOSED at that payout
 *   - still alive, not yet terminal -> left OPEN (it will hit the cap within
 *     maxTicks seconds and resolve on a later run; the per-rate cap guarantees
 *     no contract grows forever)
 *   - old + cannot be resolved (feed gap/outage) -> VOID refund, so an outage
 *     never strands a player's stake.
 *
 * The cron never "cashes out" a healthy live contract early — only the user does
 * that. It only finalizes terminal events that already happened in the ticks.
 *
 * VPS cron should run this every ~1 min. Auth: Bearer CRON_SECRET.
 *
 *   ?minAgeSec=3     skip contracts younger than N seconds (default 3)
 *   ?maxAgeSec=3600  OPEN contracts older than N seconds that still can't be
 *                    resolved are refunded (default 3600 = 1h)
 *   ?limit=300       cap per run (default 300, max 1000)
 */
import { db } from "@/lib/db";
import { getServerTickHistory } from "@/lib/binary-price";
import { replayAccumulator } from "@/lib/accumulator";
import { finalizeAccumulator, voidAccumulator } from "@/lib/accumulator-settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params    = new URL(req.url).searchParams;
  const minAgeSec = Number(params.get("minAgeSec") ?? 3);
  const maxAgeSec = Number(params.get("maxAgeSec") ?? 3600);
  const limit     = Math.min(Number(params.get("limit") ?? 300), 1000);

  const now    = Date.now();
  const nowSec = Math.floor(now / 1000);
  const newest = new Date(now - minAgeSec * 1000);

  const open = await db.accumulatorTrade.findMany({
    where:   { status: "OPEN", createdAt: { lte: newest } },
    orderBy: { createdAt: "asc" },
    take:    limit,
  });

  let closed = 0, busted = 0, voided = 0, stillOpen = 0, already = 0;
  let creditedKes = 0;
  const errors: string[] = [];

  for (const trade of open) {
    const ageSec = nowSec - trade.entryEpoch;

    let ticks;
    try {
      ticks = await getServerTickHistory(trade.market, trade.entryEpoch, trade.maxTicks + 100);
    } catch (e) {
      if (ageSec > maxAgeSec) {
        try {
          const r = await voidAccumulator(trade, "feed_unavailable_stale");
          if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); } else already++;
        } catch (ve) { errors.push(`${trade.id} void: ${ve instanceof Error ? ve.message : "error"}`); }
      } else {
        stillOpen++;
      }
      continue;
    }

    const outcome = replayAccumulator({
      ticks,
      entrySpot:   Number(trade.entrySpot),
      growthRate:  trade.growthRate,
      barrierFrac: Number(trade.barrierFrac),
      maxTicks:    trade.maxTicks,
      stake:       Number(trade.stake),
      takeProfit:  trade.takeProfit == null ? null : Number(trade.takeProfit),
      closeEpoch:  nowSec,
    });

    try {
      if (outcome.kind === "BUSTED") {
        const r = await finalizeAccumulator(trade, { status: "BUSTED", grossPayout: 0, ticksSurvived: outcome.ticksSurvived, exitSpot: outcome.exitSpot, reason: "breach" });
        if (r.outcome === "busted") busted++; else if (r.outcome === "already") already++;
      } else if (outcome.kind === "CLOSED") {
        const r = await finalizeAccumulator(trade, { status: "CLOSED", grossPayout: outcome.payout, ticksSurvived: outcome.ticksSurvived, exitSpot: outcome.exitSpot, reason: outcome.reason });
        if (r.outcome === "closed") { closed++; creditedKes += r.creditedPayout; } else if (r.outcome === "already") already++;
      } else if (ageSec > maxAgeSec) {
        // Still alive but too old to ever resolve cleanly (feed gap) — refund.
        const r = await voidAccumulator(trade, "stale_unterminated");
        if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); } else already++;
      } else {
        stillOpen++;
      }
    } catch (e) {
      errors.push(`${trade.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({
    ok: true,
    scanned: open.length,
    closed,
    busted,
    voided,
    stillOpen,
    already,
    creditedKes: Number(creditedKes.toFixed(2)),
    errors,
  });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
