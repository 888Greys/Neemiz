import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { getMarketScorecards, todayWindow } from "@/lib/admin/metrics";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";

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

// Risk & security feed (Phase 3). House worst-case exposure per market,
// settlement health (what's stuck across every market), internal crypto-book
// liability, and integrity flags. DB-only and fast — the deep on-chain
// incident view stays at /admin/crypto (it queries RPCs).
export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const [
    markets,
    stuckSports, stuckPredictions, stuckBinary, stuckDirectional, stuckAccumulator, stuckLeveraged, stuckAviator,
    voidBinary, voidDirectional, voidAccumulator, voidLeveraged,
    userCrypto, p2pCrypto,
    suspended, negativeBalances, pendingWithdrawals,
  ] = await Promise.all([
    getMarketScorecards({ window: todayWindow(), country: "KE" }),
    db.bet.count({ where: { status: "PENDING", createdAt: { lt: dayAgo } } }),
    db.polymarketBet.count({ where: { status: "PENDING", createdAt: { lt: dayAgo } } }),
    db.binaryTrade.count({ where: { status: "PENDING", settleBefore: { lt: now } } }),
    db.directionalTrade.count({ where: { status: "PENDING", settleBefore: { lt: now } } }),
    db.accumulatorTrade.count({ where: { status: "OPEN", createdAt: { lt: dayAgo } } }),
    db.leveragedTrade.count({ where: { status: "OPEN", createdAt: { lt: dayAgo } } }),
    db.aviatorBet.count({ where: { status: "ACTIVE", placedAt: { lt: tenMinAgo } } }),
    db.binaryTrade.count({ where: { status: "VOID", settledAt: { gte: dayAgo } } }),
    db.directionalTrade.count({ where: { status: "VOID", settledAt: { gte: dayAgo } } }),
    db.accumulatorTrade.count({ where: { status: "VOID", settledAt: { gte: dayAgo } } }),
    db.leveragedTrade.count({ where: { status: "VOID", settledAt: { gte: dayAgo } } }),
    db.userCryptoBalance.groupBy({ by: ["crypto"], _sum: { available: true, locked: true } }),
    db.p2PCryptoBalance.groupBy({ by: ["crypto"], _sum: { total: true } }),
    db.user.count({ where: { isActive: false } }),
    db.user.count({ where: { walletBalance: { lt: 0 } } }),
    db.transaction.aggregate({ where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus }, _sum: { amount: true }, _count: true }),
  ]);

  // Worst-case payout the house still owes on open positions, per market.
  const exposure = markets
    .map((m) => ({ key: m.key, label: m.label, openLiability: m.openLiability, openContracts: m.openContracts, exact: m.liabilityExact }))
    .sort((a, b) => b.openLiability - a.openLiability);
  const totalExposure = exposure.reduce((s, m) => s + m.openLiability, 0);

  const settlement = [
    { market: "Sports", stuck: stuckSports, note: "pending >24h" },
    { market: "Predictions", stuck: stuckPredictions, note: "pending >24h" },
    { market: "Binary", stuck: stuckBinary, note: "past settle-before" },
    { market: "Directional", stuck: stuckDirectional, note: "past settle-before" },
    { market: "Accumulator", stuck: stuckAccumulator, note: "open >24h" },
    { market: "Leveraged", stuck: stuckLeveraged, note: "open >24h" },
    { market: "Aviator", stuck: stuckAviator, note: "active >10m" },
  ].filter((s) => s.stuck > 0);

  const voids24h = voidBinary + voidDirectional + voidAccumulator + voidLeveraged;

  // Internal crypto-book liability (what users + merchants hold on-platform).
  const cryptoMap: Record<string, number> = {};
  for (const r of userCrypto) cryptoMap[r.crypto] = (cryptoMap[r.crypto] ?? 0) + Number(r._sum.available ?? 0) + Number(r._sum.locked ?? 0);
  for (const r of p2pCrypto) cryptoMap[r.crypto] = (cryptoMap[r.crypto] ?? 0) + Number(r._sum.total ?? 0);
  const cryptoLiability = Object.entries(cryptoMap)
    .map(([crypto, amount]) => ({ crypto, amount }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return Response.json({
    exposure,
    totalExposure,
    settlement,
    settlementStuck: settlement.reduce((s, m) => s + m.stuck, 0),
    voids24h,
    cryptoLiability,
    flags: {
      suspended,
      negativeBalances,
      pendingWithdrawals: { count: pendingWithdrawals._count, amount: Number(pendingWithdrawals._sum.amount ?? 0) },
    },
  }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } });
}
