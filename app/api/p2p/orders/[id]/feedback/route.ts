import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/feedback - leave one review after settlement.
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
    if (order.status !== "RELEASED") {
      return Response.json({ error: "Feedback is available after the trade is completed." }, { status: 400 });
    }

    const isBuyer = order.buyerId === dbUser.id;
    const isSeller = order.seller.userId === dbUser.id;
    if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const rating = Number(body.rating);
    const comment = String(body.comment ?? "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: "Choose a rating from 1 to 5." }, { status: 400 });
    }
    if (comment.length > 500) {
      return Response.json({ error: "Feedback must be 500 characters or less." }, { status: 400 });
    }

    const feedback = await db.p2PFeedback.create({
      data: {
        orderId: id,
        fromUserId: dbUser.id,
        toUserId: isBuyer ? order.seller.userId : order.buyerId,
        rating,
        comment: comment || null,
      },
      select: { rating: true, comment: true, createdAt: true },
    });

    return Response.json({ feedback }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return Response.json({ error: "You already left feedback for this order." }, { status: 409 });
    }
    console.error("POST /api/p2p/orders/[id]/feedback:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
