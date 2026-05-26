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

// Fallback KES rates used only when live fetch fails
const FALLBACK_USDT_KES = Number(process.env.USDT_KES_RATE ?? "128");
const FALLBACK_ETH_KES  = Number(process.env.ETH_KES_RATE  ?? "420000");
const FALLBACK_BNB_KES  = Number(process.env.BNB_KES_RATE  ?? "84000");

async function fetchLiveRates(): Promise<{ USDT: number; ETH: number; BNB: number }> {
  try {
    // Frankfurter gives major fiat pairs; for crypto we use CoinGecko (no key required)
    const [kesRes, cryptoRes] = await Promise.all([
      fetch("https://api.frankfurter.app/latest?base=USD&symbols=KES", { signal: AbortSignal.timeout(5000) }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether,ethereum,binancecoin&vs_currencies=kes", { signal: AbortSignal.timeout(5000) }),
    ]);

    let kesPerUsd = FALLBACK_USDT_KES;
    if (kesRes.ok) {
      const data = await kesRes.json() as { rates?: { KES?: number } };
      if (data.rates?.KES) kesPerUsd = data.rates.KES;
    }

    let ethKes = FALLBACK_ETH_KES;
    let bnbKes = FALLBACK_BNB_KES;
    if (cryptoRes.ok) {
      const data = await cryptoRes.json() as {
        tether?: { kes?: number };
        ethereum?: { kes?: number };
        binancecoin?: { kes?: number };
      };
      if (data.tether?.kes)      kesPerUsd = data.tether.kes;
      if (data.ethereum?.kes)    ethKes    = data.ethereum.kes;
      if (data.binancecoin?.kes) bnbKes    = data.binancecoin.kes;
    }

    return { USDT: kesPerUsd, ETH: ethKes, BNB: bnbKes };
  } catch {
    console.warn("[check-deposits] Live rate fetch failed, using env var fallbacks");
    return { USDT: FALLBACK_USDT_KES, ETH: FALLBACK_ETH_KES, BNB: FALLBACK_BNB_KES };
  }
}

function toKes(amount: number, crypto: string, rates: { USDT: number; ETH: number; BNB: number }): number {
  if (crypto === "ETH") return parseFloat((amount * rates.ETH).toFixed(2));
  if (crypto === "BNB") return parseFloat((amount * rates.BNB).toFixed(2));
  return parseFloat((amount * rates.USDT).toFixed(2)); // USDT / default
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

  const [addresses, rates] = await Promise.all([
    db.cryptoDepositAddress.findMany({
      include: { user: { include: { merchantProfile: true } } },
    }),
    fetchLiveRates(),
  ]);

  let credited = 0;
  const errors: string[] = [];

  for (const addr of addresses) {
    try {
      const txs = await checkDeposits(addr.address, addr.crypto, addr.network);

      for (const tx of txs) {
        // Skip if already processed (merchant path uses p2PCryptoDeposit, wallet path uses Transaction)
        const [alreadyDeposit, alreadyTx] = await Promise.all([
          db.p2PCryptoDeposit.findFirst({ where: { txHash: tx.txHash } }),
          db.transaction.findFirst({ where: { reference: `crypto-${tx.txHash}` } }),
        ]);
        if (alreadyDeposit || alreadyTx) continue;

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
          const kesAmount = toKes(amount, addr.crypto, rates);

          await db.$transaction(async (t) => {
            // Record via a deduplicated wallet transaction — no fake merchantId needed.
            // txHash uniqueness in the Transaction table prevents double-crediting.

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
                metadata:  { txHash: tx.txHash, crypto: addr.crypto, network: addr.network, cryptoAmount: amount, rate: rates[addr.crypto as keyof typeof rates] ?? rates.USDT },
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
