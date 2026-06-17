import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { getServerTickHistory } from "@/lib/binary-price";
import { resolveContract, type DirectionalSide } from "@/lib/directional";
import { finalizeDirectional } from "@/lib/directional-settle";

// Settle a directional contract on its exit tick — the durationTicks-th tick
// after entry, fetched server-side from the Deriv feed. The client's value is
// never trusted. If the exit tick isn't available yet, the trade stays PENDING.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tradeId?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { tradeId } = body;
  if (!tradeId) return Response.json({ error: "Missing tradeId" }, { status: 400 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const trade = await db.directionalTrade.findUnique({ where: { id: tradeId } });
  if (!trade)                     return Response.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== dbUser.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (trade.status !== "PENDING") return Response.json({ error: "Trade already settled" }, { status: 409 });

  if (Date.now() > trade.settleBefore.getTime())
    return Response.json({ error: "Settlement window expired" }, { status: 409 });

  let ticks;
  try {
    ticks = await getServerTickHistory(trade.market, trade.entryEpoch, trade.durationTicks + 20);
  } catch (err) {
    console.error("directional/settle history:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  const resolution = resolveContract({
    kind: trade.kind,
    side: trade.side as DirectionalSide,
    entrySpot: Number(trade.entrySpot),
    barrier: trade.barrier == null ? null : Number(trade.barrier),
    durationTicks: trade.durationTicks,
    stake: Number(trade.stake),
    payout: Number(trade.payout),
    payoutPerPoint: trade.payoutPerPoint == null ? null : Number(trade.payoutPerPoint),
  }, ticks);

  // Outcome not determined yet (exit tick / full window not reached) → keep waiting.
  if (!resolution.ready) return Response.json({ error: "Not ready", pending: true }, { status: 409 });

  try {
    const result = await finalizeDirectional(trade, { won: resolution.won, credit: resolution.credit, exitSpot: resolution.exitSpot });
    if (result.outcome === "already")
      return Response.json({ error: "Trade already settled" }, { status: 409 });
    const won = result.outcome === "won";
    return Response.json({ won, winAmount: result.winAmount, exitSpot: result.exitSpot, status: won ? "WON" : "LOST" });
  } catch (err) {
    console.error("directional/settle error:", err);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
}
