import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { Prisma, TransactionStatus } from "@prisma/client";

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

const VALID_STATUS = new Set<string>(Object.values(TransactionStatus));

/**
 * GET /api/admin/withdrawals/history
 * Full withdrawal history across all statuses/providers, for monitoring (the
 * approvals endpoint at ../route.ts only returns PENDING_APPROVAL).
 *
 * Query params:
 *   status   — filter by a single TransactionStatus (optional)
 *   provider — "lipaharaka" | "self_custody" | "crypto_sell" (optional)
 *   page     — 1-based page number (default 1)
 *   pageSize — rows per page (default 25, capped at 100)
 *
 * Returns { rows, total, page, pageSize } so the UI can paginate.
 */
export async function GET(req: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const statusParam   = url.searchParams.get("status");
  const providerParam = url.searchParams.get("provider");
  const page     = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize")) || 25, 1), 100);

  const where: Prisma.TransactionWhereInput = { type: "WITHDRAWAL" };
  if (statusParam && VALID_STATUS.has(statusParam)) {
    where.status = statusParam as TransactionStatus;
  }
  if (providerParam) {
    where.provider = providerParam;
  }

  const [rows, total] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, username: true, phone: true } },
      },
    }),
    db.transaction.count({ where }),
  ]);

  return Response.json({ rows, total, page, pageSize }, { headers: { "Cache-Control": "no-store" } });
}
