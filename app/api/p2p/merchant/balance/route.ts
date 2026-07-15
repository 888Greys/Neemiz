import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { creditUserCrypto, defaultNetwork, kesLockAmount } from "@/lib/p2p/crypto-balance";
import { TransactionStatus, TransactionType } from "@prisma/client";

/**
 * GET /api/p2p/merchant/balance
 *
 * One-wallet model: returns the merchant user's UserCryptoBalance rows (plus
 * synthetic KES locked from open KES sell orders). Any leftover *available*
 * balance sitting in legacy P2PCryptoBalance is drained back into the wallet
 * automatically so merchants aren't stuck with unusable escrow funds.
 */
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

    // Drain legacy escrow *available* (not locked — locked still backs open ads)
    // back into the user wallet once.
    const legacyEscrow = await db.p2PCryptoBalance.findMany({
      where: { merchantId: merchant.id, available: { gt: 0 } },
      select: { crypto: true, available: true },
    });
    for (const row of legacyEscrow) {
      const amt = Number(row.available);
      if (!(amt > 0)) continue;
      const network = defaultNetwork(row.crypto);
      try {
        await db.$transaction(async (tx) => {
          const moved = await tx.p2PCryptoBalance.updateMany({
            where: {
              merchantId: merchant.id,
              crypto: row.crypto,
              available: { gte: amt },
            },
            data: {
              available: { decrement: amt },
              total: { decrement: amt },
            },
          });
          if (moved.count === 0) return;
          await creditUserCrypto(tx, dbUser.id, row.crypto, network, amt);
          await tx.transaction.create({
            data: {
              userId: dbUser.id,
              type: TransactionType.DEPOSIT,
              amount: amt,
              currency: row.crypto,
              status: TransactionStatus.COMPLETED,
              reference: `escrow-drain-${row.crypto}-${Date.now()}`,
              provider: "merchant_escrow",
              metadata: { action: "auto_drain_to_wallet", crypto: row.crypto, network, cryptoAmount: amt },
            },
          });
        });
      } catch (err) {
        console.error("escrow auto-drain failed:", row.crypto, err);
      }
    }

    const [walletRows, legacyLocked, activeKesSellOrders] = await Promise.all([
      db.userCryptoBalance.findMany({
        where: { userId: dbUser.id },
        select: { crypto: true, network: true, available: true, locked: true },
        orderBy: { crypto: "asc" },
      }),
      db.p2PCryptoBalance.findMany({
        where: { merchantId: merchant.id, locked: { gt: 0 } },
        select: { crypto: true, locked: true },
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

    // Aggregate by crypto (sum networks) for the merchant UI.
    const byCrypto = new Map<string, { available: number; locked: number }>();
    for (const b of walletRows) {
      const cur = byCrypto.get(b.crypto) ?? { available: 0, locked: 0 };
      cur.available += Number(b.available);
      cur.locked += Number(b.locked);
      byCrypto.set(b.crypto, cur);
    }
    // Surface legacy escrow locks so active old ads still show reserved funds.
    for (const b of legacyLocked) {
      const cur = byCrypto.get(b.crypto) ?? { available: 0, locked: 0 };
      cur.locked += Number(b.locked);
      byCrypto.set(b.crypto, cur);
    }

    const rows = [...byCrypto.entries()].map(([crypto, v]) => ({
      crypto,
      total: v.available + v.locked,
      available: v.available,
      locked: v.locked,
    }));

    const kesLocked = activeKesSellOrders.reduce(
      (sum, order) => sum + kesLockAmount(Number(order.cryptoAmount)),
      0,
    );
    rows.push({
      crypto: "KES",
      total: kesLocked,
      available: 0,
      locked: kesLocked,
    });

    return Response.json(rows);
  } catch (err) {
    console.error("GET /api/p2p/merchant/balance:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
