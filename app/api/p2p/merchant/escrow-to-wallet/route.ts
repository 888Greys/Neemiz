import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { creditUserCrypto } from "@/lib/p2p/crypto-balance";
import { defaultNetwork } from "@/lib/p2p/crypto-balance";
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

// POST /api/p2p/merchant/escrow-to-wallet — move crypto from escrow back into normal wallet
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

    const { crypto, amount } = body as { crypto: string; amount: number };
    if (!crypto || !amount) {
      return Response.json({ error: "crypto and amount are required" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Check escrow balance
    const escrow = await db.p2PCryptoBalance.findUnique({
      where: { merchantId_crypto: { merchantId: merchant.id, crypto } },
    });
    const available = Number(escrow?.available ?? 0);
    if (available < amountNum) {
      return Response.json({ error: "Insufficient available escrow balance" }, { status: 400 });
    }

    const network   = defaultNetwork(crypto);
    const rate      = await fetchRate(crypto);
    const kesAmount = parseFloat((amountNum * rate).toFixed(2));

    await db.$transaction(async (t) => {
      // Debit escrow
      await t.p2PCryptoBalance.update({
        where: { merchantId_crypto: { merchantId: merchant.id, crypto } },
        data: {
          total:     { decrement: amountNum },
          available: { decrement: amountNum },
        },
      });

      // Credit UserCryptoBalance
      await creditUserCrypto(t, dbUser.id, crypto, network, amountNum);

      // Credit KES to wallet
      await t.user.update({
        where: { id: dbUser.id },
        data:  { walletBalance: { increment: kesAmount } },
      });

      // Ledger
      await t.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.DEPOSIT,
          amount:    kesAmount,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `escrow-to-wallet-${Date.now()}`,
          provider:  "merchant_escrow",
          metadata:  { crypto, network, cryptoAmount: amountNum, rate, action: "escrow_to_wallet" },
        },
      });

      await t.notification.create({
        data: {
          userId: dbUser.id,
          type:   "wallet_deposit",
          title:  "Escrow moved to wallet",
          body:   `${amountNum} ${crypto} moved from escrow to your wallet.`,
          link:   "/dashboard",
        },
      });
    });

    return Response.json({ ok: true, crypto, network, amount: amountNum, kesAmount, rate });
  } catch (err) {
    console.error("POST /api/p2p/merchant/escrow-to-wallet:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
