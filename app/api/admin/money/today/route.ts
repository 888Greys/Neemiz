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
 * GET /api/admin/money/today?range=today|7d
 *
 * A self-contained view of deposits + withdrawals so the owner never has to
 * open the Lipa Haraka dashboard to see the day's money. Returns per-status
 * totals for each type plus the recent rows (both types), newest first.
 *
 * Scoped to live rails (Lipa Haraka + crypto + legacy mega/relworx/pesapal).
 * Crypto amounts are shown in native units; status totals are KES-equivalent.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const range = new URL(req.url).searchParams.get("range") === "7d" ? "7d" : "today";
  const since = range === "7d"
    ? new Date(nairobiMidnight(0).getTime() - 6 * 86_400_000)
    : nairobiMidnight(0);

  const [rows] = await Promise.all([
    db.transaction.findMany({
      where: {
        type: { in: ["DEPOSIT", "WITHDRAWAL"] },
        provider: { in: REAL_MONEY_PROVIDERS },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { username: true, phone: true, email: true } } },
    }),
  ]);

  const rates = await buildKesRateTable(rows.map((r) => r.currency));

  const deposits = emptyByStatus();
  const withdrawals = emptyByStatus();
  for (const r of rows) {
    const target = r.type === "DEPOSIT" ? deposits : withdrawals;
    const kes = kesAmount(r.amount, r.currency, rates);
    const bucket = (target[r.status] ??= { count: 0, total: 0 });
    bucket.count += 1;
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
      since: since.toISOString(),
      deposits: roundBuckets(deposits),
      withdrawals: roundBuckets(withdrawals),
      net: Math.round(net * 100) / 100,
      rows: mappedRows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
