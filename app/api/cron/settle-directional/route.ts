/**
 * Cron endpoint: sweeps PENDING directional contracts (Rise/Fall, Higher/Lower)
 * and settles them server-side, independent of any open browser.
 *
 * For each ready contract it fetches the exit tick (the durationTicks-th tick
 * after entry) and settles WON/LOST. A contract past its settleBefore window
 * whose exit tick still can't be obtained (feed gap/outage) is refunded (VOID),
 * so an outage never costs the player their stake. Mirrors settle-binary.
 *
 * VPS cron should run this every ~1 min. Auth: Bearer CRON_SECRET.
 *
 *   ?minAgeSec=5   skip contracts younger than N seconds (default 5)
 *   ?limit=300     cap per run (default 300, max 1000)
 */
import { db } from "@/lib/db";
import { getServerTickHistory } from "@/lib/binary-price";
import { settleDirectionalWithExit, voidDirectional } from "@/lib/directional-settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params    = new URL(req.url).searchParams;
  const minAgeSec = Number(params.get("minAgeSec") ?? 5);
  const limit     = Math.min(Number(params.get("limit") ?? 300), 1000);

  const now    = Date.now();
  const newest = new Date(now - minAgeSec * 1000);

  const pending = await db.directionalTrade.findMany({
    where:   { status: "PENDING", createdAt: { lte: newest } },
    orderBy: { createdAt: "asc" },
    take:    limit,
  });

  let won = 0, lost = 0, voided = 0, already = 0, stillPending = 0;
  let creditedKes = 0;
  const errors: string[] = [];

  for (const trade of pending) {
    const expired = now > trade.settleBefore.getTime();

    let ticks;
    try {
      ticks = await getServerTickHistory(trade.market, trade.entryEpoch, trade.durationTicks + 20);
    } catch {
      if (expired) {
        try {
          const r = await voidDirectional(trade, "feed_unavailable_expired");
          if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); } else already++;
        } catch (e) { errors.push(`${trade.id} void: ${e instanceof Error ? e.message : "error"}`); }
      } else stillPending++;
      continue;
    }

    const exit = ticks[trade.durationTicks - 1];
    if (!exit) {
      // Exit tick not available. If the window expired, the feed has a gap we
      // can't settle around — refund. Otherwise wait for a later run.
      if (expired) {
        try {
          const r = await voidDirectional(trade, "exit_tick_missing_expired");
          if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); } else already++;
        } catch (e) { errors.push(`${trade.id} void: ${e instanceof Error ? e.message : "error"}`); }
      } else stillPending++;
      continue;
    }

    try {
      const r = await settleDirectionalWithExit(trade, exit.price);
      if (r.outcome === "won")  { won++; creditedKes += r.winAmount; }
      else if (r.outcome === "lost") lost++;
      else already++;
    } catch (e) {
      errors.push(`${trade.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({
    ok: true, scanned: pending.length, won, lost, voided, already, stillPending,
    creditedKes: Number(creditedKes.toFixed(2)), errors,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
