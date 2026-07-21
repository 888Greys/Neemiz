import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendP2POrderStatusEmail, waitForEmailDelivery } from "@/lib/brevo";
import { createP2POrderEventMessage } from "@/lib/p2p/order-events";
import { normalizePaymentRef, isValidPaymentRef, paymentRefError } from "@/lib/p2p/payment-ref";

// POST /api/p2p/orders/[id]/paid — buyer marks payment done
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const order  = await db.p2POrder.findUnique({
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
    const isMerchantBuy = order.ad.side === "BUY";
    const canMarkPaid = isMerchantBuy ? order.seller.userId === dbUser.id : order.buyerId === dbUser.id;
    if (!canMarkPaid) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PENDING") return Response.json({ error: "Order is not in PENDING state" }, { status: 400 });
    if (new Date() > order.expiresAt) return Response.json({ error: "Order has expired" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { paymentRef, paymentProofUrl } = body as Record<string, string | undefined>;

    // 2026-07-20 hardening: a real payment reference is mandatory. Ring accounts
    // marked orders "paid" with an empty ref (no M-Pesa sent), then self-released
    // the escrow from a linked merchant account.
    const ref = normalizePaymentRef(paymentRef);
    if (!isValidPaymentRef(ref, order.paymentMethod)) {
      return Response.json({ error: paymentRefError(order.paymentMethod), code: "PAYMENT_REF_REQUIRED" }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.p2POrder.updateMany({
        where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: {
          status:          "PAID",
          paymentRef:      ref,
          paymentProofUrl: paymentProofUrl ?? null,
          paidAt:          new Date(),
        },
      });
      if (result.count === 0) throw new Error("ORDER_STATE_CHANGED");

      if (isMerchantBuy) {
        await tx.notification.create({
          data: {
            userId: order.buyerId,
            type:   "p2p_paid",
            title:  "Merchant marked fiat as paid",
            body:   `${order.seller.displayName} marked KSh ${Number(order.fiatAmount).toLocaleString()} as paid for order #${order.id.slice(0, 8).toUpperCase()}. Verify and release crypto.`,
            link:   `/p2p/order/${order.id}`,
          },
        });
      } else {
        await tx.notification.create({
          data: {
            userId: order.seller.userId,
            type:   "p2p_paid",
            title:  "Payment received — release crypto",
            body:   `Buyer has marked payment of KSh ${Number(order.fiatAmount).toLocaleString()} for order #${order.id.slice(0, 8).toUpperCase()}. Verify and release.`,
            link:   `/p2p/order/${order.id}`,
          },
        });
      }

      await createP2POrderEventMessage(tx, {
        orderId: order.id,
        senderId: dbUser.id,
        content: `Payment marked completed. Reference: ${ref}`,
      });

      return "PAID" as const;
    });

    const recipient = isMerchantBuy ? order.buyer : order.seller.user;
    const recipientName = recipient.firstName ?? recipient.username ?? order.seller.displayName ?? "Trader";
    await waitForEmailDelivery("P2P payment marked", [recipient.email
      ? sendP2POrderStatusEmail(recipient.email, recipientName, {
          orderId: order.id,
          subject: `Payment marked for P2P order #${order.id.slice(0, 8).toUpperCase()}`,
          title: "Payment has been marked as sent",
          message: "The fiat payer marked this order as paid. Verify the funds in your own account before releasing crypto.",
          crypto: order.crypto,
          cryptoAmount: Number(order.cryptoAmount),
          fiat: order.ad.fiat,
          fiatAmount: Number(order.fiatAmount),
          accent: "#05b957",
          actionLabel: "Verify Payment →",
        })
      : null]);

    return Response.json({ status: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "ORDER_STATE_CHANGED") {
      return Response.json({ error: "Order expired or was cancelled before payment could be marked." }, { status: 409 });
    }
    console.error("POST /api/p2p/orders/[id]/paid:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
