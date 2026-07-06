import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { p2pBlockedResponse } from "@/lib/p2p/user-guard";
import { debitUserCrypto } from "@/lib/p2p/crypto-balance";
import { TransactionType, TransactionStatus } from "@prisma/client";

const VALID_NETWORKS: Record<string, string[]> = {
  USDT: ["TRC20", "ERC20", "BEP20"],
  USDC: ["ERC20", "POLYGON"],
  BTC:  ["BTC"],
  ETH:  ["ERC20"],
  BNB:  ["BEP20"],
};

// POST /api/p2p/merchant/fund — move crypto from normal wallet into merchant escrow
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser   = await getOrCreateUser(user.id, { email: user.email });

    const p2pDenied = await p2pBlockedResponse(dbUser.email);
    if (p2pDenied) return p2pDenied;    const merchant = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
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

    if (!VALID_NETWORKS[crypto]?.includes(network)) {
      return Response.json({ error: `Invalid network for ${crypto}` }, { status: 400 });
    }

    await db.$transaction(async (t) => {
      // Debit UserCryptoBalance — throws INSUFFICIENT_CRYPTO_BALANCE if short
      await debitUserCrypto(t, dbUser.id, crypto, network, amountNum);

      // Credit merchant escrow — no KES involved
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

      // Audit log
      await t.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.WITHDRAWAL,
          amount:    amountNum,
          currency:  crypto,
          status:    TransactionStatus.COMPLETED,
          reference: `escrow-fund-${Date.now()}`,
          provider:  "merchant_escrow",
          metadata:  { crypto, network, cryptoAmount: amountNum, action: "fund_escrow" },
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

    return Response.json({ ok: true, crypto, network, amount: amountNum });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_CRYPTO_BALANCE") {
      return Response.json({ error: "Insufficient crypto balance in wallet" }, { status: 400 });
    }
    console.error("POST /api/p2p/merchant/fund:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
