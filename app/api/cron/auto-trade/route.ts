/**
 * Cron endpoint: steps every RUNNING binary auto-trader session once.
 *
 * For each session it places the next trade (or the first), waits while the
 * current trade is still settling, and on a settled trade books the P&L, sizes
 * the next stake per strategy, and stops on Take-Profit / Stop-Loss / max-runs.
 * Trades themselves are settled by /api/cron/settle-binary (they're ordinary
 * PENDING BinaryTrades), so this route never decides win/loss.
 *
 * Auth mirrors the other cron routes: Bearer CRON_SECRET. Because tick
 * contracts are short, run this OFTEN (staging uses a ~10s timer) — but it is
 * idempotent: a session whose trade is still in-flight is simply skipped.
 *
 *   ?limit=200   max sessions to step per run (default 200)
 */
import { stepAllSessions } from "@/lib/auto-trade-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 200), 500);

  const outcomes = await stepAllSessions(limit);
  const summary = outcomes.reduce(
    (acc, o) => { acc[o.action] = (acc[o.action] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return Response.json({ ok: true, stepped: outcomes.length, summary });
}
