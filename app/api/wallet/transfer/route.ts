import { TransactionStatus, TransactionType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { generateUniqueUsername, recipientLookupWhere } from "@/lib/user-identity";

const recipientSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  imageUrl: true,
  email: true,
  phone: true,
} as const;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json([]);

  const sender = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  const users = await db.user.findMany({
    where: { AND: [recipientLookupWhere(query), { id: { not: sender.id } }] },
    select: recipientSelect,
    take: 6,
  });

  const recipients = await Promise.all(users.map(async (recipient) => {
    const username = recipient.username ?? await generateUniqueUsername(db, recipient);
    if (!recipient.username) {
      await db.user.update({ where: { id: recipient.id }, data: { username } });
    }
    return {
      id: recipient.id,
      username,
      imageUrl: recipient.imageUrl,
      displayName: [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || username,
    };
  }));

  return Response.json(recipients);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sender = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });
  let body: { recipientId?: string; amount?: number };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!body.recipientId || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Select a recipient and enter a valid amount" }, { status: 400 });
  }

  const recipient = await db.user.findFirst({
    where: { id: body.recipientId, isActive: true },
    select: { id: true, username: true },
  });
  if (!recipient) return Response.json({ error: "Recipient not found" }, { status: 404 });
  if (recipient.id === sender.id) return Response.json({ error: "You can't send to yourself" }, { status: 400 });

  const reference = `wallet-transfer-${crypto.randomUUID()}`;
  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: sender.id, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      await tx.user.update({ where: { id: recipient.id }, data: { walletBalance: { increment: amount } } });
      await tx.transaction.createMany({
        data: [
          {
            userId: sender.id, type: TransactionType.WITHDRAWAL, amount, currency: "KES",
            status: TransactionStatus.COMPLETED, reference: `${reference}-out`, provider: "wallet_transfer",
            metadata: { action: "wallet_send", to: recipient.username },
          },
          {
            userId: recipient.id, type: TransactionType.DEPOSIT, amount, currency: "KES",
            status: TransactionStatus.COMPLETED, reference: `${reference}-in`, provider: "wallet_transfer",
            metadata: { action: "wallet_receive", from: sender.username },
          },
        ],
      });
      await tx.notification.createMany({
        data: [
          {
            userId: sender.id,
            type: "wallet_transfer_sent",
            title: "Money sent",
            body: `You sent KSh ${amount.toLocaleString("en-KE")} to @${recipient.username}.`,
            link: "/wallet",
          },
          {
            userId: recipient.id,
            type: "wallet_transfer_received",
            title: "Money received",
            body: `@${sender.username} sent you KSh ${amount.toLocaleString("en-KE")}.`,
            link: "/wallet",
          },
        ],
      });
      const updated = await tx.user.findUnique({ where: { id: sender.id }, select: { walletBalance: true } });
      return Number(updated?.walletBalance ?? 0);
    });

    return Response.json({ ok: true, newBalance: result, to: recipient.username, reference });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("POST /api/wallet/transfer:", error);
    return Response.json({ error: "Transfer failed" }, { status: 500 });
  }
}
