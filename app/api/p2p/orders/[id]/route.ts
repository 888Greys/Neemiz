import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, unlockUserCrypto, isKesCoin, unlockKesCoinBalance, kesLockAmount, recordKesWalletMovement } from "@/lib/p2p/crypto-balance";

export const dynamic = "force-dynamic";

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
      buyer: { select: { id: true, firstName: true, lastName: true, username: true } },
      ad: { select: { fiat: true, paymentMethods: true, side: true, terms: true } },
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

  return Response.json({
    id:              order.id,
    status:          order.status,
    crypto:          order.crypto,
    cryptoAmount:    Number(order.cryptoAmount),
    fiatAmount:      Number(order.fiatAmount),
    pricePerUnit:    Number(order.pricePerUnit),
    paymentMethod:   order.paymentMethod,
    expiresAt:       order.expiresAt,
    createdAt:       order.createdAt,
    paidAt:          order.paidAt,
    releasedAt:      order.releasedAt,
    cancelReason:    order.cancelReason,
    buyer:  order.buyer,
    seller: {
      displayName: order.seller.displayName,
      userId:      order.seller.userId,
      // Match the order's payment rail to the seller's saved details. We store
      // the rail code in `name`, so match on that first; fall back to the
      // MPESA/BANK enum type for older records.
      paymentMethod: (
        order.seller.paymentMethods.find((pm) => pm.name?.toLowerCase() === order.paymentMethod.toLowerCase())
        ?? order.seller.paymentMethods.find((pm) => pm.type.toLowerCase() === order.paymentMethod.toLowerCase())
      ) ?? null,
    },
    ad:     order.ad,
    side:            order.ad.side,
    isBuyer,
    isSeller,
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
