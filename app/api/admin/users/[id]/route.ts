import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";

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
        take: 20,
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

  const [realDeposits, realWithdrawals, stakes, wins, ledger] = await Promise.all([
    db.transaction.aggregate({
      where: { userId: user.id, type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: "megapay" },
      _sum: { amount: true },
      _count: true,
    }),
    db.transaction.aggregate({
      where: {
        userId: user.id,
        type: "WITHDRAWAL",
        status: "COMPLETED",
        currency: "KES",
        provider: { in: ["relworx", "megapay"] },
      },
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
  ]);

  const ledgerBalance = ledger.reduce((total, transaction) => {
    const amount = Number(transaction.amount);
    return total + (["DEPOSIT", "BET_WIN", "BONUS", "REFUND"].includes(transaction.type) ? amount : -amount);
  }, 0);
  const walletBalance = Number(user.walletBalance);

  return Response.json({
    user,
    summary: {
      realDeposits: { count: realDeposits._count, amount: Number(realDeposits._sum.amount ?? 0) },
      realWithdrawals: { count: realWithdrawals._count, amount: Number(realWithdrawals._sum.amount ?? 0) },
      stakes: { count: stakes._count, amount: Number(stakes._sum.amount ?? 0) },
      wins: { count: wins._count, amount: Number(wins._sum.amount ?? 0) },
      ledgerBalance: Number(ledgerBalance.toFixed(2)),
      walletDifference: Number((walletBalance - ledgerBalance).toFixed(2)),
    },
  });
}

// PATCH /api/admin/users/[id]  { action: "suspend" | "unsuspend" }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  let body: { action: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const isActive = body.action === "unsuspend";

  const target = await db.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.isAdmin) return Response.json({ error: "Cannot suspend an admin account" }, { status: 403 });

  const updated = await db.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, email: true, isActive: true },
  });

  return Response.json(updated);
}
