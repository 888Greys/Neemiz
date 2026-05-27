import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";

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
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfDay } } }),
    db.merchantProfile.count({ where: { kycStatus: "PENDING" } }),
    db.p2PDispute.count({ where: { status: "OPEN" } }),
    db.p2PCryptoDeposit.count({ where: { status: "PENDING" } }),
    db.merchantProfile.count({ where: { kycStatus: "APPROVED" } }),
    db.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", createdAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    }),
    db.p2POrder.count({ where: { status: { in: ["PENDING", "PAID"] } } }),
    db.transaction.aggregate({
      where: { type: "DEPOSIT", status: "COMPLETED", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
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
    depositsToday: {
      count:  depositsToday._count,
      amount: Number(depositsToday._sum.amount ?? 0),
    },
    depositsMonth: {
      count:  totalDepositsMonth._count,
      amount: Number(totalDepositsMonth._sum.amount ?? 0),
    },
  });
}
