import { db } from "@/lib/db";
import { verifyIpnSignature, NpIpnPayload, NP_TO_INTERNAL, SETTLED_STATUSES, FAILED_STATUSES } from "@/lib/nowpayments";
import { creditUserCrypto } from "@/lib/p2p/crypto-balance";
import { TransactionStatus } from "@prisma/client";

/**
 * POST /api/crypto/deposit-webhook
 * Called by NOWPayments IPN when a deposit payment status changes.
 * Must return 200 quickly — NOWPayments retries until it gets 200.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig") ?? "";

  // Verify the request came from NOWPayments
  if (!verifyIpnSignature(rawBody, signature)) {
    console.warn("NOWPayments IPN: invalid signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: NpIpnPayload;
  try {
    payload = JSON.parse(rawBody) as NpIpnPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { payment_id, payment_status, order_id: userId, actually_paid, outcome_amount, pay_currency } = payload;

  // Find the pending transaction by payment_id (reference)
  const tx = await db.transaction.findUnique({
    where: { reference: payment_id },
  });

  if (!tx) {
    // We don't recognise this payment — log it and return 200 so NOWPayments doesn't retry forever
    console.warn(`NOWPayments IPN: unknown payment_id ${payment_id}`);
    return Response.json({ ok: true });
  }
  if (userId && userId !== tx.userId) {
    console.warn(`NOWPayments IPN: order_id ${userId} does not match transaction user ${tx.userId}`);
  }

  // Already processed — idempotency guard
  if (tx.status === TransactionStatus.COMPLETED) {
    return Response.json({ ok: true });
  }

  // Map NOWPayments currency code → our internal crypto/network pair
  const internal = NP_TO_INTERNAL[pay_currency.toLowerCase()];
  if (!internal) {
    console.error(`NOWPayments IPN: unknown pay_currency "${pay_currency}"`);
    return Response.json({ ok: true });
  }

  if (SETTLED_STATUSES.has(payment_status)) {
    // Amount to credit: prefer outcome_amount (after NP fees), fall back to actually_paid
    const creditAmount = Number(outcome_amount ?? actually_paid ?? 0);
    if (creditAmount <= 0) {
      console.error(`NOWPayments IPN: zero credit amount for payment ${payment_id}`);
      return Response.json({ ok: true });
    }

    await db.$transaction(async (prismaTx) => {
      // Update transaction record
      const claimed = await prismaTx.transaction.updateMany({
        where: { id: tx.id, status: TransactionStatus.PENDING },
        data: {
          status:   TransactionStatus.COMPLETED,
          amount:   creditAmount,
          currency: internal.crypto,
          metadata: {
            ...(tx.metadata as object ?? {}),
            actuallyPaid:   Number(actually_paid),
            outcomeAmount:  Number(outcome_amount),
            paymentStatus:  payment_status,
            settledAt:      new Date().toISOString(),
          },
        },
      });
      if (claimed.count === 0) return;

      // Credit the user's on-platform crypto balance
      await creditUserCrypto(prismaTx, tx.userId, internal.crypto, internal.network, creditAmount);
    });

    // Notify user
    await db.notification.create({
      data: {
        userId: tx.userId,
        type:  "crypto_deposit",
        title: `${internal.crypto} deposit confirmed`,
        body:  `${creditAmount.toFixed(6)} ${internal.crypto} (${internal.network}) has been credited to your account.`,
        link:  "/wallet",
      },
    });

    console.log(`NOWPayments IPN: credited ${creditAmount} ${internal.crypto} to user ${tx.userId}`);

  } else if (FAILED_STATUSES.has(payment_status)) {
    await db.transaction.updateMany({
      where: { id: tx.id, status: TransactionStatus.PENDING },
      data: {
        status:   TransactionStatus.FAILED,
        metadata: {
          ...(tx.metadata as object ?? {}),
          paymentStatus: payment_status,
          failedAt:      new Date().toISOString(),
        },
      },
    });

    // Notify user of failure
    await db.notification.create({
      data: {
        userId: tx.userId,
        type:  "crypto_deposit_failed",
        title: `Deposit ${payment_status}`,
        body:  `Your ${internal.crypto} deposit (${internal.network}) was ${payment_status}. If funds were sent, contact support.`,
        link:  "/wallet",
      },
    });
  }
  // For other statuses (waiting, confirming, sending, partially_paid) — just log, no action needed

  return Response.json({ ok: true });
}
