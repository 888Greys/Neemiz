import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { randomInt } from "crypto";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";

const MIN_SPIN_AMOUNT = 10;

// Wheel segments — must match the client definition exactly (same order, same index)
const SEGMENTS = [
  { label: "×1.25", mult: 1.25 },
  { label: "×0",    mult: 0    },
  { label: "×1.5",  mult: 1.5  },
  { label: "×1.25", mult: 1.25 },
  { label: "×2",    mult: 2    },
  { label: "×0",    mult: 0    },
  { label: "×5",    mult: 5    },
  { label: "×1.25", mult: 1.25 },
];

// Professional payout curve: frequent small ×1.25 wins, a chunk of ×0, rare ×5.
// Players win ~65% of spins (mostly the small ×1.25) so it feels rewarding,
// while the house keeps an edge: raw RTP ≈ 0.92, effective ≈ 0.84 after the
// 30% profit retention applied to winnings.
// Segment indices:   0    1   2    3   4   5  6   7
const WEIGHTS =     [ 22, 18,  8,  22,  6, 17, 1,  6]; // out of 100 total

function weightedRandom(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = randomInt(total);
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r < 0) return i;
  }
  return WEIGHTS.length - 1;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { amount: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { amount } = body;
  if (!amount || amount < MIN_SPIN_AMOUNT) {
    return Response.json({ error: `Minimum spin amount is KSh ${MIN_SPIN_AMOUNT}` }, { status: 400 });
  }

  const segIdx    = weightedRandom();
  const segment   = SEGMENTS[segIdx];
  const grossWinAmount = parseFloat((amount * segment.mult).toFixed(2));
  const winAmount = applyProfitRetention(amount, grossWinAmount);
  const retainedAmount = retainedProfit(amount, grossWinAmount);
  const netChange = parseFloat((winAmount - amount).toFixed(2)); // negative if mult=0

  try {
    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    await db.$transaction(async (tx) => {
      // Deduct stake
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: amount } },
        data:  { walletBalance: { decrement: amount } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      await tx.transaction.create({
        data: {
          userId:   dbUser.id,
          type:     TransactionType.BET_STAKE,
          amount:   amount,
          currency: "KES",
          status:   TransactionStatus.COMPLETED,
          reference: `wheel-spin-${Date.now()}`,
          metadata: { game: "wheel", segment: segment.label, multiplier: segment.mult, grossWinAmount, retainedAmount },
        },
      });

      // Credit winnings if multiplier > 0
      if (winAmount > 0) {
        await tx.user.update({
          where: { id: dbUser.id },
          data:  { walletBalance: { increment: winAmount } },
        });

        await tx.transaction.create({
          data: {
            userId:   dbUser.id,
            type:     TransactionType.BET_WIN,
            amount:   winAmount,
            currency: "KES",
            status:   TransactionStatus.COMPLETED,
            reference: `wheel-win-${Date.now()}`,
            metadata: { game: "wheel", segment: segment.label, multiplier: segment.mult },
          },
        });
      }
    });
  } catch (err: unknown) {
    if ((err as Error).message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Wheel spin error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json({
    segmentIndex: segIdx,
    label:        segment.label,
    multiplier:   segment.mult,
    stake:        amount,
    winAmount:    winAmount,
    grossWinAmount,
    retainedAmount,
    netChange:    netChange,
  });
}
