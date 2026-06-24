import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { getExcludedUserIds } from "@/lib/admin-excluded";
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

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// Players / Growth feed (Phase 3). The acquisition + base-health screen: signup
// trend with peak/avg, active-user counts, KYC funnel, and a real-money balance
// leaderboard. Signup counts include everyone (acquisition is acquisition);
// balance figures exclude test/suspended accounts.
export async function GET(req: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(7, parseInt(searchParams.get("days") ?? "30", 10)));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const excludedIds = await getExcludedUserIds();

  const [
    totalUsers, newToday, new7d, new30d, suspended,
    active24h, active7d,
    kycPending, kycApproved, kycRejected,
    signupRows, topBalance, recentSignups,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfToday } } }),
    db.user.count({ where: { createdAt: { gte: last7d } } }),
    db.user.count({ where: { createdAt: { gte: last30d } } }),
    db.user.count({ where: { isActive: false } }),
    db.transaction.findMany({ where: { createdAt: { gte: last24h } }, select: { userId: true }, distinct: ["userId"] }),
    db.transaction.findMany({ where: { createdAt: { gte: last7d } }, select: { userId: true }, distinct: ["userId"] }),
    db.merchantProfile.count({ where: { kycStatus: "PENDING" } }),
    db.merchantProfile.count({ where: { kycStatus: "APPROVED" } }),
    db.merchantProfile.count({ where: { kycStatus: "REJECTED" } }),
    db.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS count
      FROM users WHERE created_at >= ${since}
      GROUP BY day ORDER BY day`,
    db.user.findMany({
      where: excludedIds.length ? { id: { notIn: excludedIds } } : {},
      orderBy: { walletBalance: "desc" }, take: 8,
      select: { id: true, username: true, email: true, walletBalance: true, createdAt: true },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, username: true, email: true, walletBalance: true, createdAt: true },
    }),
  ]);

  // Seed every day so the chart has no gaps; overlay the grouped counts.
  const series: Record<string, { date: string; signups: number }> = {};
  for (let i = 0; i < days; i++) { const d = new Date(since); d.setDate(d.getDate() + i); series[dayKey(d)] = { date: dayKey(d), signups: 0 }; }
  let peak = 0;
  for (const r of signupRows) {
    const k = dayKey(new Date(r.day));
    const c = Number(r.count);
    if (series[k]) series[k].signups = c;
    if (c > peak) peak = c;
  }
  const avg = Math.round(new30d / 30);

  const name = (u: { username: string | null; email: string | null }) => u.username ?? u.email ?? "unknown";

  return Response.json({
    days,
    totals: {
      totalUsers, newToday, new7d, new30d, suspended,
      active24h: active24h.length, active7d: active7d.length,
      peak, avgDaily: avg,
    },
    kyc: { pending: kycPending, approved: kycApproved, rejected: kycRejected },
    series: Object.values(series),
    topBalance: topBalance.map((u) => ({ id: u.id, name: name(u), balance: Number(u.walletBalance), joined: u.createdAt })),
    recentSignups: recentSignups.map((u) => ({ id: u.id, name: name(u), balance: Number(u.walletBalance), joined: u.createdAt })),
  }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
