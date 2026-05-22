import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/paid — buyer marks payment done
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const order  = await db.p2POrder.findUnique({ where: { id } });

    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    if (order.buyerId !== dbUser.id) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PENDING") return Response.json({ error: "Order is not in PENDING state" }, { status: 400 });
    if (new Date() > order.expiresAt) return Response.json({ error: "Order has expired" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { paymentRef, paymentProofUrl } = body as Record<string, string | undefined>;

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.p2POrder.update({
        where: { id },
        data: {
          status:          "PAID",
          paymentRef:      paymentRef ?? null,
          paymentProofUrl: paymentProofUrl ?? null,
          paidAt:          new Date(),
        },
      });

      const merchantUser = await tx.merchantProfile.findUnique({
        where: { id: order.sellerId },
        select: { userId: true, displayName: true },
      });
      if (merchantUser) {
        await tx.notification.create({
          data: {
            userId: merchantUser.userId,
            type:   "p2p_paid",
            title:  "Payment received — release crypto",
            body:   `Buyer has marked payment of KSh ${Number(order.fiatAmount).toLocaleString()} for order #${order.id.slice(0, 8).toUpperCase()}. Verify and release.`,
            link:   `/p2p/order/${order.id}`,
          },
        });
      }

      return result;
    });

    return Response.json({ status: updated.status });
  } catch (err) {
    console.error("POST /api/p2p/orders/[id]/paid:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
