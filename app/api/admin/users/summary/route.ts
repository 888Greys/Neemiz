import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { nairobiMidnight } from "@/lib/admin/metrics";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** Platform-wide rollup shown at the top of the Users page. */
export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const startOfDay = nairobiMidnight(0); // Nairobi midnight

  const [
    totalUsers,
    newToday,
    suspended,
    held,
    deposits,
    withdrawals,
    bets,
    aviator, binary, forex, accumulator, directional, leveraged, polymarket,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfDay } } }),
    db.user.count({ where: { isActive: false } }),
    db.user.aggregate({ _sum: { walletBalance: true } }),
    db.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: REAL_DEPOSIT_PROVIDERS } },
      _sum: { amount: true }, _count: true,
    }),
    db.transaction.aggregate({
      where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: REAL_WITHDRAWAL_PROVIDERS } },
      _sum: { amount: true }, _count: true,
    }),
    db.bet.count(),
    db.aviatorBet.count(),
    db.binaryTrade.count(),
    db.forexTrade.count(),
    db.accumulatorTrade.count(),
    db.directionalTrade.count(),
    db.leveragedTrade.count(),
    db.polymarketBet.count(),
  ]);

  const gamesPlayed = aviator + binary + forex + accumulator + directional + leveraged + polymarket;

  return Response.json({
    totalUsers,
    newToday,
    suspended,
    totalHeld: Number(held._sum?.walletBalance ?? 0),
    deposits:    { count: deposits._count,    amount: Number(deposits._sum?.amount ?? 0) },
    withdrawals: { count: withdrawals._count, amount: Number(withdrawals._sum?.amount ?? 0) },
    bets,
    gamesPlayed,
    gamesBreakdown: { aviator, binary, forex, accumulator, directional, leveraged, polymarket },
  }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
}
