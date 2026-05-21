import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionType, TransactionStatus } from "@prisma/client";

// Wheel segments — must match the client definition exactly (same order, same index)
const SEGMENTS = [
  { label: "×1.5", mult: 1.5 },
  { label: "×2",   mult: 2   },
  { label: "×0",   mult: 0   },
  { label: "×3",   mult: 3   },
  { label: "×1.5", mult: 1.5 },
  { label: "×2",   mult: 2   },
  { label: "×5",   mult: 5   },
  { label: "×3",   mult: 3   },
];

// Weighted random: ×0 and ×5 are rare; ×1.5 and ×2 are common
const WEIGHTS = [25, 22, 8, 15, 25, 22, 3, 15]; // out of 135 total weight
// Segment indices:  0   1   2   3   4   5  6   7

function weightedRandom(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
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
  if (!amount || amount < 12.96) {
    return Response.json({ error: "Minimum spin amount is KSh 12.96" }, { status: 400 });
  }

  const segIdx    = weightedRandom();
  const segment   = SEGMENTS[segIdx];
  const winAmount = parseFloat((amount * segment.mult).toFixed(2));
  const netChange = parseFloat((winAmount - amount).toFixed(2)); // negative if mult=0

  try {
    await db.$transaction(async (tx) => {
      const dbUser = await getOrCreateUser(user.id, { email: user.email });
      const balance = Number(dbUser.walletBalance);

      if (balance < amount) throw new Error("INSUFFICIENT_BALANCE");

      // Deduct stake
      await tx.user.update({
        where: { id: dbUser.id },
        data:  { walletBalance: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          userId:   dbUser.id,
          type:     TransactionType.BET_STAKE,
          amount:   amount,
          currency: "KES",
          status:   TransactionStatus.COMPLETED,
          reference: `wheel-spin-${Date.now()}`,
          metadata: { game: "wheel", segment: segment.label, multiplier: segment.mult },
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
    netChange:    netChange,
  });
}
