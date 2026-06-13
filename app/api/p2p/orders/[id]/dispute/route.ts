import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/dispute — either party can raise a dispute after buyer marks paid
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const order = await db.p2POrder.findUnique({
      where: { id },
      include: { seller: { select: { userId: true } } },
    });

    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    const isBuyer  = order.buyerId === dbUser.id;
    const isSeller = order.seller.userId === dbUser.id;

    if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (order.status !== "PAID") return Response.json({ error: "Can only dispute after payment is marked" }, { status: 400 });

    let reason: string | undefined;
    let evidence: string | undefined;
    try {
      const body = await req.json();
      reason   = body.reason;
      evidence = body.evidence;
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return Response.json({ error: "Reason required" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const disputed = await tx.p2POrder.updateMany({
        where: { id, status: "PAID" },
        data: { status: "DISPUTED" },
      });
      if (disputed.count === 0) throw new Error("ORDER_STATE_CHANGED");
      await tx.p2PDispute.create({
        data: { orderId: id, raisedById: dbUser.id, reason: reason!.trim(), evidence: evidence ?? null },
      });

      const notifyUserId = isBuyer ? order.seller.userId : order.buyerId;
      const raisedBy     = isBuyer ? "Buyer" : "Seller";
      await tx.notification.create({
        data: {
          userId: notifyUserId,
          type:   "p2p_dispute",
          title:  `Dispute raised — order #${order.id.slice(0, 8).toUpperCase()}`,
          body:   `${raisedBy} has opened a dispute. Reason: ${reason!.trim()}`,
          link:   `/p2p/order/${order.id}`,
        },
      });
    });

    return Response.json({ status: "DISPUTED" });
  } catch (err) {
    if (err instanceof Error && err.message === "ORDER_STATE_CHANGED") {
      return Response.json({ error: "This order is no longer eligible for a dispute." }, { status: 409 });
    }
    console.error("POST /api/p2p/orders/[id]/dispute:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
