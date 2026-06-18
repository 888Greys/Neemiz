import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { defaultNetwork, unlockUserCrypto, isKesCoin, unlockKesCoinBalance, kesLockAmount, recordKesWalletMovement } from "@/lib/p2p/crypto-balance";
import { getP2PCancellationUsage } from "@/lib/p2p/cancellation-policy";
import { sendP2POrderStatusEmail, waitForEmailDelivery } from "@/lib/brevo";
import { createP2POrderEventMessage } from "@/lib/p2p/order-events";

// POST /api/p2p/orders/[id]/cancel
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const order = await db.p2POrder.findUnique({
      where: { id },
      include: {
        ad: true,
        buyer: { select: { email: true, firstName: true, username: true } },
        seller: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { email: true, firstName: true, username: true } },
          },
        },
      },
    });
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    const isBuyer  = order.buyerId === dbUser.id;
    const isSeller = Boolean(merchant && order.sellerId === merchant.id);

    if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PENDING") {
      return Response.json({
        error: order.status === "PAID" || order.status === "DISPUTED"
          ? "Payment has been marked. Open a dispute instead of cancelling."
          : "This order can no longer be cancelled.",
      }, { status: 409 });
    }

    const { reason } = await req.json().catch(() => ({})) as { reason?: string };
    if (!reason?.trim()) {
      return Response.json({ error: "Select or enter a cancellation reason." }, { status: 400 });
    }

    // The fiat payer is the only party allowed to cancel before payment.
    // SELL ad: taker/buyer pays fiat. BUY ad: merchant pays fiat.
    const isFiatPayer = order.ad.side === "SELL" ? isBuyer : isSeller;
    if (!isFiatPayer) {
      return Response.json({
        error: "The crypto seller cannot cancel an open order. Wait for payment, expiry, or open a dispute after payment is marked.",
      }, { status: 403 });
    }

    const usage = await getP2PCancellationUsage(dbUser.id);
    if (usage.restricted) {
      return Response.json({
        error: "You have reached today's P2P cancellation limit.",
        code: "P2P_DAILY_CANCELLATION_LIMIT",
        resetsAt: usage.resetsAt.toISOString(),
      }, { status: 429 });
    }
    const cryptoAmt  = Number(order.cryptoAmount);

    await db.$transaction(async (tx) => {
      const cancelled = await tx.p2POrder.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status:       "CANCELLED",
          cancelledBy:  dbUser.id,
          cancelReason: reason.trim(),
        },
      });
      if (cancelled.count === 0) return;

      await tx.p2PAd.update({
        where: { id: order.adId },
        data:  { availableAmount: { increment: cryptoAmt } },
      });
      if (isKesCoin(order.crypto)) {
        // Refund the escrowed KES Coin fiat backing to whoever gave it.
        const giverUserId = order.ad.side === "SELL"
          ? (await tx.merchantProfile.findUnique({ where: { id: order.sellerId }, select: { userId: true } }))?.userId
          : order.buyerId;
        if (giverUserId) {
          const refundAmount = kesLockAmount(cryptoAmt);
          await unlockKesCoinBalance(tx, giverUserId, refundAmount);
          await recordKesWalletMovement(tx, {
            userId: giverUserId,
            amount: refundAmount,
            action: "refund",
            orderId: order.id,
            role: "giver",
          });
        }
      } else if (order.ad.side === "BUY") {
        await unlockUserCrypto(tx, order.buyerId, order.crypto, defaultNetwork(order.crypto), cryptoAmt);
      }
      await createP2POrderEventMessage(tx, {
        orderId: order.id,
        senderId: dbUser.id,
        content: `Order cancelled. Reason: ${reason.trim()}`,
      });
    });

    // Notify the other party (outside transaction — non-critical)
    if (isBuyer) {
      if (order.seller) {
        await db.notification.create({
          data: {
            userId: order.seller.userId,
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

    const recipient = isBuyer ? order.seller.user : order.buyer;
    const recipientName = recipient.firstName ?? recipient.username ?? order.seller.displayName ?? "Trader";
    await waitForEmailDelivery("P2P cancellation", [recipient.email
      ? sendP2POrderStatusEmail(recipient.email, recipientName, {
          orderId: order.id,
          subject: `P2P order #${order.id.slice(0, 8).toUpperCase()} was cancelled`,
          title: "Order cancelled",
          message: `The other party cancelled this order. Reason: ${reason.trim()}`,
          crypto: order.crypto,
          cryptoAmount: Number(order.cryptoAmount),
          fiat: order.ad.fiat,
          fiatAmount: Number(order.fiatAmount),
          accent: "#e53e3e",
          actionLabel: "View Order →",
        })
      : null]);

    return Response.json({
      status: "CANCELLED",
      cancellationCount: usage.count + 1,
      restricted: usage.count + 1 >= usage.limit,
      resetsAt: usage.resetsAt.toISOString(),
    });
  } catch (err) {
    console.error("POST /api/p2p/orders/[id]/cancel:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
