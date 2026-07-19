/**
 * Cron: process PENDING binary copy-trading signals (leader → follower mirrors).
 *
 * Auth: Bearer CRON_SECRET. Run often (every few seconds) alongside auto-trade;
 * idempotent — PROCESSING/DONE signals are skipped.
 *
 *   ?limit=50   max signals per run (default 50)
 */
import { processPendingCopySignals } from "@/lib/copy-trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50), 200);
  const result = await processPendingCopySignals(limit);
  return Response.json({ ok: true, ...result });
}
