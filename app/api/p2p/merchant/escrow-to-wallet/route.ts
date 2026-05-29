import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { creditUserCrypto, defaultNetwork } from "@/lib/p2p/crypto-balance";
import { TransactionType, TransactionStatus } from "@prisma/client";

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

    const network = defaultNetwork(crypto);

    await db.$transaction(async (t) => {
      // Debit escrow
      await t.p2PCryptoBalance.update({
        where: { merchantId_crypto: { merchantId: merchant.id, crypto } },
        data: {
          total:     { decrement: amountNum },
          available: { decrement: amountNum },
        },
      });

      // Credit UserCryptoBalance only — no KES conversion
      await creditUserCrypto(t, dbUser.id, crypto, network, amountNum);

      // Audit log
      await t.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.DEPOSIT,
          amount:    amountNum,
          currency:  crypto,
          status:    TransactionStatus.COMPLETED,
          reference: `escrow-to-wallet-${Date.now()}`,
          provider:  "merchant_escrow",
          metadata:  { crypto, network, cryptoAmount: amountNum, action: "escrow_to_wallet" },
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

    return Response.json({ ok: true, crypto, network, amount: amountNum });
  } catch (err) {
    console.error("POST /api/p2p/merchant/escrow-to-wallet:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
