import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

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
      ad: { select: { fiat: true, paymentMethods: true } },
    },
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = order.seller.userId === dbUser.id;

  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Auto-expire PENDING orders whose window has passed
  if (order.status === "PENDING" && order.expiresAt && new Date(order.expiresAt) < new Date()) {
    await db.$transaction(async (tx) => {
      await tx.p2POrder.update({ where: { id }, data: { status: "EXPIRED" } });
      // Return locked crypto to merchant's available balance
      await tx.p2PCryptoBalance.updateMany({
        where: { merchantId: order.sellerId, crypto: order.crypto },
        data:  { locked: { decrement: Number(order.cryptoAmount) } },
      });
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
    isBuyer,
    isSeller,
  });
}
