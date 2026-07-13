import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return true;
}

type Bucket = { count: number; total: number };
function emptyByStatus(): Record<string, Bucket> {
  return {};
}

/**
 * GET /api/admin/money/today?range=today|7d
 *
 * A self-contained view of deposits + withdrawals so the owner never has to
 * open the Lipa Haraka dashboard to see the day's money. Returns per-status
 * totals for each type plus the recent rows (both types), newest first.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const range = new URL(req.url).searchParams.get("range") === "7d" ? "7d" : "today";
  const since = new Date();
  if (range === "7d") {
    since.setDate(since.getDate() - 7);
  } else {
    since.setHours(0, 0, 0, 0);
  }

  const [grouped, rows] = await Promise.all([
    db.transaction.groupBy({
      by: ["type", "status"],
      where: { type: { in: ["DEPOSIT", "WITHDRAWAL"] }, createdAt: { gte: since } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.transaction.findMany({
      where: { type: { in: ["DEPOSIT", "WITHDRAWAL"] }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { username: true, phone: true, email: true } } },
    }),
  ]);

  const deposits = emptyByStatus();
  const withdrawals = emptyByStatus();
  for (const g of grouped) {
    const target = g.type === "DEPOSIT" ? deposits : withdrawals;
    target[g.status] = { count: g._count._all, total: Number(g._sum.amount ?? 0) };
  }

  const sum = (m: Record<string, Bucket>, s: string) => m[s]?.total ?? 0;
  const net = sum(deposits, "COMPLETED") - sum(withdrawals, "COMPLETED");

  const mappedRows = rows.map((r) => {
    const meta = (r.metadata ?? {}) as { msisdn?: string; payout?: number };
    return {
      id: r.id,
      type: r.type,
      amount: Number(r.type === "WITHDRAWAL" ? (meta.payout ?? r.amount) : r.amount),
      status: r.status,
      provider: r.provider,
      reference: r.reference,
      phone: meta.msisdn ?? r.user?.phone ?? null,
      username: r.user?.username ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return Response.json(
    { range, since: since.toISOString(), deposits, withdrawals, net, rows: mappedRows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
