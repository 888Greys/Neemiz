import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, unlockUserCrypto } from "@/lib/p2p/crypto-balance";

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
      seller: { select: { displayName: true, userId: true } },
      buyer: { select: { id: true, firstName: true, lastName: true, username: true } },
      ad: { select: { fiat: true, paymentMethods: true, side: true } },
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
      if (order.ad.side === "BUY") {
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
    buyer:           order.buyer,
    seller:          order.seller,
    ad:              order.ad,
    side:            order.ad.side,
    isBuyer,
    isSeller,
  });
}
