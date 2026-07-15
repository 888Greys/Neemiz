import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { nairobiMidnight } from "@/lib/admin/metrics";
import { cookies } from "next/headers";
import {
  ADMIN_CRYPTO_DEPOSIT_PROVIDERS,
  ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS,
  ADMIN_FIAT_DEPOSIT_PROVIDERS,
  ADMIN_FIAT_WITHDRAWAL_PROVIDERS,
  buildKesRateTable,
  kesAmount,
} from "@/lib/admin/real-money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** Platform-wide rollup shown at the top of the Users page. */
export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const startOfDay = nairobiMidnight(0); // Nairobi midnight

  const [
    totalUsers,
    newToday,
    suspended,
    held,
    fiatDeposits,
    cryptoDeposits,
    fiatWithdrawals,
    cryptoWithdrawals,
    bets,
    aviator, binary, forex, accumulator, directional, leveraged, polymarket,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfDay } } }),
    db.user.count({ where: { isActive: false } }),
    db.user.aggregate({ _sum: { walletBalance: true } }),
    db.transaction.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED", currency: "KES", provider: { in: [...ADMIN_FIAT_DEPOSIT_PROVIDERS] } },
      select: { amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED", provider: { in: [...ADMIN_CRYPTO_DEPOSIT_PROVIDERS] } },
      select: { amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED", currency: "KES", provider: { in: [...ADMIN_FIAT_WITHDRAWAL_PROVIDERS] } },
      select: { amount: true, currency: true },
    }),
    db.transaction.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED", provider: { in: [...ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS] } },
      select: { amount: true, currency: true },
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

  const depRows = [...fiatDeposits, ...cryptoDeposits];
  const wdRows = [...fiatWithdrawals, ...cryptoWithdrawals];
  const rates = await buildKesRateTable(depRows.concat(wdRows).map((t) => t.currency));
  const sumKes = (rows: { amount: unknown; currency: string }[]) =>
    rows.reduce((s, r) => s + kesAmount(r.amount, r.currency, rates), 0);

  const gamesPlayed = aviator + binary + forex + accumulator + directional + leveraged + polymarket;

  return Response.json({
    totalUsers,
    newToday,
    suspended,
    totalHeld: Number(held._sum?.walletBalance ?? 0),
    deposits:    { count: depRows.length, amount: Math.round(sumKes(depRows) * 100) / 100 },
    withdrawals: { count: wdRows.length, amount: Math.round(sumKes(wdRows) * 100) / 100 },
    bets,
    gamesPlayed,
    gamesBreakdown: { aviator, binary, forex, accumulator, directional, leveraged, polymarket },
  }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } });
}
