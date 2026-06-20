import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { getOnChainBalance } from "@/lib/crypto/deposit-checker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return false;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(token && verifyAdminToken(token));
}

function derivationPath(network: string, index: number): string {
  if (network === "TRC20")   return `m/44'/195'/0'/0/${index}`;
  if (network === "BITCOIN") return `m/44'/0'/0'/0/${index}`;
  return `m/44'/60'/0'/0/${index}`;
}

// Map over items with bounded concurrency so we don't hammer the RPCs.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * GET /api/admin/crypto/exposure
 *
 * Incident response for the leaked master seed: lists every user deposit
 * address with its LIVE on-chain balance and how much KES that user deposited,
 * so the owner can see which addresses still hold recoverable crypto.
 */
export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [addresses, deposits] = await Promise.all([
    db.cryptoDepositAddress.findMany({
      include: { user: { select: { id: true, email: true, username: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.transaction.findMany({
      where: { type: "DEPOSIT", provider: "crypto", status: "COMPLETED" },
      select: { userId: true, amount: true },
    }),
  ]);

  // KES deposited + deposit count per user.
  const byUser: Record<string, { kes: number; count: number }> = {};
  for (const d of deposits) {
    byUser[d.userId] ??= { kes: 0, count: 0 };
    byUser[d.userId].kes += Number(d.amount);
    byUser[d.userId].count += 1;
  }

  // Live on-chain balance per address (bounded concurrency).
  const rows = await mapLimit(addresses, 6, async (a, i) => {
    const onChain = await getOnChainBalance(a.address, a.crypto, a.network);
    const u = byUser[a.user.id];
    return {
      address:        a.address,
      crypto:         a.crypto,
      network:        a.network,
      derivationPath: derivationPath(a.network, i),
      onChain,
      kesDeposited:   u?.kes ?? 0,
      depositCount:   u?.count ?? 0,
      hasDeposited:   Boolean(u) || onChain > 0,
      owner:          { id: a.user.id, email: a.user.email, username: a.user.username },
      createdAt:      a.createdAt,
    };
  });

  rows.sort((x, y) => y.onChain - x.onChain || y.kesDeposited - x.kesDeposited);

  const depositorIds = new Set<string>();
  for (const r of rows) if (r.hasDeposited) depositorIds.add(r.owner.id);

  return Response.json({
    rows,
    summary: {
      addresses:     rows.length,
      depositors:    depositorIds.size,
      withFunds:     rows.filter((r) => r.onChain > 0).length,
      totalKesDeposited: deposits.reduce((s, d) => s + Number(d.amount), 0),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
