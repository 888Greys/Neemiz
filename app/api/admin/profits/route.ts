import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { nairobiMidnight, nairobiDayKey, nairobiHourKey } from "@/lib/admin/metrics";
import { cookies } from "next/headers";
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

// Returns daily aggregated P&L for the last N days
export async function GET(req: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  // Allow a single-day (today) view through to 90 days.
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10)));
  // "Today" is plotted hour-by-hour so the graph isn't a single point.
  const hourly = days === 1;

  // Nairobi midnight (today for hourly, N-1 days back otherwise) so buckets line
  // up with the Kenya calendar regardless of the server's own timezone.
  const since = hourly ? nairobiMidnight(0) : nairobiMidnight(days - 1);

  // Keep suspended exploiters + owner test accounts out of the real-money P&L
  // so every window (24H/7D/30D) reflects genuine players only.
  const excludedIds = await getExcludedUserIds();
  const notExcluded = excludedIds.length ? { userId: { notIn: excludedIds } } : {};

  const [fiatDeposits, cryptoDeposits, fiatWithdrawals, cryptoWithdrawals, betStakes, betWins, fees, p2pFees] = await Promise.all([
    // Fiat KES rails (Lipa Haraka primary) + on-chain crypto (valued to KES below).
    db.transaction.findMany({
      where: {
        type: "DEPOSIT",
        status: "COMPLETED",
        currency: "KES",
        provider: { in: [...ADMIN_FIAT_DEPOSIT_PROVIDERS] },
        createdAt: { gte: since },
        ...notExcluded,
      },
      select: { createdAt: true, amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: {
        type: "DEPOSIT",
        status: "COMPLETED",
        provider: { in: [...ADMIN_CRYPTO_DEPOSIT_PROVIDERS] },
        createdAt: { gte: since },
        ...notExcluded,
      },
      select: { createdAt: true, amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: {
        type: "WITHDRAWAL",
        status: "COMPLETED",
        currency: "KES",
        provider: { in: [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS] },
        createdAt: { gte: since },
        ...notExcluded,
      },
      select: { createdAt: true, amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: {
        type: "WITHDRAWAL",
        status: "COMPLETED",
        provider: { in: [...ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS] },
        createdAt: { gte: since },
        ...notExcluded,
      },
      select: { createdAt: true, amount: true, currency: true },
    }),
    // Bet stakes
    db.transaction.groupBy({
      by: ["createdAt"],
      where: { type: "BET_STAKE", status: "COMPLETED", createdAt: { gte: since }, ...notExcluded },
      _sum: { amount: true },
      _count: true,
    }),
    // Bet wins paid out
    db.transaction.groupBy({
      by: ["createdAt"],
      where: { type: "BET_WIN", status: "COMPLETED", createdAt: { gte: since }, ...notExcluded },
      _sum: { amount: true },
      _count: true,
    }),
    // Fees are earned only when a fiat KES provider payout completes (5%).
    db.transaction.aggregate({
      where: {
        type: "WITHDRAWAL",
        status: "COMPLETED",
        currency: "KES",
        provider: { in: [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS] },
        createdAt: { gte: since },
        ...notExcluded,
      },
      _sum: { amount: true },
    }),
    // P2P fees are held in crypto. Their KES value is stamped into metadata
    // when the trade releases, using the executed order price.
    db.transaction.findMany({
      where: {
        provider: "p2p_fee",
        status: "COMPLETED",
        createdAt: { gte: since },
        ...notExcluded,
      },
      select: { createdAt: true, metadata: true },
    }),
  ]);

  const deposits = [...fiatDeposits, ...cryptoDeposits];
  const withdrawals = [...fiatWithdrawals, ...cryptoWithdrawals];
  const moneyRates = await buildKesRateTable(deposits.concat(withdrawals).map((t) => t.currency));

  // Build a map of date → aggregated values
  type DayData = {
    date: string;
    deposits: number;
    withdrawals: number;
    fiatWithdrawals: number;
    betStakes: number;
    betWins: number;
    p2pFees: number;
    grossProfit: number;
  };

  const dayMap: Record<string, DayData> = {};

  const key = (d: Date) => (hourly ? nairobiHourKey(d) : nairobiDayKey(d));

  // Seed every bucket in the range (24 Nairobi hours for today, else one per day).
  const buckets = hourly ? 24 : days;
  const step = hourly ? 3_600_000 : 86_400_000;
  for (let i = 0; i < buckets; i++) {
    const k = key(new Date(since.getTime() + i * step));
    dayMap[k] = { date: k, deposits: 0, withdrawals: 0, fiatWithdrawals: 0, betStakes: 0, betWins: 0, p2pFees: 0, grossProfit: 0 };
  }

  for (const r of deposits)    { const k = key(r.createdAt); if (dayMap[k]) dayMap[k].deposits    += kesAmount(r.amount, r.currency, moneyRates); }
  for (const r of withdrawals) { const k = key(r.createdAt); if (dayMap[k]) dayMap[k].withdrawals += kesAmount(r.amount, r.currency, moneyRates); }
  for (const r of fiatWithdrawals) { const k = key(r.createdAt); if (dayMap[k]) dayMap[k].fiatWithdrawals += Number(r.amount) || 0; }
  for (const r of betStakes)   { const k = key(r.createdAt); if (dayMap[k]) dayMap[k].betStakes   += Number(r._sum.amount ?? 0); }
  for (const r of betWins)     { const k = key(r.createdAt); if (dayMap[k]) dayMap[k].betWins     += Number(r._sum.amount ?? 0); }
  for (const r of p2pFees) {
    const metadata = r.metadata as { feeKesAmount?: unknown } | null;
    const feeKesAmount = Number(metadata?.feeKesAmount);
    const k = key(r.createdAt);
    if (dayMap[k] && Number.isFinite(feeKesAmount) && feeKesAmount >= 0) dayMap[k].p2pFees += feeKesAmount;
  }

  const days_data = Object.values(dayMap).map((d) => ({
    date: d.date,
    deposits: d.deposits,
    withdrawals: d.withdrawals,
    betStakes: d.betStakes,
    betWins: d.betWins,
    p2pFees: d.p2pFees,
    // House profit = bet stakes - bet wins paid + fiat withdrawal fees + P2P fees.
    grossProfit: parseFloat((d.betStakes - d.betWins + d.fiatWithdrawals * 0.05 + d.p2pFees).toFixed(2)),
  }));

  // Totals for the period
  const totalDeposits     = days_data.reduce((s, d) => s + d.deposits, 0);
  const totalWithdrawals  = days_data.reduce((s, d) => s + d.withdrawals, 0);
  const totalBetStakes    = days_data.reduce((s, d) => s + d.betStakes, 0);
  const totalBetWins      = days_data.reduce((s, d) => s + d.betWins, 0);
  const totalP2PFees      = days_data.reduce((s, d) => s + d.p2pFees, 0);
  const totalFeesCollected = parseFloat((Number(fees._sum.amount ?? 0) * 0.05 + totalP2PFees).toFixed(2));
  const totalGrossProfit  = parseFloat((totalBetStakes - totalBetWins + totalFeesCollected).toFixed(2));

  return Response.json({
    granularity: hourly ? "hour" : "day",
    days: days_data,
    totals: {
      deposits:     parseFloat(totalDeposits.toFixed(2)),
      withdrawals:  parseFloat(totalWithdrawals.toFixed(2)),
      betStakes:    parseFloat(totalBetStakes.toFixed(2)),
      betWins:      parseFloat(totalBetWins.toFixed(2)),
      p2pFees:      parseFloat(totalP2PFees.toFixed(2)),
      feesCollected: totalFeesCollected,
      grossProfit:  totalGrossProfit,
    },
  }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
