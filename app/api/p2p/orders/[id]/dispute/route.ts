import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// POST /api/p2p/orders/[id]/dispute
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const order  = await db.p2POrder.findUnique({ where: { id } });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.buyerId !== dbUser.id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "PAID") return Response.json({ error: "Can only dispute after marking as paid" }, { status: 400 });

  const { reason, evidence } = await req.json();
  if (!reason) return Response.json({ error: "Reason required" }, { status: 400 });

  await db.$transaction([
    db.p2POrder.update({
      where: { id },
      data: { status: "DISPUTED", disputedAt: new Date() },
    }),
    db.p2PDispute.create({
      data: { orderId: id, raisedById: dbUser.id, reason, evidence: evidence ?? null },
    }),
  ]);

  return Response.json({ status: "DISPUTED" });
}
