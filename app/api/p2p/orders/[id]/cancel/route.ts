import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, unlockUserCrypto, isKesCoin, creditWalletKes } from "@/lib/p2p/crypto-balance";

// POST /api/p2p/orders/[id]/cancel
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const order    = await db.p2POrder.findUnique({ where: { id }, include: { ad: true } });
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    const isBuyer  = order.buyerId === dbUser.id;
    const isSeller = merchant && order.sellerId === merchant.id;

    if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PENDING") {
      return Response.json({ error: "Can only cancel PENDING orders" }, { status: 400 });
    }

    const { reason } = await req.json().catch(() => ({})) as { reason?: string };
    const cryptoAmt  = Number(order.cryptoAmount);

    await db.$transaction(async (tx) => {
      const cancelled = await tx.p2POrder.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status:       "CANCELLED",
          cancelledBy:  dbUser.id,
          cancelReason: reason ?? null,
        },
      });
      if (cancelled.count === 0) return;

      await tx.p2PAd.update({
        where: { id: order.adId },
        data:  { availableAmount: { increment: cryptoAmt } },
      });
      if (isKesCoin(order.crypto)) {
        // Refund the escrowed KES to whoever gave it (merchant on SELL, taker on BUY).
        const giverUserId = order.ad.side === "SELL"
          ? (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId
          : order.buyerId;
        if (giverUserId) await creditWalletKes(tx, giverUserId, cryptoAmt);
      } else if (order.ad.side === "BUY") {
        await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), cryptoAmt);
      }
    });

    // Notify the other party (outside transaction — non-critical)
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
            title:  "Order cancelled",
            body:   `Buyer cancelled order #${order.id.slice(0, 8).toUpperCase()}${reason ? `: ${reason}` : "."}`,
            link:   `/p2p/order/${order.id}`,
          },
        }).catch(() => {});
      }
    } else {
      await db.notification.create({
        data: {
          userId: order.buyerId,
          type:   "p2p_cancelled",
          title:  "Order cancelled by merchant",
          body:   `Order #${order.id.slice(0, 8).toUpperCase()} was cancelled by the merchant${reason ? `: ${reason}` : "."}`,
          link:   `/p2p/order/${order.id}`,
        },
      }).catch(() => {});
    }

    return Response.json({ status: "CANCELLED" });
  } catch (err) {
    console.error("POST /api/p2p/orders/[id]/cancel:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
