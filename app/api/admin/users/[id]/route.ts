import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { logAdminAction } from "@/lib/admin-audit";
import { EAT_OFFSET_MS, nairobiDayKey } from "@/lib/admin/metrics";
import {
  ADMIN_FIAT_DEPOSIT_PROVIDERS,
  ADMIN_FIAT_WITHDRAWAL_PROVIDERS,
} from "@/lib/admin/real-money";
import { TransactionStatus } from "@prisma/client";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isOwnerEmail(user.email)) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true, isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return dbUser;
}

const GAME_META: Record<string, { label: string; icon: string }> = {
  sports: { label: "Sportsbook", icon: "sports_soccer" },
  aviator: { label: "Aviator", icon: "flight_takeoff" },
  "aviator-service": { label: "Aviator", icon: "flight_takeoff" },
  binary: { label: "Binary digits", icon: "candlestick_chart" },
  directional: { label: "Directional", icon: "trending_up" },
  accumulator: { label: "Accumulator", icon: "show_chart" },
  leveraged: { label: "Leveraged", icon: "bolt" },
  forex: { label: "Forex", icon: "currency_exchange" },
  polymarket: { label: "Predictions", icon: "online_prediction" },
  predictions: { label: "Predictions", icon: "online_prediction" },
  other: { label: "Other", icon: "sports_esports" },
};

function gameKey(provider: string | null, metadata: unknown): string {
  const p = (provider ?? "").toLowerCase();
  if (p === "aviator-service") return "aviator";
  if (p && GAME_META[p]) return p;
  if (p) return p;
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : null;
  const g = typeof meta?.game === "string" ? meta.game.toLowerCase() : "";
  if (g === "aviator-service") return "aviator";
  if (g) return g;
  return "other";
}

function seedDays(days: number): string[] {
  const eat = new Date(Date.now() + EAT_OFFSET_MS);
  eat.setUTCHours(0, 0, 0, 0);
  const base = eat.getTime() - EAT_OFFSET_MS;
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(nairobiDayKey(new Date(base - i * 86_400_000)));
  }
  return out;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      supabaseId: true,
      email: true,
      phone: true,
      username: true,
      firstName: true,
      lastName: true,
      walletBalance: true,
      currency: true,
      isActive: true,
      isAdmin: true,
      createdAt: true,
      updatedAt: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          reference: true,
          createdAt: true,
        },
      },
      bets: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          betType: true,
          stake: true,
          totalOdds: true,
          potentialWin: true,
          winAmount: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const days = 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const fiatDeposits = [...ADMIN_FIAT_DEPOSIT_PROVIDERS] as string[];
  const fiatWithdrawals = [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS] as string[];
  const fiatDepositSet = new Set(fiatDeposits);
  const fiatWithdrawalSet = new Set(fiatWithdrawals);

  const [
    realDeposits, realWithdrawals, stakes, wins, ledger,
    pendingWd, windowTx, gameStakes, gameWins,
  ] = await Promise.all([
    db.transaction.aggregate({
      where: { userId: user.id, type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: fiatDeposits } },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.aggregate({
      where: { userId: user.id, type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: fiatWithdrawals } },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.aggregate({
      where: { userId: user.id, type: "BET_STAKE", status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.aggregate({
      where: { userId: user.id, type: "BET_WIN", status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      select: { type: true, amount: true },
    }),
    db.transaction.aggregate({
      where: { userId: user.id, type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.findMany({
      where: {
        userId: user.id,
        status: "COMPLETED",
        createdAt: { gte: since },
        type: { in: ["DEPOSIT", "WITHDRAWAL", "BET_STAKE", "BET_WIN"] },
      },
      select: { type: true, amount: true, createdAt: true, provider: true, currency: true },
    }),
    db.transaction.findMany({
      where: { userId: user.id, type: "BET_STAKE", status: "COMPLETED" },
      select: { amount: true, provider: true, metadata: true },
    }),
    db.transaction.findMany({
      where: { userId: user.id, type: "BET_WIN", status: "COMPLETED" },
      select: { amount: true, provider: true, metadata: true },
    }),
  ]);

  const ledgerBalance = ledger.reduce((total, transaction) => {
    const amount = Number(transaction.amount);
    return total + (["DEPOSIT", "BET_WIN", "BONUS", "REFUND"].includes(transaction.type) ? amount : -amount);
  }, 0);
  const walletBalance = Number(user.walletBalance);

  // Daily activity series (Nairobi days).
  const dayKeys = seedDays(days);
  const seriesMap: Record<string, { date: string; deposits: number; withdrawals: number; stakes: number; wins: number }> = {};
  for (const d of dayKeys) seriesMap[d] = { date: d, deposits: 0, withdrawals: 0, stakes: 0, wins: 0 };
  for (const tx of windowTx) {
    if (tx.currency !== "KES") continue;
    const key = nairobiDayKey(tx.createdAt);
    const bucket = seriesMap[key];
    if (!bucket) continue;
    const amt = Number(tx.amount);
    if (tx.type === "DEPOSIT" && tx.provider && fiatDepositSet.has(tx.provider)) bucket.deposits += amt;
    else if (tx.type === "WITHDRAWAL" && tx.provider && fiatWithdrawalSet.has(tx.provider)) bucket.withdrawals += amt;
    else if (tx.type === "BET_STAKE") bucket.stakes += amt;
    else if (tx.type === "BET_WIN") bucket.wins += amt;
  }
  const series = dayKeys.map((d) => seriesMap[d]);

  // Games played — lifetime stakes/wins by game key.
  const gamesMap: Record<string, { key: string; stakes: number; wins: number; count: number }> = {};
  for (const tx of gameStakes) {
    const key = gameKey(tx.provider, tx.metadata);
    const g = gamesMap[key] ?? (gamesMap[key] = { key, stakes: 0, wins: 0, count: 0 });
    g.stakes += Number(tx.amount);
    g.count += 1;
  }
  for (const tx of gameWins) {
    const key = gameKey(tx.provider, tx.metadata);
    const g = gamesMap[key] ?? (gamesMap[key] = { key, stakes: 0, wins: 0, count: 0 });
    g.wins += Number(tx.amount);
  }
  const games = Object.values(gamesMap)
    .map((g) => {
      const meta = GAME_META[g.key] ?? { label: g.key, icon: "sports_esports" };
      return {
        key: g.key,
        label: meta.label,
        icon: meta.icon,
        stakes: Number(g.stakes.toFixed(2)),
        wins: Number(g.wins.toFixed(2)),
        count: g.count,
        // Player net vs house: wins − stakes (negative = player lost).
        net: Number((g.wins - g.stakes).toFixed(2)),
      };
    })
    .sort((a, b) => b.stakes - a.stakes);

  const depositAmt = Number(realDeposits._sum.amount ?? 0);
  const withdrawAmt = Number(realWithdrawals._sum.amount ?? 0);

  return Response.json({
    user,
    summary: {
      realDeposits: { count: realDeposits._count, amount: depositAmt },
      realWithdrawals: { count: realWithdrawals._count, amount: withdrawAmt },
      stakes: { count: stakes._count, amount: Number(stakes._sum.amount ?? 0) },
      wins: { count: wins._count, amount: Number(wins._sum.amount ?? 0) },
      ledgerBalance: Number(ledgerBalance.toFixed(2)),
      walletDifference: Number((walletBalance - ledgerBalance).toFixed(2)),
      cashNet: Number((depositAmt - withdrawAmt).toFixed(2)),
      pendingWithdrawals: { count: pendingWd._count, amount: Number(pendingWd._sum.amount ?? 0) },
    },
    audit: {
      days,
      series,
      games,
    },
  }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } });
}

// PATCH /api/admin/users/[id]  { action: "suspend" | "unsuspend" }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  let body: { action: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const isActive = body.action === "unsuspend";

  const target = await db.user.findUnique({ where: { id }, select: { isAdmin: true, email: true, username: true } });
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.isAdmin) return Response.json({ error: "Cannot suspend an admin account" }, { status: 403 });

  await logAdminAction({
    adminId: admin.id,
    action: `USER_${body.action.toUpperCase()}`,
    targetId: id,
    metadata: { email: target.email, username: target.username },
    ipAddress: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for"),
  });

  const updated = await db.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, email: true, isActive: true },
  });

  return Response.json(updated);
}
