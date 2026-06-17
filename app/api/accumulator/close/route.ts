import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerTickHistory } from "@/lib/binary-price";
import { replayAccumulator } from "@/lib/accumulator";
import { finalizeAccumulator } from "@/lib/accumulator-settle";

// Cash out an open accumulator. The exit is server-authoritative: we replay the
// Deriv tick path from entry up to *now* and find the first barrier breach. If a
// bust already happened it busts (payout 0) regardless of when the client fired
// this — settlement is by tick epoch, not request time, so you can't out-cash a
// bust that already occurred. Take-profit / max-ticks caps are honored too.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tradeId?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { tradeId } = body;
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trade = await db.accumulatorTrade.findUnique({ where: { id: tradeId } });
  if (!trade)                     return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (trade.status !== "OPEN")    return Response.json({ error: "Trade already settled" }, { status: 409 });

  const closeEpoch = Math.floor(Date.now() / 1000);

  let ticks;
  try {
    ticks = await getServerTickHistory(trade.market, trade.entryEpoch, trade.maxTicks + 100);
  } catch (err) {
    console.error("accumulator/close history:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  const outcome = replayAccumulator({
    ticks,
    entrySpot:   Number(trade.entrySpot),
    growthRate:  trade.growthRate,
    barrierFrac: Number(trade.barrierFrac),
    maxTicks:    trade.maxTicks,
    stake:       Number(trade.stake),
    takeProfit:  trade.takeProfit == null ? null : Number(trade.takeProfit),
    closeEpoch,
  });

  // OPEN here means it survived to the cash-out moment — close it as a manual
  // cash-out at the current grown payout. BUSTED / CLOSED already carry their
  // terminal payout and reason.
  const status: "CLOSED" | "BUSTED" = outcome.kind === "BUSTED" ? "BUSTED" : "CLOSED";
  const reason = outcome.kind === "OPEN" ? "cash_out" : outcome.reason;

  try {
    const result = await finalizeAccumulator(trade, {
      status,
      grossPayout:   outcome.payout,
      ticksSurvived: outcome.ticksSurvived,
      exitSpot:      outcome.exitSpot,
      reason,
    });
    if (result.outcome === "already")
      return Response.json({ error: "Trade already settled" }, { status: 409 });

    return Response.json({
      status: result.outcome === "busted" ? "BUSTED" : "CLOSED",
      busted: result.outcome === "busted",
      payout: result.creditedPayout,
      ticksSurvived: result.ticksSurvived,
      exitSpot: result.exitSpot,
      reason,
    });
  } catch (err) {
    console.error("accumulator/close error:", err);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
}
