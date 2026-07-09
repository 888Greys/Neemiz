import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { totalUsdtEquivalent, usdtPerUnit } from "@/lib/crypto-usdt";

// GET /api/crypto/balance — on-platform crypto balances + USDT-equivalent total
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const balances = await db.userCryptoBalance.findMany({
    where:   { userId: dbUser.id, NOT: { crypto: "KES", network: "KES" } },
    orderBy: { crypto: "asc" },
    select: {
      crypto:    true,
      network:   true,
      available: true,
      locked:    true,
      updatedAt: true,
    },
  });

  const rows = balances.map((b) => ({
    crypto:    b.crypto,
    network:   b.network,
    available: Number(b.available),
    locked:    Number(b.locked),
    total:     Number(b.available) + Number(b.locked),
    updatedAt: b.updatedAt,
  }));

  const { totalUsdt } = await totalUsdtEquivalent(rows);

  // Per-row USDT value for Send/Withdraw pickers (optional UI).
  const rateCache = new Map<string, number | null>();
  const withUsdt = await Promise.all(rows.map(async (b) => {
    const c = b.crypto.toUpperCase();
    let rate = rateCache.get(c);
    if (rate === undefined) {
      rate = await usdtPerUnit(c);
      rateCache.set(c, rate);
    }
    const usdtValue = rate != null && rate > 0 ? b.total * rate : null;
    return { ...b, usdtValue };
  }));

  return Response.json(
    {
      balances: withUsdt,
      totalUsdt,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
  );
}
