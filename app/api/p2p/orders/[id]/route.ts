import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, unlockUserCrypto, isKesCoin, unlockKesCoinBalance, kesLockAmount, kesPayoutAmount, recordKesWalletMovement } from "@/lib/p2p/crypto-balance";

export const dynamic = "force-dynamic";

function isFeedbackMigrationPending(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "P2021" || error.code === "P2022");
}

// GET /api/p2p/orders/[id] — fetch single order (buyer or seller only)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const order = await db.p2POrder.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          displayName: true,
          userId: true,
          paymentMethods: {
            where: { isActive: true },
            select: { type: true, accountName: true, accountNo: true, bankName: true, name: true },
          },
        },
      },
      buyer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          merchantProfile: {
            select: {
              displayName: true,
              paymentMethods: {
                where: { isActive: true },
                select: { type: true, accountName: true, accountNo: true, bankName: true, name: true },
              },
            },
          },
        },
      },
      ad: { select: { fiat: true, paymentMethods: true, paymentWindow: true, side: true, terms: true } },
    },
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = order.seller.userId === dbUser.id;

  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Auto-expire PENDING orders whose window has passed
  if (order.status === "PENDING" && order.expiresAt && new Date(order.expiresAt) < new Date()) {
    await db.$transaction(async (tx) => {
      const expired = await tx.p2POrder.updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED" } });
      if (expired.count === 0) return;
      // Return the reserved ad amount; merchant crypto remains locked while the ad is active.
      await tx.p2PAd.update({
        where: { id: order.adId },
        data:  { availableAmount: { increment: Number(order.cryptoAmount) } },
      });
      if (isKesCoin(order.crypto)) {
        const giverUserId = order.ad.side === "SELL" ? order.seller.userId : order.buyerId;
        const refundAmount = kesLockAmount(Number(order.cryptoAmount));
        await unlockKesCoinBalance(tx, giverUserId, refundAmount);
        await recordKesWalletMovement(tx, {
          userId: giverUserId,
          amount: refundAmount,
          action: "refund",
          orderId: order.id,
          role: "giver",
        });
      } else if (order.ad.side === "BUY") {
        await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), Number(order.cryptoAmount));
      }
    });
    order.status = "EXPIRED" as typeof order.status;
  }

  const merchantPaymentMethod = (
    order.seller.paymentMethods.find((pm) => pm.name?.toLowerCase() === order.paymentMethod.toLowerCase())
    ?? order.seller.paymentMethods.find((pm) => pm.type.toLowerCase() === order.paymentMethod.toLowerCase())
  ) ?? null;
  const takerPaymentMethod = (
    order.buyer.merchantProfile?.paymentMethods.find((pm) => pm.name?.toLowerCase() === order.paymentMethod.toLowerCase())
    ?? order.buyer.merchantProfile?.paymentMethods.find((pm) => pm.type.toLowerCase() === order.paymentMethod.toLowerCase())
  ) ?? null;
  const buyer = {
    id: order.buyer.id,
    firstName: order.buyer.firstName,
    lastName: order.buyer.lastName,
    username: order.buyer.username,
  };
  const takerDisplayName = order.buyer.firstName
    ? `${order.buyer.firstName} ${order.buyer.lastName ?? ""}`.trim()
    : order.buyer.username ?? order.buyer.merchantProfile?.displayName ?? "Trader";
  const paymentRecipient = order.ad.side === "SELL"
    ? { displayName: order.seller.displayName, paymentMethod: merchantPaymentMethod }
    : { displayName: takerDisplayName, paymentMethod: takerPaymentMethod };
  const cryptoAmount = Number(order.cryptoAmount);
  const netCryptoAmount = isKesCoin(order.crypto)
    ? kesPayoutAmount(cryptoAmount)
    : parseFloat((cryptoAmount * 0.98).toFixed(8));
  const myFeedback = await db.p2PFeedback.findFirst({
    where: { orderId: order.id, fromUserId: dbUser.id },
    select: { rating: true, comment: true, createdAt: true },
  }).catch((error) => {
    if (isFeedbackMigrationPending(error)) return null;
    throw error;
  });

  return Response.json({
    id:              order.id,
    status:          order.status,
    crypto:          order.crypto,
    cryptoAmount,
    netCryptoAmount,
    p2pFeeAmount:    parseFloat((cryptoAmount - netCryptoAmount).toFixed(8)),
    fiatAmount:      Number(order.fiatAmount),
    pricePerUnit:    Number(order.pricePerUnit),
    paymentMethod:   order.paymentMethod,
    expiresAt:       order.expiresAt,
    createdAt:       order.createdAt,
    paidAt:          order.paidAt,
    releasedAt:      order.releasedAt,
    cancelReason:    order.cancelReason,
    merchantId:      order.sellerId,
    buyer,
    seller: {
      displayName: order.seller.displayName,
      userId:      order.seller.userId,
      paymentMethod: merchantPaymentMethod,
    },
    paymentRecipient,
    ad:     order.ad,
    side:            order.ad.side,
    isBuyer,
    isSeller,
    myFeedback,
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
