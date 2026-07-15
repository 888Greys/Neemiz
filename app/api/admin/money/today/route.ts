import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { nairobiMidnight } from "@/lib/admin/metrics";
import {
  ADMIN_CRYPTO_DEPOSIT_PROVIDERS,
  ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS,
  ADMIN_FIAT_DEPOSIT_PROVIDERS,
  ADMIN_FIAT_WITHDRAWAL_PROVIDERS,
  buildKesRateTable,
  kesAmount,
} from "@/lib/admin/real-money";

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

const REAL_MONEY_PROVIDERS = [
  ...ADMIN_FIAT_DEPOSIT_PROVIDERS,
  ...ADMIN_FIAT_WITHDRAWAL_PROVIDERS,
  ...ADMIN_CRYPTO_DEPOSIT_PROVIDERS,
  ...ADMIN_CRYPTO_WITHDRAWAL_PROVIDERS,
] as string[];

/**
 * GET /api/admin/money/today
 *   ?range=today|7d
 *   &type=ALL|DEPOSIT|WITHDRAWAL
 *   &page=1&pageSize=20
 *
 * Summary tiles always cover the full window (both sides). The table is
 * filtered + paginated so the owner isn't staring at a 100-row wall.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const range = url.searchParams.get("range") === "7d" ? "7d" : "today";
  const typeParam = (url.searchParams.get("type") ?? "ALL").toUpperCase();
  const type = typeParam === "DEPOSIT" || typeParam === "WITHDRAWAL" ? typeParam : "ALL";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(10, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));

  const since = range === "7d"
    ? new Date(nairobiMidnight(0).getTime() - 6 * 86_400_000)
    : nairobiMidnight(0);

  const baseWhere = {
    type: { in: ["DEPOSIT", "WITHDRAWAL"] as ("DEPOSIT" | "WITHDRAWAL")[] },
    provider: { in: REAL_MONEY_PROVIDERS },
    createdAt: { gte: since },
  };
  const rowWhere = {
    ...baseWhere,
    ...(type === "ALL" ? {} : { type: type as "DEPOSIT" | "WITHDRAWAL" }),
  };

  const [grouped, total, rows] = await Promise.all([
    db.transaction.groupBy({
      by: ["type", "status", "currency"],
      where: baseWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.transaction.count({ where: rowWhere }),
    db.transaction.findMany({
      where: rowWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { username: true, phone: true, email: true } } },
    }),
  ]);

  const currencies = [
    ...grouped.map((g) => g.currency),
    ...rows.map((r) => r.currency),
  ];
  const rates = await buildKesRateTable(currencies);

  const deposits = emptyByStatus();
  const withdrawals = emptyByStatus();
  for (const g of grouped) {
    const target = g.type === "DEPOSIT" ? deposits : withdrawals;
    const kes = kesAmount(g._sum.amount, g.currency, rates);
    const bucket = (target[g.status] ??= { count: 0, total: 0 });
    bucket.count += g._count._all;
    bucket.total += kes;
  }

  const sum = (m: Record<string, Bucket>, s: string) => m[s]?.total ?? 0;
  const net = sum(deposits, "COMPLETED") - sum(withdrawals, "COMPLETED");

  const mappedRows = rows.map((r) => {
    const meta = (r.metadata ?? {}) as { msisdn?: string; payout?: number };
    const currency = (r.currency || "KES").toUpperCase();
    const nativeAmount = Number(r.type === "WITHDRAWAL" ? (meta.payout ?? r.amount) : r.amount);
    return {
      id: r.id,
      type: r.type,
      amount: nativeAmount,
      amountKes: Math.round(kesAmount(r.amount, currency, rates) * 100) / 100,
      currency,
      status: r.status,
      provider: r.provider,
      reference: r.reference,
      phone: meta.msisdn ?? r.user?.phone ?? null,
      username: r.user?.username ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const roundBuckets = (m: Record<string, Bucket>) => {
    const out: Record<string, Bucket> = {};
    for (const [k, v] of Object.entries(m)) out[k] = { count: v.count, total: Math.round(v.total * 100) / 100 };
    return out;
  };

  return Response.json(
    {
      range,
      type,
      since: since.toISOString(),
      deposits: roundBuckets(deposits),
      withdrawals: roundBuckets(withdrawals),
      net: Math.round(net * 100) / 100,
      page,
      pageSize,
      total,
      rows: mappedRows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
