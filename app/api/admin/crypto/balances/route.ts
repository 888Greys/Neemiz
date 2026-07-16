import { requireOwnerAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/crypto/balances
 *
 * System-wide crypto ledger snapshot: how much of each coin the platform owes
 * its users. Sums every `UserCryptoBalance` row by coin (available + locked),
 * plus the KES Coin total, which is backed directly by `User.walletBalance`
 * rather than by a crypto-balance row.
 */
export async function GET() {
  if (!(await requireOwnerAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [balances, kesAgg] = await Promise.all([
    db.userCryptoBalance.groupBy({
      by: ["crypto"],
      _sum: { available: true, locked: true },
      _count: { _all: true },
    }),
    // KES Coin is backed by the fiat wallet, not a UserCryptoBalance row.
    db.user.aggregate({ _sum: { walletBalance: true } }),
  ]);

  const coins = balances
    .map((b) => {
      const available = Number(b._sum.available ?? 0);
      const locked = Number(b._sum.locked ?? 0);
      return {
        crypto: b.crypto,
        available,
        locked,
        total: available + locked,
        holders: b._count._all,
      };
    })
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total);

  const kesTotal = Number(kesAgg._sum.walletBalance ?? 0);
  coins.push({
    crypto: "KES",
    available: kesTotal,
    locked: 0,
    total: kesTotal,
    holders: 0,
  });

  return Response.json(
    {
      coins,
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
