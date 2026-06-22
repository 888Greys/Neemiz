import { TransactionStatus, TransactionType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { generateUniqueUsername, recipientLookupWhere } from "@/lib/user-identity";
import { dailyLimitKes, dailyCapWhere } from "@/lib/withdrawal-window";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

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
      // Enforce the shared daily cash-out cap: outgoing transfers count against
      // the same limit as M-Pesa withdrawals (see dailyCapWhere), so cash can't
      // leave the platform faster than the cap by hopping through a transfer.
      // Checked inside the transaction so concurrent sends can't both slip under.
      const limit = dailyLimitKes();
      const todaySum = await tx.transaction.aggregate({ where: dailyCapWhere(sender.id), _sum: { amount: true } });
      const usedToday = Number(todaySum._sum?.amount ?? 0);
      if (usedToday + amount > limit) {
        throw new Error(`DAILY_LIMIT:${Math.max(0, limit - usedToday)}`);
      }

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
            body: `You sent ${CURRENCY_SYMBOL} ${amount.toLocaleString(MONEY_LOCALE)} to @${recipient.username}.`,
            link: "/wallet",
          },
          {
            userId: recipient.id,
            type: "wallet_transfer_received",
            title: "Money received",
            body: `@${sender.username} sent you ${CURRENCY_SYMBOL} ${amount.toLocaleString(MONEY_LOCALE)}.`,
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
    if (error instanceof Error && error.message.startsWith("DAILY_LIMIT:")) {
      const remaining = Number(error.message.split(":")[1] ?? 0);
      return Response.json({
        error: remaining > 0
          ? `Daily limit: you can send or withdraw ${CURRENCY_SYMBOL} ${remaining.toLocaleString()} more today. Resets at 2:00 AM.`
          : "You've reached today's cash-out limit (sends + withdrawals). It resets at 2:00 AM.",
      }, { status: 400 });
    }
    console.error("POST /api/wallet/transfer:", error);
    return Response.json({ error: "Transfer failed" }, { status: 500 });
  }
}
