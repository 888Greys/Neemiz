import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { db } from "@/lib/db";
import { COPY_TRADING_FLAG, clearCopyTradingFlagCache, isCopyTradingEnabled } from "@/lib/copy-trading";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isOwnerEmail(user.email)) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return user;
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [enabled, leaders, signals24h, fills24h, copiedStake] = await Promise.all([
    isCopyTradingEnabled(),
    db.copyLeaderProfile.findMany({
      include: {
        user: { select: { id: true, username: true, email: true, isAdmin: true } },
        _count: { select: { follows: true, signals: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.copySignal.count({ where: { createdAt: { gte: since } } }),
    db.copyTradeLink.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    db.copyTradeLink.aggregate({
      where: { createdAt: { gte: since }, status: "COPIED" },
      _sum: { stake: true },
      _count: true,
    }),
  ]);

  const fillCounts: Record<string, number> = {};
  for (const row of fills24h) fillCounts[row.status] = row._count;

  return Response.json({
    enabled,
    last24h: {
      signals: signals24h,
      copied: fillCounts.COPIED ?? 0,
      skipped: fillCounts.SKIPPED ?? 0,
      failed: fillCounts.FAILED ?? 0,
      copiedStakeKes: Number(copiedStake._sum.stake ?? 0),
      copiedFills: copiedStake._count,
    },
    leaders: leaders.map((L) => ({
      id: L.id,
      userId: L.userId,
      username: L.user.username,
      email: L.user.email,
      isAdmin: L.user.isAdmin,
      status: L.status,
      isPublic: L.isPublic,
      followers: L._count.follows,
      signals: L._count.signals,
      allowedFamilies: L.allowedFamilies,
      updatedAt: L.updatedAt,
    })),
  });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { leaderProfileId?: string; status?: "ACTIVE" | "SUSPENDED" | "PENDING"; enabled?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  if (typeof body.enabled === "boolean") {
    await db.systemSetting.upsert({
      where: { key: COPY_TRADING_FLAG },
      create: { key: COPY_TRADING_FLAG, value: body.enabled ? "true" : "false" },
      update: { value: body.enabled ? "true" : "false" },
    });
    clearCopyTradingFlagCache();
  }

  if (body.leaderProfileId && body.status) {
    await db.copyLeaderProfile.update({
      where: { id: body.leaderProfileId },
      data: { status: body.status },
    });
  }

  return Response.json({ ok: true });
}
