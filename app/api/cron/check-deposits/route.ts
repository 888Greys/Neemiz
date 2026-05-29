/**
 * Cron endpoint: scans all crypto deposit addresses and credits any new deposits.
 * VPS cron runs this every 5 minutes.
 *
 * Deposits credit UserCryptoBalance only — no KES conversion.
 * KES walletBalance is only ever credited by fiat payment providers (Megapay, Pesapal, etc.).
 * Merchants use POST /api/p2p/merchant/fund to move wallet crypto into escrow.
 */
import { db } from "@/lib/db";
import { checkDeposits, getOnChainBalance } from "@/lib/crypto/deposit-checker";
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
  const errors: string[] = [];

  for (const addr of addresses) {
    try {
      const txs = await checkDeposits(addr.address, addr.crypto, addr.network);

      for (const tx of txs) {
        // Skip if already processed
        const [alreadyDeposit, alreadyTx] = await Promise.all([
          db.p2PCryptoDeposit.findFirst({ where: { txHash: tx.txHash } }),
          db.transaction.findFirst({ where: { reference: `crypto-${tx.txHash}` } }),
        ]);
        if (alreadyDeposit || alreadyTx) continue;

        const amount = parseFloat(tx.amount);
        if (amount <= 0) continue;

        const isMerchant = !!addr.user.merchantProfile;

        await db.$transaction(async (t) => {
          // Credit crypto balance (no KES conversion)
          await t.userCryptoBalance.upsert({
            where:  { userId_crypto_network: { userId: addr.userId, crypto: addr.crypto, network: addr.network } },
            create: { userId: addr.userId, crypto: addr.crypto, network: addr.network, available: amount, locked: 0 },
            update: { available: { increment: amount } },
          });

          // Log transaction in crypto currency for audit trail / dedup
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

        // Email notification (non-blocking)
        if (addr.user.email) {
          sendCryptoDepositEmail(addr.user.email, addr.user.username ?? addr.user.email, {
            crypto:       addr.crypto,
            network:      addr.network,
            cryptoAmount: amount,
            txHash:       tx.txHash,
          }).catch((e) => console.warn("[check-deposits] email failed:", e));
        }

        credited++;
      }

      // ── Sync on-chain balance → UI (best-effort) ──────────────────────────
      const onChain = await getOnChainBalance(addr.address, addr.crypto, addr.network);
      const existing = await db.userCryptoBalance.findUnique({
        where: { userId_crypto_network: { userId: addr.userId, crypto: addr.crypto, network: addr.network } },
      });
      if (onChain > 0 || existing) {
        await db.userCryptoBalance.upsert({
          where:  { userId_crypto_network: { userId: addr.userId, crypto: addr.crypto, network: addr.network } },
          create: { userId: addr.userId, crypto: addr.crypto, network: addr.network, available: onChain, locked: 0 },
          update: { available: onChain },
        }).catch(() => { /* ignore */ });
      }
    } catch (e) {
      errors.push(`${addr.address}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({ ok: true, checked: addresses.length, credited, errors });
}
