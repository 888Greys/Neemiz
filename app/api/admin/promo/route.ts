import { cookies } from "next/headers";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { logAdminAction } from "@/lib/admin-audit";
import { normalizePromoCode } from "@/lib/promo-redeem";

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

/**
 * POST /api/admin/promo
 * Body: { code, amountKes, maxRedemptions?, expiresAt?, description? }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    code?: string;
    amountKes?: number;
    maxRedemptions?: number | null;
    expiresAt?: string | null;
    description?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const code = normalizePromoCode(body.code ?? "");
  if (code.length < 3 || code.length > 32) {
    return Response.json({ error: "Code must be 3–32 characters" }, { status: 400 });
  }

  const amountKes = Number(body.amountKes);
  if (!Number.isFinite(amountKes) || amountKes <= 0 || amountKes > 10_000) {
    return Response.json({ error: "Enter a valid amount (1–10000 KES)" }, { status: 400 });
  }

  const maxRedemptions =
    body.maxRedemptions == null || body.maxRedemptions === undefined
      ? null
      : Number(body.maxRedemptions);
  if (maxRedemptions != null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
    return Response.json({ error: "maxRedemptions must be a positive integer or null" }, { status: 400 });
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return Response.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
  }

  try {
    const promo = await db.promoCode.create({
      data: {
        code,
        amountKes,
        maxRedemptions,
        expiresAt,
        description: body.description?.trim() || null,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      action: "promo_create",
      targetId: promo.id,
      metadata: { code, amountKes, maxRedemptions, expiresAt },
    });

    return Response.json({ ok: true, promo });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return Response.json({ error: "That code already exists" }, { status: 409 });
    }
    throw err;
  }
}

/**
 * GET /api/admin/promo
 * Lists codes + recent redemptions (who used what).
 * Query: ?code=KIP100 to filter redemptions to one code; ?limit=200
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const codeFilter = normalizePromoCode(url.searchParams.get("code") ?? "");
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get("limit") ?? 200) || 200));

  const promos = await db.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const redemptions = await db.promoRedemption.findMany({
    where: codeFilter
      ? { promoCode: { code: codeFilter } }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      promoCode: { select: { code: true, amountKes: true } },
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          walletBalance: true,
          createdAt: true,
        },
      },
    },
  });

  return Response.json({
    promos,
    redemptions: redemptions.map((r) => ({
      id: r.id,
      code: r.promoCode.code,
      amountKes: Number(r.amountKes),
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.user.id,
        username: r.user.username,
        email: r.user.email,
        phone: r.user.phone,
        walletBalance: Number(r.user.walletBalance),
        joinedAt: r.user.createdAt.toISOString(),
      },
    })),
  });
}
