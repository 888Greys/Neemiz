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
const FALLBACK: Record<string, number> = {
  USDT:  Number(process.env.USDT_KES_RATE  ?? "128"),
  USDC:  Number(process.env.USDT_KES_RATE  ?? "128"),  // stablecoin ≈ USDT
  DAI:   Number(process.env.USDT_KES_RATE  ?? "128"),  // stablecoin ≈ USDT
  BUSD:  Number(process.env.USDT_KES_RATE  ?? "128"),  // stablecoin ≈ USDT
  ETH:   Number(process.env.ETH_KES_RATE   ?? "420000"),
  BNB:   Number(process.env.BNB_KES_RATE   ?? "84000"),
  MATIC: Number(process.env.MATIC_KES_RATE ?? "120"),
  TRX:   Number(process.env.TRX_KES_RATE   ?? "18"),
  WBTC:  Number(process.env.BTC_KES_RATE   ?? "14000000"),
  LINK:  Number(process.env.LINK_KES_RATE  ?? "1800"),
};

type Rates = typeof FALLBACK;

async function fetchLiveRates(): Promise<Rates> {
  const rates = { ...FALLBACK };
  try {
    // CoinGecko IDs for all supported coins
    const ids = "tether,usd-coin,dai,binance-usd,ethereum,binancecoin,matic-network,tron,wrapped-bitcoin,chainlink";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=kes`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return rates;

    const data = await res.json() as Record<string, { kes?: number }>;
    if (data.tether?.kes)         rates.USDT  = data.tether.kes;
    if (data["usd-coin"]?.kes)    rates.USDC  = data["usd-coin"].kes;
    if (data.dai?.kes)            rates.DAI   = data.dai.kes;
    if (data["binance-usd"]?.kes) rates.BUSD  = data["binance-usd"].kes;
    if (data.ethereum?.kes)       rates.ETH   = data.ethereum.kes;
    if (data.binancecoin?.kes)    rates.BNB   = data.binancecoin.kes;
    if (data["matic-network"]?.kes) rates.MATIC = data["matic-network"].kes;
    if (data.tron?.kes)           rates.TRX   = data.tron.kes;
    if (data["wrapped-bitcoin"]?.kes) rates.WBTC = data["wrapped-bitcoin"].kes;
    if (data.chainlink?.kes)      rates.LINK  = data.chainlink.kes;
  } catch {
    console.warn("[check-deposits] CoinGecko fetch failed, using env var fallbacks");
  }
  return rates;
}

function toKes(amount: number, crypto: string, rates: Rates): number {
  const rate = rates[crypto] ?? rates.USDT;
  return parseFloat((amount * rate).toFixed(2));
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
                metadata:  { txHash: tx.txHash, crypto: addr.crypto, network: addr.network, cryptoAmount: amount, rate: rates[addr.crypto] ?? rates.USDT },
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
