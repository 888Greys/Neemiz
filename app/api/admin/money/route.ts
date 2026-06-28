import { db } from "@/lib/db";
import { requireOwnerAdmin } from "@/lib/admin-guard";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import { rangeWindow, nairobiDayKey, EAT_OFFSET_MS } from "@/lib/admin/metrics";
import { TransactionStatus } from "@prisma/client";

const REAL_DEPOSIT_PROVIDERS = ["megapay", "lipaharaka"];
const REAL_WITHDRAWAL_PROVIDERS = ["relworx", "megapay", "lipaharaka"];
const WITHDRAWAL_FEE_RATE = 0.05;

const dayKey = nairobiDayKey;

// Money screen feed (Phase 3). Cashflow consolidation: deposits vs withdrawals
// with a daily series, provider breakdown, fee revenue, ledger GGR, the
// real-vs-test float split, and the pending-payout queue. Real-money only
// (genuine providers, excluded test/suspended accounts).
export async function GET(req: Request) {
  if (!await requireOwnerAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const window = rangeWindow(searchParams.get("range"));
  const since = window.start;                      // totals/breakdown cover the full window
  const spanDays = Math.max(1, Math.ceil((window.end.getTime() - since.getTime()) / 86_400_000));
  const chartDays = Math.min(spanDays, 92);        // cap the daily series so long ranges don't explode
  // Anchor the series on Nairobi midnights so each bucket is a local day.
  const chartEndEat = new Date((window.end.getTime() - 1) + EAT_OFFSET_MS);
  chartEndEat.setUTCHours(0, 0, 0, 0);
  const chartStart = new Date(chartEndEat.getTime() - EAT_OFFSET_MS - (chartDays - 1) * 86_400_000);

  const excludedIds = await getExcludedUserIds();
  const notExcluded = excludedIds.length ? { userId: { notIn: excludedIds } } : {};

  const [depositTx, withdrawalTx, p2pFeeTx, betStakes, betWins, pending, realFloat, testFloat] = await Promise.all([
    db.transaction.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: REAL_DEPOSIT_PROVIDERS }, createdAt: { gte: since, lt: window.end }, ...notExcluded },
      select: { createdAt: true, amount: true, provider: true },
    }),
    db.transaction.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: REAL_WITHDRAWAL_PROVIDERS }, createdAt: { gte: since, lt: window.end }, ...notExcluded },
      select: { createdAt: true, amount: true, provider: true },
    }),
    db.transaction.findMany({
      where: { provider: "p2p_fee", status: "COMPLETED", createdAt: { gte: since, lt: window.end }, ...notExcluded },
      select: { metadata: true },
    }),
    db.transaction.aggregate({ where: { type: "BET_STAKE", status: "COMPLETED", createdAt: { gte: since, lt: window.end }, ...notExcluded }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { type: "BET_WIN", status: "COMPLETED", createdAt: { gte: since, lt: window.end }, ...notExcluded }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus }, _sum: { amount: true }, _count: true }),
    db.user.aggregate({ where: excludedIds.length ? { id: { notIn: excludedIds } } : {}, _sum: { walletBalance: true }, _count: true }),
    db.user.aggregate({ where: excludedIds.length ? { id: { in: excludedIds } } : { id: "__none__" }, _sum: { walletBalance: true }, _count: true }),
  ]);

  // Seed every day in range so the chart has no gaps.
  const series: Record<string, { date: string; deposits: number; withdrawals: number; net: number }> = {};
  for (let i = 0; i < chartDays; i++) {
    const d = new Date(chartStart.getTime() + i * 86_400_000);
    series[dayKey(d)] = { date: dayKey(d), deposits: 0, withdrawals: 0, net: 0 };
  }

  const depByProvider: Record<string, { amount: number; count: number }> = {};
  let totalDeposits = 0;
  for (const t of depositTx) {
    const amt = Number(t.amount);
    totalDeposits += amt;
    const k = dayKey(t.createdAt); if (series[k]) { series[k].deposits += amt; series[k].net += amt; }
    const p = t.provider ?? "unknown";
    (depByProvider[p] ??= { amount: 0, count: 0 }).amount += amt;
    depByProvider[p].count += 1;
  }

  const wdByProvider: Record<string, { amount: number; count: number }> = {};
  let totalWithdrawals = 0;
  for (const t of withdrawalTx) {
    const amt = Number(t.amount);
    totalWithdrawals += amt;
    const k = dayKey(t.createdAt); if (series[k]) { series[k].withdrawals += amt; series[k].net -= amt; }
    const p = t.provider ?? "unknown";
    (wdByProvider[p] ??= { amount: 0, count: 0 }).amount += amt;
    wdByProvider[p].count += 1;
  }

  let p2pFees = 0;
  for (const t of p2pFeeTx) {
    const meta = t.metadata as { feeKesAmount?: unknown } | null;
    const fee = Number(meta?.feeKesAmount);
    if (Number.isFinite(fee) && fee >= 0) p2pFees += fee;
  }

  const withdrawalFees = totalWithdrawals * WITHDRAWAL_FEE_RATE;
  const ggr = Number(betStakes._sum.amount ?? 0) - Number(betWins._sum.amount ?? 0);

  const round = (n: number) => Math.round(n * 100) / 100;
  const toRows = (m: Record<string, { amount: number; count: number }>) =>
    Object.entries(m).map(([provider, v]) => ({ provider, amount: round(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount);

  return Response.json({
    days: spanDays,
    totals: {
      deposits: round(totalDeposits),
      withdrawals: round(totalWithdrawals),
      netCashflow: round(totalDeposits - totalWithdrawals),
      ggr: round(ggr),
      fees: round(withdrawalFees + p2pFees),
      withdrawalFees: round(withdrawalFees),
      p2pFees: round(p2pFees),
    },
    series: Object.values(series).map((d) => ({ ...d, deposits: round(d.deposits), withdrawals: round(d.withdrawals), net: round(d.net) })),
    depositProviders: toRows(depByProvider),
    withdrawalProviders: toRows(wdByProvider),
    float: {
      real: { balance: Number(realFloat._sum.walletBalance ?? 0), count: realFloat._count },
      test: { balance: Number(testFloat._sum.walletBalance ?? 0), count: testFloat._count },
    },
    pendingWithdrawals: { count: pending._count, amount: Number(pending._sum.amount ?? 0) },
  }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
