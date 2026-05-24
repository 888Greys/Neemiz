/**
 * Cron endpoint: scans all crypto deposit addresses and credits any new deposits.
 * VPS cron runs this every 5 minutes.
 *
 * Two flows:
 *   - User with merchant profile  → credits P2PCryptoBalance (escrow)
 *   - Regular user (no merchant)  → converts USDT→KES at USDT_KES_RATE and credits walletBalance
 */
import { db } from "@/lib/db";
import { checkDeposits } from "@/lib/crypto/deposit-checker";
import { TransactionType, TransactionStatus } from "@prisma/client";

export const runtime = "nodejs";

// KES conversion rates — update env vars regularly or fetch from API later
const USDT_KES_RATE = Number(process.env.USDT_KES_RATE  ?? "128");
const ETH_KES_RATE  = Number(process.env.ETH_KES_RATE   ?? "420000"); // ~$3,200 × 130
const BNB_KES_RATE  = Number(process.env.BNB_KES_RATE   ?? "84000");  // ~$650 × 130

function toKes(amount: number, crypto: string): number {
  if (crypto === "ETH") return parseFloat((amount * ETH_KES_RATE).toFixed(2));
  if (crypto === "BNB") return parseFloat((amount * BNB_KES_RATE).toFixed(2));
  return parseFloat((amount * USDT_KES_RATE).toFixed(2)); // USDT default
}

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
        const already = await db.p2PCryptoDeposit.findFirst({
          where: { txHash: tx.txHash },
        });
        if (already) continue;

        const amount = parseFloat(tx.amount);
        if (amount <= 0) continue;

        const merchant = addr.user.merchantProfile;

        if (merchant) {
          // ── Merchant escrow deposit ──────────────────────────────────────
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
              where:  { merchantId_crypto: { merchantId: merchant.id, crypto: addr.crypto } },
              create: { merchantId: merchant.id, crypto: addr.crypto, total: amount, available: amount, locked: 0 },
              update: { total: { increment: amount }, available: { increment: amount } },
            });

            await t.notification.create({
              data: {
                userId: addr.userId,
                type:   "crypto_deposit",
                title:  `${addr.crypto} deposit received`,
                body:   `${tx.amount} ${addr.crypto} (${addr.network}) credited to your escrow balance.`,
                link:   "/p2p/merchant",
              },
            });
          });
        } else {
          // ── Wallet deposit: convert to KES and credit betting wallet ─────
          const kesAmount = toKes(amount, addr.crypto);

          await db.$transaction(async (t) => {
            // Record the raw crypto deposit so we don't double-process
            await t.p2PCryptoDeposit.create({
              data: {
                // No merchantId for wallet deposits — store under a dummy entry
                // We reuse txHash uniqueness to prevent double-crediting
                merchantId: (await t.merchantProfile.findFirst())?.id ?? "system",
                crypto:     addr.crypto,
                amount,
                txHash:     tx.txHash,
                network:    addr.network,
                status:     "APPROVED",
                adminNote:  `wallet_deposit:${addr.userId}`,
              },
            });

            // Credit KES to user wallet
            await t.user.update({
              where: { id: addr.userId },
              data:  { walletBalance: { increment: kesAmount } },
            });

            // Log transaction
            await t.transaction.create({
              data: {
                userId:    addr.userId,
                type:      TransactionType.DEPOSIT,
                amount:    kesAmount,
                currency:  "KES",
                status:    TransactionStatus.COMPLETED,
                reference: `crypto-${tx.txHash}`,
                provider:  "crypto",
                metadata:  { txHash: tx.txHash, crypto: addr.crypto, network: addr.network, cryptoAmount: amount, rate: USDT_KES_RATE },
              },
            });

            await t.notification.create({
              data: {
                userId: addr.userId,
                type:   "wallet_deposit",
                title:  "Crypto deposit received",
                body:   `${tx.amount} ${addr.crypto} = KSh ${kesAmount.toLocaleString()} credited to your wallet.`,
                link:   "/dashboard",
              },
            });
          });
        }

        credited++;
      }
    } catch (e) {
      errors.push(`${addr.address}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return Response.json({ ok: true, checked: addresses.length, credited, errors });
}
