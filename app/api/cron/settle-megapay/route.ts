/**
 * Cron endpoint: sweeps PENDING MegaPay deposits and settles them against
 * MegaPay (the source of truth) — crediting genuinely-paid deposits and
 * failing abandoned STK pushes.
 *
 * Why this exists: the MegaPay webhook has historically never fired, so the
 * ONLY thing that settled deposits was the client-side status poll on the
 * confirmation screen. Any user who closed the app before M-Pesa confirmed
 * was left stuck PENDING forever (uncredited real money). This server-side
 * sweep removes that dependency on a browser being open.
 *
 * VPS cron should run this every ~2–5 min. Auth mirrors the other cron
 * routes: Bearer CRON_SECRET.
 *
 *   ?minAgeSec=120   only touch deposits older than N seconds (default 120,
 *                    so we don't race the user's own in-flight poll)
 *   ?maxAgeHours=72  ignore deposits older than N hours (default 72; MegaPay
 *                    won't have status for ancient requests)
 *   ?limit=200       cap per run (default 200)
 */
import { db } from "@/lib/db";
import { TransactionStatus } from "@prisma/client";
import { checkAndSettleMegapay } from "@/lib/megapay-settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params      = new URL(req.url).searchParams;
  const minAgeSec   = Number(params.get("minAgeSec")   ?? 120);
  const maxAgeHours = Number(params.get("maxAgeHours") ?? 72);
  const limit       = Math.min(Number(params.get("limit") ?? 200), 500);

  const now    = Date.now();
  const newest = new Date(now - minAgeSec   * 1000);
  const oldest = new Date(now - maxAgeHours * 3600 * 1000);

  const pending = await db.transaction.findMany({
    where: {
      type:       "DEPOSIT",
      provider:   "megapay",
      status:     TransactionStatus.PENDING,
      reference:  { not: null },
      createdAt:  { lte: newest, gte: oldest },
    },
    select: { id: true, reference: true, amount: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let completed = 0, failed = 0, stillPending = 0, skipped = 0;
  let creditedKes = 0;
  const errors: string[] = [];

  for (const txn of pending) {
    try {
      const outcome = await checkAndSettleMegapay(txn.id, txn.reference!);
      if (outcome === "completed") { completed++; creditedKes += Number(txn.amount); }
      else if (outcome === "failed")  failed++;
      else if (outcome === "skipped") skipped++;
      else stillPending++;
    } catch (e) {
      errors.push(`${txn.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({
    ok: true,
    scanned: pending.length,
    completed,
    failed,
    stillPending,
    skipped,
    creditedKes,
    errors,
  });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
