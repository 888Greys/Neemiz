import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/p2p/orders/[id]/messages
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const order  = await db.p2POrder.findUnique({
    where: { id },
    include: { seller: true },
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = order.seller.userId === dbUser.id;
  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });

  const messages = await db.p2PMessage.findMany({
    where: { orderId: id },
    include: { sender: { select: { id: true, firstName: true, lastName: true, username: true, imageUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(messages);
}

// POST /api/p2p/orders/[id]/messages — send a message
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const order  = await db.p2POrder.findUnique({
    where: { id },
    include: { seller: true },
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = order.seller.userId === dbUser.id;
  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (["RELEASED", "CANCELLED", "EXPIRED"].includes(order.status)) {
    return Response.json({ error: "Order is closed" }, { status: 400 });
  }

  const { content, imageUrl } = await req.json();
  if (!content?.trim() && !imageUrl) return Response.json({ error: "Message cannot be empty" }, { status: 400 });

  const message = await db.p2PMessage.create({
    data: { orderId: id, senderId: dbUser.id, content: content ?? "", imageUrl: imageUrl ?? null },
    include: { sender: { select: { id: true, firstName: true, lastName: true, username: true, imageUrl: true } } },
  });

  return Response.json(message, { status: 201 });
}
