import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { debitUserCrypto, defaultNetwork } from "@/lib/p2p/crypto-balance";
import { broadcastWithdrawal, getHotWalletAddresses } from "@/lib/crypto/broadcaster";
import { TransactionType, TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

// Minimum withdrawal amounts per crypto
const MIN_WITHDRAWAL: Record<string, number> = {
  USDT:  10,
  USDC:  10,
  DAI:   10,
  BUSD:  10,
  BTC:   0.0001,
  WBTC:  0.0001,
  ETH:   0.005,
  BNB:   0.01,
  MATIC: 1,
  TRX:   10,
  LINK:  0.5,
};

// Platform fee (5%) deducted from requested amount
const FEE_RATE = 0.05;

/**
 * POST /api/crypto/withdraw
 * Body: { crypto, network, amount, address }
 *
 * Validates balance, debits UserCryptoBalance, then signs and broadcasts
 * the transaction directly from the Nezeem hot wallet.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  let body: { crypto: string; network?: string; amount: number; address: string };
  try   { body = await req.json(); }
  catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

  const crypto  = (body.crypto  ?? "USDT").toUpperCase();
  const network = (body.network ?? defaultNetwork(crypto)).toUpperCase();
  const amount  = Number(body.amount);
  const address = body.address?.trim();

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!address) {
    return Response.json({ error: "Destination address is required" }, { status: 400 });
  }
  const minAmt = MIN_WITHDRAWAL[crypto] ?? 1;
  if (!amount || amount < minAmt) {
    return Response.json({ error: `Minimum withdrawal is ${minAmt} ${crypto}` }, { status: 400 });
  }

  const feeAmount    = parseFloat((amount * FEE_RATE).toFixed(8));
  const payoutAmount = parseFloat((amount - feeAmount).toFixed(8));

  // ── Debit balance (atomic, before broadcast) ───────────────────────────────
  let txRecord;
  try {
    txRecord = await db.$transaction(async (tx) => {
      await debitUserCrypto(tx, dbUser.id, crypto, network, amount);
      return tx.transaction.create({
        data: {
          userId:   dbUser.id,
          type:     TransactionType.WITHDRAWAL,
          amount,
          currency: crypto,
          status:   TransactionStatus.PENDING,
          provider: "self_custody",
          metadata: { address, network, crypto, fee: feeAmount, payout: payoutAmount },
        },
      });
    });
  } catch (err: unknown) {
    if ((err as Error).message === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    throw err;
  }

  // ── Broadcast on-chain ─────────────────────────────────────────────────────
  try {
    const result = await broadcastWithdrawal(address, crypto, network, payoutAmount);

    // Mark completed
    await db.transaction.update({
      where: { id: txRecord.id },
      data: {
        status:    TransactionStatus.COMPLETED,
        reference: result.txHash,
        metadata:  { address, network, crypto, fee: feeAmount, payout: payoutAmount, txHash: result.txHash, explorer: result.explorer },
      },
    });

    await db.notification.create({
      data: {
        userId: dbUser.id,
        type:   "crypto_withdrawal",
        title:  `${crypto} withdrawal sent`,
        body:   `${payoutAmount} ${crypto} sent to ${address.slice(0, 8)}…${address.slice(-6)}`,
        link:   "/wallet",
      },
    });

    return Response.json({
      ok:       true,
      txId:     txRecord.id,
      txHash:   result.txHash,
      explorer: result.explorer,
      payout:   payoutAmount,
      fee:      feeAmount,
    }, { status: 201 });

  } catch (err: unknown) {
    // Broadcast failed — refund balance
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
    const msg = err instanceof Error ? err.message : "Broadcast failed";
    console.error("[crypto/withdraw] broadcast error:", msg);
    return Response.json({ error: `${msg} — funds returned to your balance` }, { status: 502 });
  }
}

/**
 * GET /api/crypto/withdraw
 * Returns withdrawal history + hot wallet addresses (for admin funding).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // If admin requests hot wallet addresses
  const url = new URL(req.url);
  if (url.searchParams.get("hotwallets") === "1") {
    const dbAdmin = await db.user.findUnique({ where: { id: dbUser.id }, select: { isAdmin: true } });
    if (!dbAdmin?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
    return Response.json(getHotWalletAddresses());
  }

  const withdrawals = await db.transaction.findMany({
    where:   { userId: dbUser.id, type: TransactionType.WITHDRAWAL, provider: "self_custody" },
    orderBy: { createdAt: "desc" },
    take:    50,
    select:  { id: true, amount: true, currency: true, status: true, reference: true, metadata: true, createdAt: true },
  });

  return Response.json(
    withdrawals.map((w) => {
      const meta = w.metadata as Record<string, unknown> | null;
      return {
        id:        w.id,
        amount:    Number(w.amount),
        crypto:    w.currency,
        status:    w.status,
        txHash:    w.reference,
        address:   meta?.address,
        network:   meta?.network,
        explorer:  meta?.explorer,
        payout:    meta?.payout,
        fee:       meta?.fee,
        createdAt: w.createdAt,
      };
    }),
  );
}
