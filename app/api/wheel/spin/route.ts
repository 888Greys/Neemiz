import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { spendForPlay } from "@/lib/balance";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { randomInt } from "crypto";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";
import { CURRENCY_SYMBOL } from "@/lib/currency";

const MIN_SPIN_AMOUNT = 10;

// Wheel segments — must match the client definition exactly (same order, same index).
// 12 segments for variety; multipliers spread around the wheel.
const SEGMENTS = [
  { label: "×0.5", mult: 0.5 },
  { label: "×2",   mult: 2   },
  { label: "×0",   mult: 0   },
  { label: "×1.5", mult: 1.5 },
  { label: "×3",   mult: 3   },
  { label: "×0",   mult: 0   },
  { label: "×2",   mult: 2   },
  { label: "×0.5", mult: 0.5 },
  { label: "×5",   mult: 5   },
  { label: "×0",   mult: 0   },
  { label: "×1.5", mult: 1.5 },
  { label: "×10",  mult: 10  },
];

// Weighted random. ~95.5% RTP (≈4.5% house edge); ×0 lands ~42% of the time
// (was 70%), softened by frequent ×0.5/×1.5 partial wins and rare big multipliers.
// Segment indices: 0   1   2  3  4   5   6   7  8   9  10 11
const WEIGHTS =    [12,  5, 14, 8, 6, 14,  4, 12, 3, 14,  7, 1]; // sums to 100

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
  if (!Number.isFinite(amount) || amount < MIN_SPIN_AMOUNT) {
    return Response.json({ error: `Minimum spin amount is ${CURRENCY_SYMBOL} ${MIN_SPIN_AMOUNT}` }, { status: 400 });
  }

  const segIdx    = weightedRandom();
  const segment   = SEGMENTS[segIdx];
  const grossWinAmount = parseFloat((amount * segment.mult).toFixed(2));
  const winAmount = applyProfitRetention(amount, grossWinAmount);
  const retainedAmount = retainedProfit(amount, grossWinAmount);
  const netChange = parseFloat((winAmount - amount).toFixed(2));

  try {
    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    await db.$transaction(async (tx) => {
      // Deduct stake — bonus first, then real balance (identical to prior
      // behaviour for users with no bonus).
      await spendForPlay(tx, dbUser.id, amount);

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
