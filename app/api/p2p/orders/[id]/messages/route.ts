import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendP2PMessageEmail } from "@/lib/brevo";

function isReceiptMigrationPending(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2022";
}

function isAllowedChatImage(value: string) {
  if (!value) return true;
  try {
    const imageUrl = new URL(value);
    if (imageUrl.protocol !== "https:") return false;

    // New uploads live in Cloudflare R2, served from R2_PUBLIC_BASE_URL under a
    // /p2p-chat/ prefix (see app/api/upload/route.ts).
    const r2Base = process.env.R2_PUBLIC_BASE_URL;
    if (r2Base) {
      const r2Host = new URL(r2Base).host;
      if (imageUrl.host === r2Host && imageUrl.pathname.includes("/p2p-chat/")) return true;
    }

    // Legacy: Supabase Storage public objects (pre-R2 uploads).
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
      if (imageUrl.host === supabaseHost && imageUrl.pathname.includes("/storage/v1/object/public/p2p-chat/")) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// GET /api/p2p/orders/[id]/messages
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const now = new Date();
    const markRead = new URL(req.url).searchParams.get("read") === "1";
    await db.p2PMessage.updateMany({
      where: { orderId: id, senderId: { not: dbUser.id }, deliveredAt: null },
      data: { deliveredAt: now },
    });
    if (markRead) {
      await db.p2PMessage.updateMany({
        where: { orderId: id, senderId: { not: dbUser.id }, readAt: null },
        data: { deliveredAt: now, readAt: now },
      });
    }

    const messages = await db.p2PMessage.findMany({
      where: { orderId: id },
      include: { sender: { select: { id: true, firstName: true, lastName: true, username: true, imageUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(messages);
  } catch (error) {
    if (!isReceiptMigrationPending(error)) throw error;
  }

  const messages = await db.p2PMessage.findMany({
    where: { orderId: id },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      sender: { select: { id: true, firstName: true, lastName: true, username: true, imageUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(messages.map((message) => ({ ...message, deliveredAt: null, readAt: null })));
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
    include: {
      buyer: { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
      seller: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
        },
      },
    },
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  const isBuyer  = order.buyerId === dbUser.id;
  const isSeller = order.seller.userId === dbUser.id;
  if (!isBuyer && !isSeller) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (["RELEASED", "CANCELLED", "EXPIRED"].includes(order.status)) {
    return Response.json({ error: "Order is closed" }, { status: 400 });
  }

  const { content, imageUrl } = await req.json() as { content?: string; imageUrl?: string };
  const text = content?.trim() ?? "";
  const image = imageUrl?.trim() ?? "";
  if (!text && !image) return Response.json({ error: "Message cannot be empty" }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: "Message is too long" }, { status: 400 });
  if (!isAllowedChatImage(image)) return Response.json({ error: "Invalid image attachment" }, { status: 400 });

  const message = await db.p2PMessage.create({
    data: { orderId: id, senderId: dbUser.id, content: text, imageUrl: image || null },
    select: {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      sender: { select: { id: true, firstName: true, lastName: true, username: true, imageUrl: true } },
    },
  });

  const recipient = isBuyer ? order.seller.user : order.buyer;
  const senderName = dbUser.username
    || [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ")
    || "Your trade partner";
  const recipientName = recipient.username
    || [recipient.firstName, recipient.lastName].filter(Boolean).join(" ")
    || "Trader";
  const preview = text || "Sent an image";

  await Promise.allSettled([
    db.notification.create({
      data: {
        userId: recipient.id,
        type: "p2p_message",
        title: `New message from ${senderName}`,
        body: preview.slice(0, 160),
        link: `/p2p/order/${id}`,
      },
    }),
    recipient.email
      ? sendP2PMessageEmail(recipient.email, recipientName, {
          orderId: id,
          senderName,
          message: text,
          hasImage: Boolean(image),
        })
      : Promise.resolve(),
  ]);

  return Response.json({ ...message, deliveredAt: null, readAt: null }, { status: 201 });
}
