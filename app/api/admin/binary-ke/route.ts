import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { bokDb } from "@/lib/db-bok";
import { TransactionStatus, TransactionType } from "@prisma/client";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isOwnerEmail(user.email)) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token, user.id))) return null;
  return user;
}

function dayStartEAT(now = new Date()) {
  // EAT = UTC+3
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const eat = new Date(utc + 3 * 3600_000);
  eat.setHours(0, 0, 0, 0);
  return new Date(eat.getTime() - 3 * 3600_000);
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const client = bokDb();
  if (!client) {
    return Response.json({
      configured: false,
      error: "BINARYOPTIONSKE_DATABASE_URL is not set on Nezeem runtime.",
    }, { status: 503 });
  }

  const since = dayStartEAT();
  const [
    users,
    depositAgg,
    withdrawAgg,
    pendingDep,
    failedDepToday,
    tradesToday,
    wonToday,
    recentDeposits,
    recentTrades,
  ] = await Promise.all([
    client.user.count(),
    client.transaction.aggregate({
      where: { type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED, provider: "lipaharaka", createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    }),
    client.transaction.aggregate({
      where: { type: TransactionType.WITHDRAWAL, status: TransactionStatus.COMPLETED, provider: "lipaharaka", createdAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    }),
    client.transaction.count({
      where: { type: TransactionType.DEPOSIT, status: TransactionStatus.PENDING, provider: "lipaharaka" },
    }),
    client.transaction.count({
      where: { type: TransactionType.DEPOSIT, status: TransactionStatus.FAILED, provider: "lipaharaka", createdAt: { gte: since } },
    }),
    client.binaryTrade.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { stake: true },
      _count: true,
    }),
    client.binaryTrade.aggregate({
      where: { createdAt: { gte: since }, status: "WON" },
      _sum: { payout: true },
      _count: true,
    }),
    client.transaction.findMany({
      where: { type: TransactionType.DEPOSIT, provider: "lipaharaka", createdAt: { gte: since } },
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    client.binaryTrade.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { username: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const staked = Number(tradesToday._sum.stake ?? 0);
  const paidOut = Number(wonToday._sum.payout ?? 0);
  const deposits = Number(depositAgg._sum.amount ?? 0);
  const withdrawals = Number(withdrawAgg._sum.amount ?? 0);

  return Response.json({
    configured: true,
    brand: "BinaryOptionsKE",
    siteUrl: "https://binaryoptionske.com",
    asOf: new Date().toISOString(),
    dayStartEAT: since.toISOString(),
    summary: {
      users,
      depositsToday: { count: depositAgg._count, amount: deposits },
      withdrawalsToday: { count: withdrawAgg._count, amount: withdrawals },
      pendingDeposits: pendingDep,
      failedDepositsToday: failedDepToday,
      tradesToday: { count: tradesToday._count, staked },
      winsToday: { count: wonToday._count, paidOut },
      ggrToday: Math.round((staked - paidOut) * 100) / 100,
      netCashToday: Math.round((deposits - withdrawals) * 100) / 100,
    },
    recentDeposits: recentDeposits.map((t) => ({
      id: t.id,
      user: t.user.username,
      email: t.user.email,
      amount: Number(t.amount),
      status: t.status,
      reference: t.reference,
      at: t.createdAt,
    })),
    recentTrades: recentTrades.map((t) => ({
      id: t.id,
      user: t.user.username,
      email: t.user.email,
      stake: Number(t.stake),
      payout: t.payout != null ? Number(t.payout) : null,
      status: t.status,
      market: t.market,
      side: t.side,
      at: t.createdAt,
    })),
  });
}
