import { TransactionStatus, TransactionType } from "@prisma/client";
import { cookies } from "next/headers";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { logAdminAction } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true, isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return dbUser;
}

// Per-grant safety ceiling (override with BONUS_MAX_GRANT_KES).
function maxGrantKes(): number {
  const v = Number(process.env.BONUS_MAX_GRANT_KES ?? "200");
  return Number.isFinite(v) && v > 0 ? v : 200;
}

// Aggregate daily ceiling across ALL grants/admins (override with
// BONUS_MAX_DAILY_KES). Rate-limits a compromised admin account.
function maxDailyKes(): number {
  const v = Number(process.env.BONUS_MAX_DAILY_KES ?? "10000");
  return Number.isFinite(v) && v > 0 ? v : 10_000;
}

/**
 * Grant promo credit straight to the user's main walletBalance. Bonus and real
 * cash intentionally share one KES wallet again.
 *
 * Body: { username?: string, userId?: string, amount: number, reason?: string }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { username?: string; userId?: string; amount?: number; reason?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Enter a valid positive amount" }, { status: 400 });
  }
  if (amount > maxGrantKes()) {
    return Response.json({ error: `Amount exceeds the per-grant cap of KES ${maxGrantKes().toLocaleString()}` }, { status: 400 });
  }
  if (!body.username && !body.userId) {
    return Response.json({ error: "Provide a username or userId" }, { status: 400 });
  }

  // Aggregate daily cap across all admins/grants (last 24h).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const grantedToday = await db.transaction.aggregate({
    where: { provider: "bonus_grant", createdAt: { gte: since } },
    _sum: { amount: true },
  });
  if (Number(grantedToday._sum.amount ?? 0) + amount > maxDailyKes()) {
    return Response.json({ error: `Daily bonus-grant cap of KES ${maxDailyKes().toLocaleString()} reached` }, { status: 429 });
  }

  const target = await db.user.findFirst({
    where: body.userId ? { id: body.userId } : { username: body.username },
    select: { id: true, username: true, walletBalance: true },
  });
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });

  const before = Number(target.walletBalance);
  const reference = `bonus-grant-${crypto.randomUUID()}`;

  const after = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data:  { walletBalance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        userId: target.id,
        type: TransactionType.BONUS,
        amount,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference,
        provider: "bonus_grant",
        metadata: {
          action: "admin_bonus_grant",
          balance: "wallet",
          before,
          after: before + amount,
          reason: body.reason ?? "admin bonus grant",
          grantedBy: admin.id,
        },
      },
    });
    const updated = await tx.user.findUnique({ where: { id: target.id }, select: { walletBalance: true } });
    return Number(updated?.walletBalance ?? 0);
  });

  await logAdminAction({
    adminId: admin.id,
    action: "bonus_grant",
    targetId: target.id,
    metadata: { amount, before, after, reason: body.reason ?? null, reference },
  });

  return Response.json({ ok: true, username: target.username, balance: after, bonusBalance: 0, granted: amount, reference });
}
