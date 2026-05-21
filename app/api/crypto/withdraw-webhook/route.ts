import { db } from "@/lib/db";
import { verifyIpnSignature } from "@/lib/nowpayments";
import { TransactionStatus } from "@prisma/client";

/**
 * POST /api/crypto/withdraw-webhook
 * NOWPayments calls this when a payout status changes.
 */
export async function POST(req: Request) {
  const rawBody   = await req.text();
  const signature = req.headers.get("x-nowpayments-sig") ?? "";

  if (!verifyIpnSignature(rawBody, signature)) {
    console.warn("NOWPayments payout IPN: invalid signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try   { payload = JSON.parse(rawBody); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  // NOWPayments payout IPN structure differs slightly from payment IPN
  // unique_external_id is our txRecord.id
  const externalId = payload.unique_external_id as string | undefined;
  const status     = payload.status as string | undefined;
  const npId       = payload.id as string | undefined;

  if (!externalId) {
    console.warn("NOWPayments payout IPN: missing unique_external_id");
    return Response.json({ ok: true });
  }

  const tx = await db.transaction.findUnique({ where: { id: externalId } });
  if (!tx) {
    console.warn(`NOWPayments payout IPN: unknown externalId ${externalId}`);
    return Response.json({ ok: true });
  }

  // Already finalised
  if (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.FAILED) {
    return Response.json({ ok: true });
  }

  const meta = (tx.metadata as Record<string, unknown>) ?? {};

  if (status === "FINISHED" || status === "finished") {
    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status:    TransactionStatus.COMPLETED,
        reference: npId ?? tx.reference,
        metadata:  { ...meta, npFinalStatus: status, completedAt: new Date().toISOString() },
      },
    });

    await db.notification.create({
      data: {
        userId: tx.userId,
        type:   "crypto_withdrawal_completed",
        title:  `${tx.currency} withdrawal sent`,
        body:   `${Number(tx.amount)} ${tx.currency} has been sent to your wallet.`,
        link:   "/wallet",
      },
    });

  } else if (status === "FAILED" || status === "failed") {
    // Refund balance
    await db.$transaction(async (prismaTx) => {
      await prismaTx.userCryptoBalance.updateMany({
        where: { userId: tx.userId, crypto: tx.currency, network: meta.network as string },
        data:  { available: { increment: Number(tx.amount) } },
      });
      await prismaTx.transaction.update({
        where: { id: tx.id },
        data: {
          status:   TransactionStatus.FAILED,
          metadata: { ...meta, npFinalStatus: status, failedAt: new Date().toISOString() },
        },
      });
    });

    await db.notification.create({
      data: {
        userId: tx.userId,
        type:   "crypto_withdrawal_failed",
        title:  `${tx.currency} withdrawal failed`,
        body:   `Your withdrawal of ${Number(tx.amount)} ${tx.currency} failed. Funds have been returned to your balance.`,
        link:   "/wallet",
      },
    });
  }

  return Response.json({ ok: true });
}
