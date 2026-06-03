/**
 * Cron endpoint: expires PENDING P2P orders whose payment window has passed and
 * restores the reserved funds. Without this, an order that neither party reopens
 * stays PENDING forever — keeping ad availability reduced and (for BUY ads) the
 * buyer's crypto locked indefinitely.
 *
 * The order detail page also expires lazily on view; this sweep is the safety
 * net for orders nobody reopens. VPS cron should run it every ~2 minutes.
 *
 * Fund-restore logic mirrors the cancel route exactly:
 *  - SELL ad: return the reserved amount to the ad (merchant crypto stays locked
 *    against the ad itself, which is correct).
 *  - BUY ad: unlock the buyer's escrowed crypto.
 */
import { db } from "@/lib/db";
import { defaultNetwork, unlockUserCrypto, isKesCoin, unlockKesCoinBalance, kesLockAmount } from "@/lib/p2p/crypto-balance";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const stale = await db.p2POrder.findMany({
    where:  { status: "PENDING", expiresAt: { lt: now } },
    include: { ad: { select: { side: true } } },
    take:   200,
  });

  let expired = 0;
  const errors: string[] = [];

  for (const order of stale) {
    try {
      const didExpire = await db.$transaction(async (tx) => {
        // Guarded update — only this worker that flips PENDING→EXPIRED owns the restore
        const res = await tx.p2POrder.updateMany({
          where: { id: order.id, status: "PENDING" },
          data:  { status: "EXPIRED" },
        });
        if (res.count === 0) return false;

        const amt = Number(order.cryptoAmount);
        await tx.p2PAd.update({
          where: { id: order.adId },
          data:  { availableAmount: { increment: amt } },
        });

        if (isKesCoin(order.crypto)) {
          const giverUserId = order.ad.side === "SELL"
            ? (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId
            : order.buyerId;
          if (giverUserId) await unlockKesCoinBalance(tx, giverUserId, kesLockAmount(amt));
        } else if (order.ad.side === "BUY") {
          await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), amt);
        }
        return true;
      });

      if (!didExpire) continue;
      expired++;

      // Notify the buyer (non-critical, outside the transaction)
      await db.notification.create({
        data: {
          userId: order.buyerId,
          type:   "p2p_expired",
          title:  "Order expired",
          body:   `Order #${order.id.slice(0, 8).toUpperCase()} expired because payment was not completed in time.`,
          link:   `/p2p/order/${order.id}`,
        },
      }).catch(() => {});
    } catch (e) {
      errors.push(`${order.id}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({ ok: true, scanned: stale.length, expired, errors });
}
