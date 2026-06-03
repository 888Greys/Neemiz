import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { creditKesCoinBalance, debitKesCoinBalance } from "@/lib/p2p/crypto-balance";
import { TransactionStatus, TransactionType } from "@prisma/client";

export const runtime = "nodejs";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 1_000_000;

type ConvertDirection = "fiat_to_kes" | "kes_to_fiat";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: { amount?: number; direction?: ConvertDirection };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const amount = Number(body.amount);
    const direction = body.direction;

    if (direction !== "fiat_to_kes" && direction !== "kes_to_fiat") {
      return Response.json({ error: "Invalid convert direction" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
      return Response.json({ error: `Minimum conversion is KSh ${MIN_AMOUNT}` }, { status: 400 });
    }
    if (amount > MAX_AMOUNT) {
      return Response.json({ error: `Maximum conversion is KSh ${MAX_AMOUNT.toLocaleString("en-KE")}` }, { status: 400 });
    }

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const result = await db.$transaction(async (tx) => {
      if (direction === "fiat_to_kes") {
        const debited = await tx.user.updateMany({
          where: { id: dbUser.id, walletBalance: { gte: amount } },
          data:  { walletBalance: { decrement: amount } },
        });
        if (debited.count === 0) throw new Error("INSUFFICIENT_FIAT_BALANCE");
        await creditKesCoinBalance(tx, dbUser.id, amount);
      } else {
        await debitKesCoinBalance(tx, dbUser.id, amount);
        await tx.user.update({
          where: { id: dbUser.id },
          data:  { walletBalance: { increment: amount } },
        });
      }

      await tx.transaction.create({
        data: {
          userId:   dbUser.id,
          type:     direction === "fiat_to_kes" ? TransactionType.WITHDRAWAL : TransactionType.DEPOSIT,
          amount,
          currency: "KES",
          status:   TransactionStatus.COMPLETED,
          reference: `kes-convert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          provider: "kes_coin_convert",
          metadata: { direction, rate: 1 },
        },
      });

      const [freshUser, kesCoin] = await Promise.all([
        tx.user.findUnique({ where: { id: dbUser.id }, select: { walletBalance: true } }),
        tx.userCryptoBalance.findUnique({
          where: { userId_crypto_network: { userId: dbUser.id, crypto: "KES", network: "KES" } },
          select: { available: true, locked: true },
        }),
      ]);

      return {
        fiatBalance: Number(freshUser?.walletBalance ?? 0),
        kesAvailable: Number(kesCoin?.available ?? 0),
        kesLocked: Number(kesCoin?.locked ?? 0),
      };
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "INSUFFICIENT_FIAT_BALANCE" || msg === "INSUFFICIENT_KES_COIN_BALANCE") return msg;
      throw err;
    });

    if (result === "INSUFFICIENT_FIAT_BALANCE") {
      return Response.json({ error: "Insufficient fiat wallet balance" }, { status: 400 });
    }
    if (result === "INSUFFICIENT_KES_COIN_BALANCE") {
      return Response.json({ error: "Insufficient KES Coin balance" }, { status: 400 });
    }

    return Response.json({ ok: true, direction, amount, ...result });
  } catch (err) {
    console.error("POST /api/wallet/convert:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
