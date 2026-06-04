import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import {
  creditUserCrypto,
  defaultNetwork,
  isKesCoin,
  kesLockAmount,
  kesPayoutAmount,
  recordKesWalletMovement,
  releaseKesCoinBalance,
  unlockKesCoinBalance,
  unlockUserCrypto,
} from "@/lib/p2p/crypto-balance";

// POST /api/admin/p2p/disputes/[id] — resolve a dispute
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { resolution, note } = body as { resolution: "BUYER_WINS" | "SELLER_WINS"; note: string };

  if (!["BUYER_WINS", "SELLER_WINS"].includes(resolution)) {
    return Response.json({ error: "Invalid resolution. Use 'BUYER_WINS' or 'SELLER_WINS'." }, { status: 400 });
  }

  const dispute = await db.p2PDispute.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          adId: true,
          buyerId: true,
          crypto: true,
          cryptoAmount: true,
          fiatAmount: true,
          ad: { select: { side: true } },
          seller: { select: { userId: true } },
        },
      },
    },
  });
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status !== "OPEN") return Response.json({ error: "Dispute is not open" }, { status: 400 });

  const { order } = dispute;
  const buyerId = order.buyerId;
  const sellerUserId = order.seller.userId;
  const orderRef = `#${order.id.slice(0, 8).toUpperCase()}`;
  const cryptoAmt = Number(order.cryptoAmount);
  const kesGiverUserId = order.ad.side === "SELL" ? sellerUserId : buyerId;
  const kesReceiverUserId = order.ad.side === "SELL" ? buyerId : sellerUserId;

  await db.$transaction(async (tx) => {
    // Update dispute
    await tx.p2PDispute.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolution: note,
        resolvedAt: new Date(),
      },
    });

    if (resolution === "SELLER_WINS") {
      // Cancel the order
      await tx.p2POrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
      await tx.p2PAd.update({
        where: { id: order.adId },
        data:  { availableAmount: { increment: cryptoAmt } },
      });

      if (isKesCoin(order.crypto)) {
        const refundAmount = kesLockAmount(cryptoAmt);
        await unlockKesCoinBalance(tx, kesGiverUserId, refundAmount);
        await recordKesWalletMovement(tx, {
          userId: kesGiverUserId,
          amount: refundAmount,
          action: "refund",
          orderId: order.id,
          role: "giver",
        });
      } else if (order.ad.side === "BUY") {
        await unlockUserCrypto(tx, buyerId, order.crypto, defaultNetwork(order.crypto), cryptoAmt);
      }

      // Notify buyer
      await tx.notification.create({
        data: {
          userId: buyerId,
          type: "p2p_dispute",
          title: `Dispute resolved — Seller wins`,
          body: `The dispute for order ${orderRef} was resolved in favour of the seller. The order has been cancelled.${note ? ` Admin note: ${note}` : ""}`,
          link: `/p2p/order/${order.id}`,
        },
      });

      // Notify seller
      await tx.notification.create({
        data: {
          userId: sellerUserId,
          type: "p2p_dispute",
          title: `Dispute resolved in your favour`,
          body: `The dispute for order ${orderRef} was resolved in your favour. The order has been cancelled.${note ? ` Admin note: ${note}` : ""}`,
          link: `/p2p/order/${order.id}`,
        },
      });
    } else {
      // BUYER_WINS — release the locked crypto, mark order RELEASED
      const network   = defaultNetwork(order.crypto);

      await tx.p2POrder.update({
        where: { id: order.id },
        data: { status: "RELEASED", escrowReleased: true, releasedAt: new Date() },
      });

      if (isKesCoin(order.crypto)) {
        const payoutAmount = kesPayoutAmount(cryptoAmt);
        await releaseKesCoinBalance(tx, kesGiverUserId, kesReceiverUserId, kesLockAmount(cryptoAmt), payoutAmount);
        await recordKesWalletMovement(tx, {
          userId: kesReceiverUserId,
          amount: payoutAmount,
          action: "release",
          orderId: order.id,
          role: "receiver",
        });
      } else {
        // Deduct from merchant's P2PCryptoBalance (locked + total)
        const sellerMerchant = await tx.merchantProfile.findUnique({
          where: { userId: sellerUserId },
        });
        if (sellerMerchant) {
          await tx.p2PCryptoBalance.updateMany({
            where: { merchantId: sellerMerchant.id, crypto: order.crypto },
            data:  { locked: { decrement: cryptoAmt }, total: { decrement: cryptoAmt } },
          });
        }

        // Credit buyer's UserCryptoBalance (works for any user)
        await creditUserCrypto(tx, buyerId, order.crypto, network, cryptoAmt);
      }

      // Notify buyer
      await tx.notification.create({
        data: {
          userId: buyerId,
          type:   "p2p_dispute",
          title:  `Dispute resolved — Buyer wins`,
          body:   `The dispute for order ${orderRef} was resolved in your favour. Your ${order.crypto} has been released.${note ? ` Admin note: ${note}` : ""}`,
          link:   `/p2p/order/${order.id}`,
        },
      });

      // Notify seller
      await tx.notification.create({
        data: {
          userId: sellerUserId,
          type:   "p2p_dispute",
          title:  `Dispute resolved — Buyer wins`,
          body:   `The dispute for order ${orderRef} was resolved in favour of the buyer.${note ? ` Admin note: ${note}` : ""}`,
          link:   `/p2p/order/${order.id}`,
        },
      });
    }
  });

  return Response.json({ ok: true, resolution });
}
