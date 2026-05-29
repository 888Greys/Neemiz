/**
 * Cron endpoint: scans all crypto deposit addresses and credits any new deposits.
 * VPS cron runs this every 5 minutes.
 *
 * Source of truth: the Transaction ledger.
 * Every deposit, withdrawal and transfer has a Transaction record.
 * UserCryptoBalance is updated by increment/decrement only — never overwritten
 * by an on-chain balance query (which can return stale/zero values transiently).
 *
 * KES walletBalance is only ever credited by fiat providers (Megapay, Pesapal).
 * Merchants use POST /api/p2p/merchant/fund to move wallet crypto → escrow.
 */
import { db } from "@/lib/db";
import { checkDeposits } from "@/lib/crypto/deposit-checker";
import { sendCryptoDepositEmail } from "@/lib/brevo";
import { TransactionType, TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await db.cryptoDepositAddress.findMany({
    include: { user: { include: { merchantProfile: true } } },
  });

  let credited = 0;
  const errors:  string[] = [];
  const details: Array<{
    address:  string;
    crypto:   string;
    network:  string;
    txsFound: number;
    skipped:  number;
    credited: number;
    error?:   string;
  }> = [];

  for (const addr of addresses) {
    const addrDetail: (typeof details)[number] = {
      address:  addr.address,
      crypto:   addr.crypto,
      network:  addr.network,
      txsFound: 0,
      skipped:  0,
      credited: 0,
    };

    try {
      const txs = await checkDeposits(addr.address, addr.crypto, addr.network);
      addrDetail.txsFound = txs.length;

      for (const tx of txs) {
        // Skip if already processed (dedup via Transaction reference)
        const [alreadyDeposit, alreadyTx] = await Promise.all([
          db.p2PCryptoDeposit.findFirst({ where: { txHash: tx.txHash } }),
          db.transaction.findFirst({ where: { reference: `crypto-${tx.txHash}` } }),
        ]);
        if (alreadyDeposit || alreadyTx) { addrDetail.skipped++; continue; }

        const amount = parseFloat(tx.amount);
        if (amount <= 0) { addrDetail.skipped++; continue; }

        const isMerchant = !!addr.user.merchantProfile;

        await db.$transaction(async (t) => {
          // ── Credit balance (increment — never overwrite) ──────────────────
          await t.userCryptoBalance.upsert({
            where:  { userId_crypto_network: { userId: addr.userId, crypto: addr.crypto, network: addr.network } },
            create: { userId: addr.userId, crypto: addr.crypto, network: addr.network, available: amount, locked: 0 },
            update: { available: { increment: amount } },
          });

          // ── Ledger record (also serves as dedup key) ──────────────────────
          await t.transaction.create({
            data: {
              userId:    addr.userId,
              type:      TransactionType.DEPOSIT,
              amount,
              currency:  addr.crypto,
              status:    TransactionStatus.COMPLETED,
              reference: `crypto-${tx.txHash}`,
              provider:  "crypto",
              metadata:  { txHash: tx.txHash, crypto: addr.crypto, network: addr.network },
            },
          });

          // ── In-app notification ───────────────────────────────────────────
          await t.notification.create({
            data: {
              userId: addr.userId,
              type:   "wallet_deposit",
              title:  "Crypto deposit received",
              body:   isMerchant
                ? `${tx.amount} ${addr.crypto} (${addr.network}) credited to your wallet. Go to Merchant Center to fund your escrow.`
                : `${tx.amount} ${addr.crypto} (${addr.network}) credited to your wallet.`,
              link:   isMerchant ? "/p2p/merchant" : "/dashboard",
            },
          });
        });

        // ── Email (non-blocking, outside DB transaction) ──────────────────
        if (addr.user.email) {
          sendCryptoDepositEmail(addr.user.email, addr.user.username ?? addr.user.email, {
            crypto:       addr.crypto,
            network:      addr.network,
            cryptoAmount: amount,
            txHash:       tx.txHash,
          }).catch((e) => console.warn("[check-deposits] email failed:", e));
        }

        credited++;
        addrDetail.credited++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      errors.push(`${addr.address}: ${msg}`);
      addrDetail.error = msg;
    }

    details.push(addrDetail);
  }

  return Response.json({ ok: true, checked: addresses.length, credited, errors, details });
}
