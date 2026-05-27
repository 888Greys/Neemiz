import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";

const VALID_MARKETS = ["R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const VALID_SIDES   = ["Even", "Odd", "Matches", "Differs", "Over", "Under"];
const MIN_STAKE     = 10;
const MAX_STAKE     = 10_000;

function payoutRate(side: string): number {
  if (side === "Matches") return 9.15;
  if (side === "Differs") return 1.12;
  return 1.952; // Even / Odd / Over / Under
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { market?: string; side?: string; stake?: number; targetDigit?: number; entryDigit?: number; durationTicks?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { market, side, stake, targetDigit, entryDigit, durationTicks } = body;

  if (!market || !VALID_MARKETS.includes(market))
    return Response.json({ error: "Invalid market" }, { status: 400 });
  if (!side || !VALID_SIDES.includes(side))
    return Response.json({ error: "Invalid side" }, { status: 400 });
  if (!Number.isFinite(stake) || stake! < MIN_STAKE || stake! > MAX_STAKE)
    return Response.json({ error: `Stake must be between KSh ${MIN_STAKE} and KSh ${MAX_STAKE.toLocaleString()}` }, { status: 400 });
  if (entryDigit === undefined || entryDigit < 0 || entryDigit > 9)
    return Response.json({ error: "Invalid entry digit" }, { status: 400 });
  if (targetDigit === undefined || targetDigit < 0 || targetDigit > 9)
    return Response.json({ error: "Invalid target digit" }, { status: 400 });

  const ticks       = Math.max(1, Math.min(30, durationTicks ?? 5));
  const stakeVal    = stake!;
  const payoutVal   = Number((stakeVal * payoutRate(side)).toFixed(2));
  const settleBefore = new Date(Date.now() + ticks * 1000 + 10_000); // +10s buffer

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  try {
    const result = await db.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: dbUser.id, walletBalance: { gte: stakeVal } },
        data:  { walletBalance: { decrement: stakeVal } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const trade = await tx.binaryTrade.create({
        data: {
          userId:       dbUser.id,
          market,
          side,
          stake:        stakeVal,
          payout:       payoutVal,
          targetDigit:  targetDigit!,
          entryDigit:   entryDigit!,
          durationTicks: ticks,
          settleBefore,
          status:       "PENDING",
        },
      });

      await tx.transaction.create({
        data: {
          userId:    dbUser.id,
          type:      TransactionType.BET_STAKE,
          amount:    stakeVal,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `binary-stake-${dbUser.id}-${trade.id}`,
          provider:  "binary",
          metadata:  { game: "binary", tradeId: trade.id, market, side, targetDigit, durationTicks: ticks },
        },
      });

      return trade;
    });

    return Response.json({ tradeId: result.id, payout: payoutVal }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE")
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    console.error("binary/bet error:", err);
    return Response.json({ error: "Failed to place trade" }, { status: 500 });
  }
}
