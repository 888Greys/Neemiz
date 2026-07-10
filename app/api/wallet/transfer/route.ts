import { cookies } from "next/headers";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { generateUniqueUsername, recipientLookupWhere } from "@/lib/user-identity";
import { dailyLimitKes, dailyCapWhere, transferDailyLimitKes, transferCapWhere } from "@/lib/withdrawal-window";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { transfersDisabledResponse } from "@/lib/withdrawal-guard";
import { DEV_AUTH_ENABLED } from "@/lib/dev-auth";
import { verifyStepUpToken, STEPUP_COOKIE } from "@/lib/step-up";
import { assertNotPromoLocked, promoLockedHttpError } from "@/lib/promo-lock";

/** Per-transfer cap (KES). Keep in sync with wallet Send Max button. */
const MAX_TRANSFER_KES = 50;

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
    take: 12,
  });

  const needle = query.trim().toLowerCase();
  const ranked = [...users].sort((a, b) => {
    const score = (u: typeof a) => {
      const uname = (u.username ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      if (uname === needle || email === needle) return 0;
      if (uname.startsWith(needle) || email.startsWith(needle)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  const recipients = await Promise.all(ranked.map(async (recipient) => {
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

  const rl = rateLimit(`wallet-transfer:${user.id}`, 10, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const sender = await getOrCreateUser(user.id, { email: user.email, phone: user.phone });

  const killed = await transfersDisabledResponse();
  if (killed && !sender.isAdmin) return killed;

  // Server-side step-up gate (same proof as M-Pesa withdraw). A direct POST
  // that skips the confirm UI is rejected. Consumed on use.
  if (!DEV_AUTH_ENABLED) {
    const jar = await cookies();
    const proof = jar.get(STEPUP_COOKIE)?.value;
    if (!verifyStepUpToken(proof, user.id)) {
      return Response.json(
        { error: "Please confirm it's you to send money.", stepUpRequired: true },
        { status: 401 },
      );
    }
    jar.delete(STEPUP_COOKIE);
  }

  let body: { recipientId?: string; amount?: number };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!body.recipientId || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Select a recipient and enter a valid amount" }, { status: 400 });
  }

  // Per-transfer cap: a user may send at most KSh 50 to another account in one
  // transfer. This throttles the "seed an account then cash it out" fan-out
  // pattern where balance is moved in bulk to accomplices who withdraw it.
  // Admins are also subject to the KSh 50 per-transfer limit.
  if (amount > MAX_TRANSFER_KES) {
    return Response.json({ error: `You can send at most ${CURRENCY_SYMBOL} ${MAX_TRANSFER_KES} per transfer.` }, { status: 400 });
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
      const senderRow = await tx.user.findUnique({
        where: { id: sender.id },
        select: { walletBalance: true },
      });
      if (!senderRow) throw new Error("INSUFFICIENT_BALANCE");

      // Promo credits cannot be transferred — only surplus above the lock.
      const promoAgg = await tx.promoRedemption.aggregate({
        where: { userId: sender.id },
        _sum: { amountKes: true },
      });
      const locked = Number(promoAgg._sum.amountKes ?? 0);
      const bal = Number(senderRow.walletBalance);
      const transferable = Math.max(0, Math.round((bal - (Number.isFinite(locked) ? locked : 0)) * 100) / 100);
      assertNotPromoLocked(amount, transferable, Number.isFinite(locked) ? locked : 0);

      // Race-safe debit FIRST: the conditional updateMany takes a row lock on
      // the sender, serializing concurrent cash-outs so the cap aggregate below
      // can't be raced (two sends both reading a stale "usedToday").
      const debited = await tx.user.updateMany({
        where: { id: sender.id, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      if (!sender.isAdmin) {
        const limit = dailyLimitKes();
        const priorSum = await tx.transaction.aggregate({ where: dailyCapWhere(sender.id), _sum: { amount: true } });
        const usedWindow = Number(priorSum._sum?.amount ?? 0);
        if (usedWindow + amount > limit) {
          throw new Error(`DAILY_LIMIT:${Math.max(0, limit - usedWindow)}`);
        }
      }

      // Admins are exempt from the shared cash-out cap above, but must still be
      // bounded on TOTAL transfers per rolling 24h across ALL recipients —
      // otherwise the KSh 50 per-transfer cap can be sprayed across unlimited
      // distinct accounts (the collins fan-out, 2026-07-08: ~520 accounts).
      if (sender.isAdmin) {
        const transferLimit = transferDailyLimitKes();
        const priorTransfers = await tx.transaction.aggregate({ where: transferCapWhere(sender.id), _sum: { amount: true } });
        const usedTransfers = Number(priorTransfers._sum?.amount ?? 0);
        if (usedTransfers + amount > transferLimit) {
          throw new Error(`TRANSFER_LIMIT:${Math.max(0, transferLimit - usedTransfers)}`);
        }
      }

      // Any admin may seed a given account ONLY ONCE, EVER — across ALL admins
      // (including goodhope / owner accounts). Once any admin has transferred
      // to a recipient, no further admin transfer to them is allowed.
      if (sender.isAdmin) {
        const priorTransfer = await tx.transaction.findFirst({
          where: {
            type: TransactionType.WITHDRAWAL,
            provider: "wallet_transfer",
            status: { notIn: [TransactionStatus.FAILED, TransactionStatus.CANCELLED] },
            OR: [
              ...(recipient.username ? [{ metadata: { path: ["to"], equals: recipient.username } }] : []),
              { metadata: { path: ["recipientId"], equals: recipient.id } },
            ],
            user: { isAdmin: true },
          },
          select: {
            amount: true,
            createdAt: true,
            user: { select: { username: true } },
          },
        });
        if (priorTransfer) {
          const fromUser = priorTransfer.user.username ?? "an admin";
          throw new Error(`ADMIN_ONCE_EVER:${priorTransfer.amount}:${fromUser}:${priorTransfer.createdAt.toISOString()}`);
        }
      }

      await tx.user.update({ where: { id: recipient.id }, data: { walletBalance: { increment: amount } } });
      await tx.transaction.createMany({
        data: [
          {
            userId: sender.id, type: TransactionType.WITHDRAWAL, amount, currency: "KES",
            status: TransactionStatus.COMPLETED, reference: `${reference}-out`, provider: "wallet_transfer",
            metadata: { action: "wallet_send", to: recipient.username, recipientId: recipient.id },
          },
          {
            userId: recipient.id, type: TransactionType.DEPOSIT, amount, currency: "KES",
            status: TransactionStatus.COMPLETED, reference: `${reference}-in`, provider: "wallet_transfer",
            metadata: { action: "wallet_receive", from: sender.username, senderId: sender.id },
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
    if (error instanceof Error && error.message.startsWith("PROMO_LOCKED:")) {
      const { status, body } = promoLockedHttpError(error.message);
      return Response.json(body, { status });
    }
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
    if (error instanceof Error && error.message.startsWith("TRANSFER_LIMIT:")) {
      const remaining = Number(error.message.split(":")[1] ?? 0);
      return Response.json({
        error: remaining > 0
          ? `Daily transfer limit: you can send ${CURRENCY_SYMBOL} ${remaining.toLocaleString(MONEY_LOCALE)} more in the next 24 hours.`
          : "You've reached the daily transfer limit. It resets on a rolling 24-hour basis.",
      }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("ADMIN_ONCE_EVER")) {
      const parts = error.message.split(":");
      const priorAmount = Number(parts[1] ?? 0);
      const fromLabel = parts[2] && parts[2] !== "an admin" ? `@${parts[2]}` : "an admin";
      const sentAt = parts[3] ?? null;
      return Response.json({
        code: "ADMIN_ONCE_EVER",
        alreadySent: true,
        recipient: recipient.username,
        priorAmount: Number.isFinite(priorAmount) ? priorAmount : null,
        from: fromLabel,
        sentAt,
        error: `@${recipient.username} has already received an admin transfer. Each account can receive from an admin only once.`,
      }, { status: 400 });
    }
    console.error("POST /api/wallet/transfer:", error);
    return Response.json({ error: "Transfer failed" }, { status: 500 });
  }
}
