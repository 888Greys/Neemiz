import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";

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

export async function GET(req: Request) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 50;
  const search = searchParams.get("q") ?? "";
  // Ranking: "balance" sorts richest-first so the owner sees top holders; the
  // default keeps the newest accounts on top.
  const orderBy = searchParams.get("sort") === "balance"
    ? [{ walletBalance: "desc" as const }, { createdAt: "desc" as const }]
    : [{ createdAt: "desc" as const }];

  const where = search
    ? {
        OR: [
          { email:    { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
          { phone:    { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        walletBalance: true,
        isActive: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { bets: true, transactions: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const balanceAgg = await db.user.aggregate({ where, _sum: { walletBalance: true } });
  const totalBalance = Number(balanceAgg._sum?.walletBalance ?? 0);

  return Response.json({ users, total, page, pages: Math.ceil(total / limit), limit, totalBalance });
}
