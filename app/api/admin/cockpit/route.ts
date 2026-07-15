import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { getMarketScorecards, rangeWindow, nairobiHourKey, nairobiDayKey, EAT_OFFSET_MS } from "@/lib/admin/metrics";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";
import {
  ADMIN_CRYPTO_DEPOSIT_PROVIDERS,
  ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS,
  ADMIN_FIAT_DEPOSIT_PROVIDERS,
  ADMIN_FIAT_WITHDRAWAL_PROVIDERS,
  buildKesRateTable,
  kesAmount,
} from "@/lib/admin/real-money";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isOwnerEmail(user.email)) return null;
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
  const rangeFilter = { createdAt: { gte: window.start, lt: window.end }, ...notExcluded };

  const [
    markets,
    fiatDeposits,
    cryptoDeposits,
    fiatWithdrawals,
    cryptoWithdrawals,
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
    db.transaction.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: [...ADMIN_FIAT_DEPOSIT_PROVIDERS] }, ...rangeFilter },
      select: { amount: true, currency: true, createdAt: true, type: true },
    }),
    db.transaction.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED", provider: { in: [...ADMIN_CRYPTO_DEPOSIT_PROVIDERS] }, ...rangeFilter },
      select: { amount: true, currency: true, createdAt: true, type: true },
    }),
    db.transaction.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS] }, ...rangeFilter },
      select: { amount: true, currency: true, createdAt: true, type: true },
    }),
    db.transaction.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED", provider: { in: [...ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS] }, ...rangeFilter },
      select: { amount: true, currency: true, createdAt: true, type: true },
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

  const flowRows = [...fiatDeposits, ...cryptoDeposits, ...fiatWithdrawals, ...cryptoWithdrawals];
  const rates = await buildKesRateTable(flowRows.map((r) => r.currency));

  // Trend series: hourly buckets for a single Nairobi day (≤ ~25h window, i.e.
  // "Today" or a picked day) so the owner sees the 12am→12am shape; daily
  // buckets for longer ranges. Always seeded so the axis has no gaps.
  const spanMs = window.end.getTime() - window.start.getTime();
  const hourly = spanMs <= 25 * 60 * 60 * 1000;
  const seriesMap: Record<string, { t: string; deposits: number; withdrawals: number; net: number }> = {};
  if (hourly) {
    // 24 fixed hours from the window's Nairobi midnight.
    const eat = new Date(window.start.getTime() + EAT_OFFSET_MS);
    eat.setUTCHours(0, 0, 0, 0);
    const base = eat.getTime() - EAT_OFFSET_MS;
    for (let h = 0; h < 24; h++) {
      const k = nairobiHourKey(new Date(base + h * 3_600_000));
      seriesMap[k] = { t: k, deposits: 0, withdrawals: 0, net: 0 };
    }
  } else {
    const dayCount = Math.min(92, Math.max(1, Math.ceil(spanMs / 86_400_000)));
    const eat = new Date(window.start.getTime() + EAT_OFFSET_MS);
    eat.setUTCHours(0, 0, 0, 0);
    const base = eat.getTime() - EAT_OFFSET_MS;
    for (let i = 0; i < dayCount; i++) {
      const k = nairobiDayKey(new Date(base + i * 86_400_000));
      seriesMap[k] = { t: k, deposits: 0, withdrawals: 0, net: 0 };
    }
  }

  let deposits = 0;
  let withdrawals = 0;
  let depositsCount = 0;
  for (const r of flowRows) {
    const amt = kesAmount(r.amount, r.currency, rates);
    const k = hourly ? nairobiHourKey(r.createdAt) : nairobiDayKey(r.createdAt);
    const b = seriesMap[k];
    if (r.type === "DEPOSIT") {
      deposits += amt;
      depositsCount += 1;
      if (b) { b.deposits += amt; b.net += amt; }
    } else {
      withdrawals += amt;
      if (b) { b.withdrawals += amt; b.net -= amt; }
    }
  }
  const series = Object.values(seriesMap);

  const ggrToday = markets.reduce((s, m) => s + m.ggr, 0);
  const peak30d = Number(peakRows[0]?.peak ?? 0);
  const round = (n: number) => Math.round(n * 100) / 100;

  return Response.json({
    asOf: new Date().toISOString(),
    money: {
      netDepositsToday: round(deposits - withdrawals),
      depositsToday: round(deposits),
      depositsCount,
      withdrawalsToday: round(withdrawals),
      ggrToday,
      walletLiability: Number(walletLiability._sum.walletBalance ?? 0),
      playerCount: walletLiability._count,
    },
    growth: {
      signupsToday,
      avg7d: Math.round(signups7d / 7),
      peak30d,
    },
    series: { granularity: hourly ? "hour" : "day", points: series },
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
