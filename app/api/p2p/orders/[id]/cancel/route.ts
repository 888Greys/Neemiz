import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/cancel
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const order  = await db.p2POrder.findUnique({ where: { id } });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = merchant && order.sellerId === merchant.id;

  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!["PENDING"].includes(order.status)) {
    return Response.json({ error: "Can only cancel PENDING orders" }, { status: 400 });
  }

  const { reason } = await req.json().catch(() => ({}));

  await db.$transaction(async (tx) => {
    await tx.p2POrder.update({
      where: { id },
      data: {
        status:       "CANCELLED",
        cancelledBy:  dbUser.id,
        cancelReason: reason ?? null,
      },
    });

    // Restore ad's available amount
    await tx.p2PAd.update({
      where: { id: order.adId },
      data: { availableAmount: { increment: Number(order.cryptoAmount) } },
    });
  });

  return Response.json({ status: "CANCELLED" });
}
