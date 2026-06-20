import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";

// Only real cash received through a payment gateway counts as a deposit.
// Manual/test top-ups (no real provider) must not inflate the metrics.
const REAL_DEPOSIT_PROVIDERS = ["megapay", "lipaharaka"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isAdmin: true },
  });
  if (!dbUser?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) {
    return Response.json({ error: "2FA required" }, { status: 403 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Accounts that were credited manually/by SQL (admin seed/credit, not a real
  // gateway). Their balances are test money and must be kept out of the
  // real-money view, then reported separately.
  const testCreditUsers = await db.transaction.findMany({
    where: {
      type: "DEPOSIT",
      OR: [
        { provider: "manual" },
        { reference: { startsWith: "admin-credit" } },
        { reference: { startsWith: "ADMIN-SEED" } },
      ],
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const testUserIds = testCreditUsers.map((t) => t.userId);

  const [
    totalUsers,
    newUsersToday,
    pendingKyc,
    openDisputes,
    pendingDeposits,
    totalMerchants,
    depositsToday,
    activeOrders,
    totalDepositsMonth,
    pendingWithdrawals,
    realWalletBalance,
    testWalletBalance,
    suspendedUsers,
    pendingSportsBets,
    pendingPredictionBets,
    pendingBinaryTrades,
    openForexTrades,
    activeAviatorBets,
    stakesToday,
    winsToday,
    recentTransactions,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfDay } } }),
    db.merchantProfile.count({ where: { kycStatus: "PENDING" } }),
    db.p2PDispute.count({ where: { status: "OPEN" } }),
    db.p2PCryptoDeposit.count({ where: { status: "PENDING" } }),
    db.merchantProfile.count({ where: { kycStatus: "APPROVED" } }),
    db.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: REAL_DEPOSIT_PROVIDERS }, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    }),
    db.p2POrder.count({ where: { status: { in: ["PENDING", "PAID"] } } }),
    db.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: REAL_DEPOSIT_PROVIDERS }, createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus } }),
    db.user.aggregate({ where: { id: { notIn: testUserIds } }, _sum: { walletBalance: true }, _count: true }),
    db.user.aggregate({ where: { id: { in: testUserIds } }, _sum: { walletBalance: true }, _count: true }),
    db.user.count({ where: { isActive: false } }),
    db.bet.count({ where: { status: "PENDING" } }),
    db.polymarketBet.count({ where: { status: "PENDING" } }),
    db.binaryTrade.count({ where: { status: "PENDING" } }),
    db.forexTrade.count({ where: { status: "OPEN" } }),
    db.aviatorBet.count({ where: { status: "ACTIVE" } }),
    db.transaction.aggregate({
      where: { type: "BET_STAKE", status: "COMPLETED", createdAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.aggregate({
      where: { type: "BET_WIN", status: "COMPLETED", createdAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.findMany({
      where: { createdAt: { gte: last24Hours } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        createdAt: true,
        user: { select: { id: true, email: true, username: true } },
      },
    }),
  ]);

  return Response.json({
    totalUsers,
    newUsersToday,
    pendingKyc,
    openDisputes,
    pendingDeposits,
    totalMerchants,
    activeOrders,
    pendingWithdrawals,
    depositsToday: {
      count:  depositsToday._count,
      amount: Number(depositsToday._sum.amount ?? 0),
    },
    depositsMonth: {
      count:  totalDepositsMonth._count,
      amount: Number(totalDepositsMonth._sum.amount ?? 0),
    },
    totalWalletBalance: Number(realWalletBalance._sum.walletBalance ?? 0),
    realWalletCount: realWalletBalance._count,
    testAccounts: {
      count: testWalletBalance._count,
      balance: Number(testWalletBalance._sum.walletBalance ?? 0),
    },
    suspendedUsers,
    exposure: {
      sports: pendingSportsBets,
      predictions: pendingPredictionBets,
      binary: pendingBinaryTrades,
      forex: openForexTrades,
      aviator: activeAviatorBets,
    },
    bettingToday: {
      stakes: Number(stakesToday._sum.amount ?? 0),
      stakeCount: stakesToday._count,
      wins: Number(winsToday._sum.amount ?? 0),
      winCount: winsToday._count,
    },
    recentTransactions: recentTransactions.map((transaction) => ({
      ...transaction,
      amount: Number(transaction.amount),
    })),
  }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
