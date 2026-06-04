import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { kesLockAmount } from "@/lib/p2p/crypto-balance";

// GET /api/p2p/merchant/balance — returns the merchant's escrow crypto balances (P2PCryptoBalance)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const merchant = await db.merchantProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true },
    });

    if (!merchant) return Response.json([]);

    const [balances, activeKesSellOrders] = await Promise.all([
      db.p2PCryptoBalance.findMany({
        where: { merchantId: merchant.id },
        select: { crypto: true, total: true, available: true, locked: true },
        orderBy: { crypto: "asc" },
      }),
      db.p2POrder.findMany({
        where: {
          sellerId: merchant.id,
          crypto: "KES",
          status: { in: ["PENDING", "PAID"] },
          ad: { side: "SELL" },
        },
        select: { cryptoAmount: true },
      }),
    ]);

    const rows = balances.map((b) => ({
      crypto:    b.crypto,
      total:     Number(b.total),
      available: Number(b.available),
      locked:    Number(b.locked),
    }));

    const kesLocked = activeKesSellOrders.reduce((sum, order) => sum + kesLockAmount(Number(order.cryptoAmount)), 0);
    rows.push({
      crypto:    "KES",
      total:     kesLocked,
      available: 0,
      locked:    kesLocked,
    });

    return Response.json(rows);
  } catch (err) {
    console.error("GET /api/p2p/merchant/balance:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
