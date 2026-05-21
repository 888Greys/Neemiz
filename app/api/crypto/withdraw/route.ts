import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { createPayout, toNpCurrency } from "@/lib/nowpayments";
import { debitUserCrypto, defaultNetwork } from "@/lib/p2p/crypto-balance";
import { TransactionType, TransactionStatus } from "@prisma/client";

// Minimum withdrawal amounts per crypto
const MIN_WITHDRAWAL: Record<string, number> = {
  USDT:  10,
  USDC:  10,
  BTC:   0.0001,
  ETH:   0.005,
  BNB:   0.01,
  MATIC: 5,
};

/**
 * POST /api/crypto/withdraw
 * Body: { crypto, network, amount, address }
 *
 * Validates balance, debits UserCryptoBalance, submits payout to NOWPayments.
 * The actual on-chain send is async — NOWPayments calls /api/crypto/withdraw-webhook
 * when it's done.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  let body: { crypto: string; network?: string; amount: number; address: string };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const crypto  = (body.crypto ?? "USDT").toUpperCase();
  const network = (body.network ?? defaultNetwork(crypto)).toUpperCase();
  const amount  = Number(body.amount);
  const { address } = body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!address?.trim()) {
    return Response.json({ error: "Destination address is required" }, { status: 400 });
  }

  const minAmt = MIN_WITHDRAWAL[crypto] ?? 1;
  if (!amount || amount < minAmt) {
    return Response.json(
      { error: `Minimum withdrawal is ${minAmt} ${crypto}` },
      { status: 400 },
    );
  }

  // ── Balance check + debit (atomic) ─────────────────────────────────────────
  let txRecord;
  try {
    txRecord = await db.$transaction(async (tx) => {
      // debitUserCrypto throws INSUFFICIENT_CRYPTO_BALANCE if not enough
      await debitUserCrypto(tx, dbUser.id, crypto, network, amount);

      return tx.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.WITHDRAWAL,
          amount,
          currency:  crypto,
          status:    TransactionStatus.PENDING,
          provider:  "nowpayments",
          metadata:  { address, network, crypto, submittedAt: new Date().toISOString() },
        },
      });
    });
  } catch (err: unknown) {
    if ((err as Error).message === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    throw err;
  }

  // ── Submit payout to NOWPayments ───────────────────────────────────────────
  const payCurrency = toNpCurrency(crypto, network);

  try {
    const payout = await createPayout({
      address,
      currency:   payCurrency,
      amount,
      externalId: txRecord.id,   // unique per withdrawal
    });

    // Update transaction with NOWPayments payout ID
    await db.transaction.update({
      where: { id: txRecord.id },
      data: {
        reference: payout.id,
        metadata:  {
          address, network, crypto,
          npPayoutId: payout.id,
          npStatus:   payout.status,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    // Notify user
    await db.notification.create({
      data: {
        userId: dbUser.id,
        type:   "crypto_withdrawal",
        title:  `${crypto} withdrawal submitted`,
        body:   `${amount} ${crypto} is being sent to ${address.slice(0, 10)}…${address.slice(-6)}`,
        link:   "/wallet",
      },
    });

    return Response.json({
      ok:        true,
      txId:      txRecord.id,
      payoutId:  payout.id,
      status:    payout.status,
    }, { status: 201 });

  } catch (err: unknown) {
    // Payout failed — refund the balance
    await db.$transaction(async (tx) => {
      await tx.userCryptoBalance.updateMany({
        where: { userId: dbUser.id, crypto, network },
        data:  { available: { increment: amount } },
      });
      await tx.transaction.update({
        where: { id: txRecord.id },
        data:  { status: TransactionStatus.FAILED },
      });
    });

    console.error("NOWPayments payout error:", err);
    return Response.json(
      { error: (err as Error).message ?? "Payout failed — funds have been returned to your balance" },
      { status: 502 },
    );
  }
}

/**
 * GET /api/crypto/withdraw
 * Returns the user's withdrawal history.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const withdrawals = await db.transaction.findMany({
    where:   { userId: dbUser.id, type: TransactionType.WITHDRAWAL, provider: "nowpayments" },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id:        true,
      amount:    true,
      currency:  true,
      status:    true,
      reference: true,
      metadata:  true,
      createdAt: true,
    },
  });

  return Response.json(
    withdrawals.map((w) => ({
      id:        w.id,
      amount:    Number(w.amount),
      crypto:    w.currency,
      status:    w.status,
      reference: w.reference,
      address:   (w.metadata as Record<string, unknown>)?.address,
      network:   (w.metadata as Record<string, unknown>)?.network,
      createdAt: w.createdAt,
    })),
  );
}
