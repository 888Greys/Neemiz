import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/cancel
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser   = await getOrCreateUser(user.id, { email: user.email });
  const order    = await db.p2POrder.findUnique({ where: { id } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = merchant && order.sellerId === merchant.id;

  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "PENDING") {
    return Response.json({ error: "Can only cancel PENDING orders" }, { status: 400 });
  }

  const { reason } = await req.json().catch(() => ({}));
  const cryptoAmt  = Number(order.cryptoAmount);

  await db.$transaction(async (tx) => {
    // 1. Mark cancelled
    const cancelled = await tx.p2POrder.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status:       "CANCELLED",
        cancelledBy:  dbUser.id,
        cancelReason: reason ?? null,
      },
    });
    if (cancelled.count === 0) return;

    // 2. Restore ad's available amount
    await tx.p2PAd.update({
      where: { id: order.adId },
      data:  { availableAmount: { increment: cryptoAmt } },
    });

    // Merchant crypto remains locked because the ad liquidity is available again.
  });

  // Notify the other party
  const notifyUserId = isBuyer ? order.sellerId : order.buyerId;
  // sellerId is a merchantProfileId, not userId — get the userId
  if (isBuyer) {
    const sellerProfile = await db.merchantProfile.findUnique({
      where:  { id: order.sellerId },
      select: { userId: true },
    });
    if (sellerProfile) {
      await db.notification.create({
        data: {
          userId: sellerProfile.userId,
          type:   "p2p_cancelled",
          title:  `Order cancelled`,
          body:   `Buyer cancelled order #${order.id.slice(0, 8).toUpperCase()}${reason ? `: ${reason}` : "."}`,
          link:   `/p2p/order/${order.id}`,
        },
      });
    }
  } else {
    await db.notification.create({
      data: {
        userId: order.buyerId,
        type:   "p2p_cancelled",
        title:  `Order cancelled by merchant`,
        body:   `Order #${order.id.slice(0, 8).toUpperCase()} was cancelled by the merchant${reason ? `: ${reason}` : "."}`,
        link:   `/p2p/order/${order.id}`,
      },
    });
  }

  return Response.json({ status: "CANCELLED" });
}
