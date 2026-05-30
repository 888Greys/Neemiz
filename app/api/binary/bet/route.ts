import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";

const VALID_MARKETS = ["R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const VALID_SIDES   = ["Even", "Odd", "Matches", "Differs", "Over", "Under"];
const MIN_STAKE     = 10;
const MAX_STAKE     = 10_000;

// House edge ~5% on all contract types.
// Over/Under payout scales with win probability so no digit gives player +EV.
function payoutRate(side: string, targetDigit: number): number {
  if (side === "Matches") return 9.15;  // 1/10 win → 8.5% edge
  if (side === "Differs") return 1.05;  // 9/10 win → 5.5% edge
  if (side === "Even" || side === "Odd") return 1.90; // 5/10 win → 5% edge
  if (side === "Over") {
    const wins = 9 - targetDigit; // digits strictly > targetDigit
    return Math.floor((9.5 / wins) * 100) / 100; // floor keeps house edge ≥ 5%
  }
  // Under: digits strictly < targetDigit
  const wins = targetDigit;
  return Math.floor((9.5 / wins) * 100) / 100;
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
  // Block zero-probability bets (Over 9 = impossible; Under 0 = impossible)
  if (side === "Over"  && targetDigit >= 9) return Response.json({ error: "Invalid target: no digit is greater than 9" }, { status: 400 });
  if (side === "Under" && targetDigit <= 0) return Response.json({ error: "Invalid target: no digit is less than 0"    }, { status: 400 });

  const ticks       = Math.max(1, Math.min(30, durationTicks ?? 5));
  const stakeVal    = stake!;
  const payoutVal   = Number((stakeVal * payoutRate(side, targetDigit!)).toFixed(2));
  const settleBefore = new Date(Date.now() + ticks * 1000 + 90_000); // +90s buffer — covers tick-stream stalls

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
