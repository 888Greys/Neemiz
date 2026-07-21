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
import { defaultNetwork, unlockUserCrypto, kesLockAmount, isWalletBackedCoin, unlockWalletCoin, recordWalletCoinMovement } from "@/lib/p2p/crypto-balance";
import { createP2POrderEventMessage, orderExpiredSystemText, ORDER_EXPIRING_SOON_TEXT } from "@/lib/p2p/order-events";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // ── About-to-expire warnings ────────────────────────────────────────────────
  // PENDING orders with <=10 min left get a one-time "about to expire" system
  // message. Dedup by checking for an existing warning so repeated cron runs
  // (every ~2 min) don't spam it.
  let warned = 0;
  const soon = new Date(now.getTime() + 10 * 60 * 1000);
  const nearExpiry = await db.p2POrder.findMany({
    where:  { status: "PENDING", expiresAt: { gt: now, lte: soon } },
    select: { id: true, buyerId: true },
    take:   200,
  });
  for (const order of nearExpiry) {
    try {
      const already = await db.p2PMessage.count({
        where: { orderId: order.id, isSystem: true, content: ORDER_EXPIRING_SOON_TEXT },
      });
      if (already > 0) continue;
      await db.p2PMessage.create({
        data: { orderId: order.id, senderId: order.buyerId, isSystem: true, content: ORDER_EXPIRING_SOON_TEXT },
      });
      warned++;
    } catch { /* non-critical */ }
  }

  const stale = await db.p2POrder.findMany({
    where:  { status: "PENDING", expiresAt: { lt: now } },
    include: { ad: { select: { side: true, feeRate: true } } },
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

        if (isWalletBackedCoin(order.crypto)) {
          const giverUserId = order.ad.side === "SELL"
            ? (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId
            : order.buyerId;
          if (giverUserId) {
            const refundAmount = kesLockAmount(amt);
            await unlockWalletCoin(tx, giverUserId, order.crypto, refundAmount);
            await recordWalletCoinMovement(tx, {
              userId: giverUserId,
              crypto: order.crypto,
              amount: refundAmount,
              action: "refund",
              orderId: order.id,
              role: "giver",
            });
          }
        } else if (order.ad.side === "BUY") {
          await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), amt);
        } else if (order.ad.side === "SELL") {
          // On-chain crypto: refund merchant's per-order escrow lock
          const feeRate = Number(order.ad.feeRate ?? 0.02);
          const lockAmount = amt * (1 + feeRate);
          const merchantUserId = (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId;
          if (merchantUserId) {
            await unlockUserCrypto(tx, merchantUserId, order.crypto, defaultNetwork(order.crypto), lockAmount);
          }
        }
        await createP2POrderEventMessage(tx, {
          orderId: order.id,
          senderId: order.buyerId,
          content: orderExpiredSystemText(order.crypto),
        });
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

  // ── Auto-cancel PAID orders whose payment was never verified ────────────────
  // 2026-07-20 hardening: fake mark-paid orders (empty paymentRef — no M-Pesa
  // ever sent) used to sit PAID indefinitely with the seller's escrow locked,
  // waiting for a self-release by a ring partner. After
  // P2P_UNVERIFIED_PAID_TTL_HOURS (default 6h) with no reference, cancel and
  // refund the giver — same restore logic as a dispute refund.
  const unverifiedTtlHours = Number(process.env.P2P_UNVERIFIED_PAID_TTL_HOURS ?? "6");
  let autoCancelled = 0;
  if (unverifiedTtlHours > 0) {
    const cutoff = new Date(now.getTime() - unverifiedTtlHours * 60 * 60 * 1000);
    const unverified = await db.p2POrder.findMany({
      where: {
        status: "PAID",
        paidAt:  { lt: cutoff },
        OR:      [{ paymentRef: null }, { paymentRef: "" }],
      },
      include: { ad: { select: { side: true, feeRate: true } } },
      take:    100,
    });

    for (const order of unverified) {
      try {
        const didCancel = await db.$transaction(async (tx) => {
          // Guarded flip — only the worker that moves PAID→CANCELLED owns the restore
          const res = await tx.p2POrder.updateMany({
            where: { id: order.id, status: "PAID" },
            data:  {
              status:       "CANCELLED",
              cancelledBy:  "system:auto-unverified",
              cancelReason: `Auto-cancelled: payment was marked ${unverifiedTtlHours}h+ ago but no payment reference was ever provided.`,
            },
          });
          if (res.count === 0) return false;

          const amt = Number(order.cryptoAmount);
          await tx.p2PAd.update({
            where: { id: order.adId },
            data:  { availableAmount: { increment: amt } },
          });

          if (isWalletBackedCoin(order.crypto)) {
            const giverUserId = order.ad.side === "SELL"
              ? (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId
              : order.buyerId;
            if (giverUserId) {
              const refundAmount = kesLockAmount(amt);
              await unlockWalletCoin(tx, giverUserId, order.crypto, refundAmount);
              await recordWalletCoinMovement(tx, {
                userId: giverUserId,
                crypto: order.crypto,
                amount: refundAmount,
                action: "refund",
                orderId: order.id,
                role: "giver",
              });
            }
          } else if (order.ad.side === "BUY") {
            await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), amt);
          } else if (order.ad.side === "SELL") {
            const feeRate = Number(order.ad.feeRate ?? 0.02);
            const lockAmount = amt * (1 + feeRate);
            const merchantUserId = (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId;
            if (merchantUserId) {
              await unlockUserCrypto(tx, merchantUserId, order.crypto, defaultNetwork(order.crypto), lockAmount);
            }
          }
          await createP2POrderEventMessage(tx, {
            orderId: order.id,
            senderId: order.buyerId,
            content: "This trade was auto-cancelled: the payment was marked without a transaction reference and was never verified. Any reserved funds were returned to the coin holder.",
          });
          return true;
        });

        if (!didCancel) continue;
        autoCancelled++;

        await db.notification.create({
          data: {
            userId: order.buyerId,
            type:   "p2p_cancelled",
            title:  "Order auto-cancelled",
            body:   `Order #${order.id.slice(0, 8).toUpperCase()} was auto-cancelled: the payment was never verified (missing reference).`,
            link:   `/p2p/order/${order.id}`,
          },
        }).catch(() => {});
      } catch (e) {
        errors.push(`unverified ${order.id}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }

  return Response.json({
    ok: true,
    scanned: stale.length,
    warned,
    expired,
    autoCancelled,
    deactivatedUnbackedLocalCoinMerchants: 0,
    errors,
  });
}
