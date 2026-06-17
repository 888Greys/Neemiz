/**
 * Cron endpoint: sweeps PENDING binary digit trades and settles them
 * server-side, independent of any browser being open.
 *
 * Why this exists: binary trades were ONLY ever settled by the client poll in
 * components/binary/binary-client.tsx. Any user who closed the tab (or lost
 * connection) after placing a trade left it PENDING forever — and once the
 * trade's settleBefore window passed, even reopening the app couldn't settle
 * it (the settle route 409s on an expired window). A winning trade was simply
 * never paid. This mirrors the MegaPay deposit sweep: remove the dependency on
 * a live browser.
 *
 * For each ready trade (now >= createdAt + durationTicks) it fetches the
 * server-authoritative exit digit from the Deriv feed and settles WON/LOST.
 * If a trade's window has fully expired AND the feed still can't be reached,
 * the stake is refunded (VOID) so an outage never costs the player money.
 *
 * VPS cron should run this every ~1 min. Auth mirrors the other cron routes:
 * Bearer CRON_SECRET.
 *
 *   ?minAgeSec=12        only touch trades older than N seconds (default 12;
 *                        gives the user's own client a chance to settle first —
 *                        though the atomic claim makes a race harmless either way)
 *   ?maxSettleAgeSec=1800 trades expired MORE than N seconds past their window
 *                        are refunded (VOID) instead of settled, rather than
 *                        resolving a long-dead contract on an arbitrary current
 *                        digit (default 1800 = 30 min). Normal cron catch-up is
 *                        seconds, so this only bites a long outage or backlog.
 *   ?limit=300           cap per run (default 300, max 1000)
 */
import { db } from "@/lib/db";
import { getServerBinaryDigit } from "@/lib/binary-price";
import { settleTradeWithDigit, voidTrade } from "@/lib/binary-settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params          = new URL(req.url).searchParams;
  const minAgeSec        = Number(params.get("minAgeSec") ?? 12);
  const maxSettleAgeSec  = Number(params.get("maxSettleAgeSec") ?? 1800);
  const limit            = Math.min(Number(params.get("limit") ?? 300), 1000);

  const now    = Date.now();
  const newest = new Date(now - minAgeSec * 1000);

  const pending = await db.binaryTrade.findMany({
    where:   { status: "PENDING", createdAt: { lte: newest } },
    orderBy: { createdAt: "asc" },
    take:    limit,
  });

  let won = 0, lost = 0, voided = 0, already = 0, notReady = 0, stillPending = 0;
  let creditedKes = 0;
  const errors: string[] = [];

  for (const trade of pending) {
    const earliestSettle = trade.createdAt.getTime() + trade.durationTicks * 1000;
    if (now < earliestSettle) { notReady++; continue; }

    const expired      = now > trade.settleBefore.getTime();
    const expiredForMs  = now - trade.settleBefore.getTime();

    // Too stale to settle on a current digit — the contract's real expiry is
    // long gone, so resolving it on whatever digit is live now would be an
    // arbitrary surprise to the user. Refund instead. Catches the historical
    // backlog and any extended cron/feed outage. (Mirrors the sports settler's
    // "auto-void bets stuck beyond the data window".)
    if (expiredForMs > maxSettleAgeSec * 1000) {
      try {
        const r = await voidTrade(trade, "stale_beyond_settle_window");
        if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); }
        else already++;
      } catch (e) {
        errors.push(`${trade.id} void(stale): ${e instanceof Error ? e.message : "error"}`);
      }
      continue;
    }

    let exitDigit: number;
    try {
      ({ digit: exitDigit } = await getServerBinaryDigit(trade.market));
    } catch (err) {
      // No live digit. If the window has fully expired the trade can never be
      // settled fairly — refund the stake. Otherwise leave it for a later run.
      if (expired) {
        try {
          const r = await voidTrade(trade, "feed_unavailable_expired");
          if (r.outcome === "refunded") { voided++; creditedKes += Number(trade.stake); }
          else already++;
        } catch (e) {
          errors.push(`${trade.id} void: ${e instanceof Error ? e.message : "error"}`);
        }
      } else {
        stillPending++;
      }
      continue;
    }

    try {
      const r = await settleTradeWithDigit(trade, exitDigit);
      if (r.outcome === "won")  { won++; creditedKes += r.winAmount; }
      else if (r.outcome === "lost") lost++;
      else already++;
    } catch (e) {
      errors.push(`${trade.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({
    ok: true,
    scanned: pending.length,
    won,
    lost,
    voided,
    already,
    notReady,
    stillPending,
    creditedKes: Number(creditedKes.toFixed(2)),
    errors,
  });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
