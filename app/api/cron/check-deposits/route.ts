/**
 * Cron endpoint: scans all crypto deposit addresses and credits any new deposits.
 * Call via Vercel Cron every 5 minutes, or any external cron with Bearer auth.
 *
 * vercel.json:
 *   "crons": [{ "path": "/api/cron/check-deposits", "schedule": "* /5 * * * *" }]
 */
import { db } from "@/lib/db";
import { checkDeposits } from "@/lib/crypto/deposit-checker";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Protect with a simple bearer secret
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await db.cryptoDepositAddress.findMany({
    include: { user: { include: { merchantProfile: true } } },
  });

  let credited = 0;
  const errors: string[] = [];

  for (const addr of addresses) {
    const merchant = addr.user.merchantProfile;
    if (!merchant) continue;

    try {
      const txs = await checkDeposits(addr.address, addr.crypto, addr.network);

      for (const tx of txs) {
        // Skip if already processed
        const already = await db.p2PCryptoDeposit.findFirst({
          where: { txHash: tx.txHash },
        });
        if (already) continue;

        const amount = parseFloat(tx.amount);
        if (amount <= 0) continue;

        // Atomic: record deposit + credit merchant balance
        await db.$transaction(async (t) => {
          await t.p2PCryptoDeposit.create({
            data: {
              merchantId: merchant.id,
              crypto:     addr.crypto,
              amount,
              txHash:     tx.txHash,
              network:    addr.network,
              status:     "APPROVED",
            },
          });

          await t.p2PCryptoBalance.upsert({
            where: {
              merchantId_crypto: { merchantId: merchant.id, crypto: addr.crypto },
            },
            create: {
              merchantId: merchant.id,
              crypto:     addr.crypto,
              total:      amount,
              available:  amount,
              locked:     0,
            },
            update: {
              total:     { increment: amount },
              available: { increment: amount },
            },
          });

          // Notify merchant
          await t.notification.create({
            data: {
              userId: addr.userId,
              type:   "crypto_deposit",
              title:  `${addr.crypto} deposit received`,
              body:   `${tx.amount} ${addr.crypto} (${addr.network}) has been credited to your escrow balance.`,
              link:   "/p2p/merchant",
            },
          });
        });

        credited++;
      }
    } catch (e) {
      errors.push(`${addr.address}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({ ok: true, checked: addresses.length, credited, errors });
}
