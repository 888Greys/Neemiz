import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerTickHistory } from "@/lib/binary-price";
import { resolveLeveraged } from "@/lib/leveraged";
import { finalizeLeveraged, type LeveragedTerminal } from "@/lib/leveraged-settle";

// Cash out an open leveraged contract. The exit is server-authoritative: we
// replay the Deriv tick path from entry up to *now*. A stop-out (Multiplier) or
// knockout (Turbo) that already happened settles as such regardless of when the
// client fired this — settlement is by tick epoch, not request time, so you can't
// out-cash a stop-out/knockout that already occurred. TP/SL/cap are honored too.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tradeId?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { tradeId } = body;
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trade = await db.leveragedTrade.findUnique({ where: { id: tradeId } });
  if (!trade)                     return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (trade.status !== "OPEN")    return Response.json({ error: "Trade already settled" }, { status: 409 });

  const closeEpoch = Math.floor(Date.now() / 1000);

  let ticks;
  try {
    ticks = await getServerTickHistory(trade.market, trade.entryEpoch, closeEpoch - trade.entryEpoch + 100);
  } catch (err) {
    console.error("leveraged/close history:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
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
    closeEpoch,
  }, ticks);

  // OPEN here means it survived to the cash-out moment — close it as a manual
  // cash-out at the live value. The terminal kinds carry their own payout/reason.
  const status: LeveragedTerminal =
    outcome.kind === "STOPPED" ? "STOPPED" : outcome.kind === "KNOCKED_OUT" ? "KNOCKED_OUT" : "CLOSED";
  const reason = outcome.kind === "OPEN" ? "cash_out" : outcome.reason;

  try {
    const result = await finalizeLeveraged(trade, {
      status,
      grossPayout: outcome.grossPayout,
      exitSpot: outcome.exitSpot,
      reason,
    });
    if (result.outcome === "already")
      return Response.json({ error: "Trade already settled" }, { status: 409 });

    return Response.json({
      status,
      terminated: result.outcome === "stopped" || result.outcome === "knocked_out",
      payout: result.creditedPayout,
      exitSpot: result.exitSpot,
      reason,
    });
  } catch (err) {
    console.error("leveraged/close error:", err);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
}
