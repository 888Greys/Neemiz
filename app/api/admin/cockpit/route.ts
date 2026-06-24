import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { getMarketScorecards, rangeWindow } from "@/lib/admin/metrics";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";

const REAL_DEPOSIT_PROVIDERS = ["megapay", "lipaharaka"];
const REAL_WITHDRAWAL_PROVIDERS = ["relworx", "megapay", "lipaharaka"];

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return true;
}

// Owner Cockpit feed (Phase 1). One call powers the landing screen: money +
// growth top line, the 6 independent market scorecards, and the alerts queue.
export async function GET(req: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const window = rangeWindow(searchParams.get("range")); // windowed P&L; references below stay live
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const excludedIds = await getExcludedUserIds();
  const notExcluded = excludedIds.length ? { userId: { notIn: excludedIds } } : {};

  const [
    markets,
    depositsToday,
    withdrawalsToday,
    walletLiability,
    signupsToday,
    signups7d,
    peakRows,
    pendingWithdrawals,
    openDisputes,
    pendingKyc,
    pendingDeposits,
    unsettledSports,
  ] = await Promise.all([
    getMarketScorecards({ window, country: "KE" }),
    db.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: REAL_DEPOSIT_PROVIDERS }, createdAt: { gte: window.start, lt: window.end }, ...notExcluded },
      _sum: { amount: true }, _count: true,
    }),
    db.transaction.aggregate({
      where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: REAL_WITHDRAWAL_PROVIDERS }, createdAt: { gte: window.start, lt: window.end }, ...notExcluded },
      _sum: { amount: true },
    }),
    // What the house owes genuine players right now.
    db.user.aggregate({
      where: excludedIds.length ? { id: { notIn: excludedIds } } : {},
      _sum: { walletBalance: true }, _count: true,
    }),
    db.user.count({ where: { createdAt: { gte: window.start, lt: window.end } } }),
    db.user.count({ where: { createdAt: { gte: week } } }),
    // Busiest single signup day in the last 30 days (the "peak" reference).
    db.$queryRaw<Array<{ peak: bigint }>>`
      SELECT COALESCE(MAX(c), 0) AS peak FROM (
        SELECT COUNT(*) AS c FROM users
        WHERE created_at >= now() - interval '30 days'
        GROUP BY date_trunc('day', created_at)
      ) t`,
    db.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus } }),
    db.p2PDispute.count({ where: { status: "OPEN" } }),
    db.merchantProfile.count({ where: { kycStatus: "PENDING" } }),
    db.p2PCryptoDeposit.count({ where: { status: "PENDING" } }),
    // Settlement health: sports bets stuck PENDING past 24h (the known
    // getFixtureDetail stateId-5 bug). Surfaced so the owner sees it bite.
    db.bet.count({ where: { status: "PENDING", createdAt: { lt: dayAgo } } }),
  ]);

  const ggrToday = markets.reduce((s, m) => s + m.ggr, 0);
  const deposits = Number(depositsToday._sum.amount ?? 0);
  const withdrawals = Number(withdrawalsToday._sum.amount ?? 0);
  const peak30d = Number(peakRows[0]?.peak ?? 0);

  return Response.json({
    asOf: new Date().toISOString(),
    money: {
      netDepositsToday: deposits - withdrawals,
      depositsToday: deposits,
      depositsCount: depositsToday._count,
      withdrawalsToday: withdrawals,
      ggrToday,
      walletLiability: Number(walletLiability._sum.walletBalance ?? 0),
      playerCount: walletLiability._count,
    },
    growth: {
      signupsToday,
      avg7d: Math.round(signups7d / 7),
      peak30d,
    },
    markets,
    alerts: {
      pendingWithdrawals,
      openDisputes,
      pendingKyc,
      pendingDeposits,
      unsettledSports,
    },
  }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
