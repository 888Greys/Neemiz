import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { debitUserCrypto, creditUserCrypto } from "@/lib/p2p/crypto-balance";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { transfersDisabledResponse } from "@/lib/withdrawal-guard";

// ── GET /api/crypto/transfer?username=xxx  ──────────────────────────────────
// Look up a recipient by username — returns display name if found.
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const username = new URL(req.url).searchParams.get("username")?.trim();
    if (!username || username.length < 2) {
      return Response.json({ error: "Enter at least 2 characters" }, { status: 400 });
    }

    const recipient = await db.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, firstName: true, lastName: true, imageUrl: true },
    });

    if (!recipient) return Response.json({ error: "User not found" }, { status: 404 });

    // Don't reveal the sender to themselves
    const dbSender = await getOrCreateUser(user.id, { email: user.email });
    if (recipient.id === dbSender.id) {
      return Response.json({ error: "You can't send to yourself" }, { status: 400 });
    }

    return Response.json({
      id:          recipient.id,
      username:    recipient.username,
      displayName: [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || recipient.username,
      imageUrl:    recipient.imageUrl,
    });
  } catch (err) {
    console.error("GET /api/crypto/transfer:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── POST /api/crypto/transfer  ──────────────────────────────────────────────
// Execute an internal crypto transfer between two Nezeem users.
export async function POST(req: Request) {
  try {
    const killed = await transfersDisabledResponse();
    if (killed) return killed;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbSender = await getOrCreateUser(user.id, { email: user.email });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { recipientUsername, crypto, network, amount } = body as {
      recipientUsername: string;
      crypto:  string;
      network: string;
      amount:  number;
    };

    if (!recipientUsername || !crypto || !network || !amount) {
      return Response.json({ error: "recipientUsername, crypto, network and amount are required" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Find recipient
    const recipient = await db.user.findFirst({
      where: { username: { equals: recipientUsername.trim(), mode: "insensitive" } },
      select: { id: true, username: true, firstName: true, email: true },
    });
    if (!recipient) return Response.json({ error: "Recipient not found" }, { status: 404 });
    if (recipient.id === dbSender.id) {
      return Response.json({ error: "You can't send to yourself" }, { status: 400 });
    }

    const ref = `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    await db.$transaction(async (t) => {
      // Debit sender (throws INSUFFICIENT_CRYPTO_BALANCE if short)
      await debitUserCrypto(t, dbSender.id, crypto, network, amountNum);

      // Credit recipient
      await creditUserCrypto(t, recipient.id, crypto, network, amountNum);

      // Sender ledger — withdrawal
      await t.transaction.create({
        data: {
          userId:    dbSender.id,
          type:      TransactionType.WITHDRAWAL,
          amount:    amountNum,
          currency:  crypto,
          status:    TransactionStatus.COMPLETED,
          reference: `${ref}-out`,
          provider:  "transfer",
          metadata:  { crypto, network, to: recipient.username, action: "crypto_send" },
        },
      });

      // Recipient ledger — deposit
      await t.transaction.create({
        data: {
          userId:    recipient.id,
          type:      TransactionType.DEPOSIT,
          amount:    amountNum,
          currency:  crypto,
          status:    TransactionStatus.COMPLETED,
          reference: `${ref}-in`,
          provider:  "transfer",
          metadata:  { crypto, network, from: dbSender.username, action: "crypto_receive" },
        },
      });

      // Notify sender
      await t.notification.create({
        data: {
          userId: dbSender.id,
          type:   "wallet_deposit",
          title:  "Crypto sent",
          body:   `You sent ${amountNum} ${crypto} to @${recipient.username}.`,
          link:   "/wallet",
        },
      });

      // Notify recipient
      await t.notification.create({
        data: {
          userId: recipient.id,
          type:   "wallet_deposit",
          title:  "Crypto received",
          body:   `@${dbSender.username ?? "Someone"} sent you ${amountNum} ${crypto} (${network}).`,
          link:   "/wallet",
        },
      });
    });

    return Response.json({ ok: true, crypto, network, amount: amountNum, to: recipient.username });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: "Insufficient crypto balance" }, { status: 400 });
    }
    console.error("POST /api/crypto/transfer:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
