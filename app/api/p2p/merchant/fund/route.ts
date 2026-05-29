import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { debitUserCrypto } from "@/lib/p2p/crypto-balance";
import { TransactionType, TransactionStatus } from "@prisma/client";

const FALLBACK: Record<string, number> = {
  USDT:  Number(process.env.USDT_KES_RATE  ?? "128"),
  BTC:   Number(process.env.BTC_KES_RATE   ?? "14000000"),
  ETH:   Number(process.env.ETH_KES_RATE   ?? "420000"),
  BNB:   Number(process.env.BNB_KES_RATE   ?? "84000"),
};

const CG_IDS: Record<string, string> = {
  USDT: "tether",
  BTC:  "bitcoin",
  ETH:  "ethereum",
  BNB:  "binancecoin",
};

async function fetchRate(crypto: string): Promise<number> {
  const id = CG_IDS[crypto];
  if (!id) return FALLBACK[crypto] ?? FALLBACK.USDT;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=kes`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json() as Record<string, { kes?: number }>;
    return data[id]?.kes ?? (FALLBACK[crypto] ?? FALLBACK.USDT);
  } catch {
    return FALLBACK[crypto] ?? FALLBACK.USDT;
  }
}

// POST /api/p2p/merchant/fund — move crypto from normal wallet into merchant escrow
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (!merchant) return Response.json({ error: "Merchant account required" }, { status: 403 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { crypto, network, amount } = body as { crypto: string; network: string; amount: number };

    if (!crypto || !network || !amount) {
      return Response.json({ error: "crypto, network, and amount are required" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    const rate      = await fetchRate(crypto);
    const kesAmount = parseFloat((amountNum * rate).toFixed(2));

    await db.$transaction(async (t) => {
      // Debit UserCryptoBalance — throws INSUFFICIENT_CRYPTO_BALANCE if short
      await debitUserCrypto(t, dbUser.id, crypto, network, amountNum);

      // Deduct KES equivalent from walletBalance (clamp to 0 on rate drift)
      const updated = await t.user.update({
        where:  { id: dbUser.id },
        data:   { walletBalance: { decrement: kesAmount } },
        select: { walletBalance: true },
      });
      if (Number(updated.walletBalance) < 0) {
        await t.user.update({ where: { id: dbUser.id }, data: { walletBalance: 0 } });
      }

      // Credit merchant escrow
      await t.p2PCryptoBalance.upsert({
        where:  { merchantId_crypto: { merchantId: merchant.id, crypto } },
        create: { merchantId: merchant.id, crypto, total: amountNum, available: amountNum, locked: 0 },
        update: { total: { increment: amountNum }, available: { increment: amountNum } },
      });

      // Record in escrow deposit history
      await t.p2PCryptoDeposit.create({
        data: {
          merchantId: merchant.id,
          crypto,
          amount:     amountNum,
          txHash:     null,
          network,
          status:     "APPROVED",
        },
      });

      // Ledger entry
      await t.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.WITHDRAWAL,
          amount:    kesAmount,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `escrow-fund-${Date.now()}`,
          provider:  "merchant_escrow",
          metadata:  { crypto, network, cryptoAmount: amountNum, rate, action: "fund_escrow" },
        },
      });

      await t.notification.create({
        data: {
          userId: dbUser.id,
          type:   "crypto_deposit",
          title:  "Escrow funded",
          body:   `${amountNum} ${crypto} (${network}) moved to your merchant escrow.`,
          link:   "/p2p/merchant",
        },
      });
    });

    return Response.json({ ok: true, crypto, network, amount: amountNum, kesAmount, rate });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: "Insufficient crypto balance in wallet" }, { status: 400 });
    }
    console.error("POST /api/p2p/merchant/fund:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
