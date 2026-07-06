import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { applyProfitRetention } from "@/lib/house-retention";
// Single source of truth for the payout rate — shared with settlement so the
// rate a trade is priced at can never drift from the rate it settles on.
// House edge ~5% on all contract types; Over/Under scales with win probability
// so no barrier digit gives the player +EV.
import { payoutRate } from "@/lib/binary-settle";
import { isBetTypeDisabled, isBinaryOptionsInMaintenance, BINARY_MAINTENANCE_MESSAGE } from "@/lib/game-guard";
import { CURRENCY_SYMBOL } from "@/lib/currency";

const VALID_MARKETS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const VALID_SIDES   = ["Even", "Odd", "Matches", "Differs", "Over", "Under"];
const MIN_STAKE     = 10;
const MAX_STAKE     = 10_000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (await isBinaryOptionsInMaintenance())
    return Response.json({ error: BINARY_MAINTENANCE_MESSAGE }, { status: 503 });

  // Throttle bet placement per user — defense-in-depth against settlement/stake spam.
  const rl = rateLimit(`binary-bet:${user.id}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: { market?: string; side?: string; stake?: number; targetDigit?: number; entryDigit?: number; durationTicks?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const { market, side, stake, targetDigit, entryDigit, durationTicks } = body;

  if (!market || !VALID_MARKETS.includes(market))
    return Response.json({ error: "Invalid market" }, { status: 400 });
  if (!side || !VALID_SIDES.includes(side))
    return Response.json({ error: "Invalid side" }, { status: 400 });
  if (await isBetTypeDisabled("binary", side))
    return Response.json({ error: "This bet type is temporarily unavailable while we complete maintenance." }, { status: 503 });
  if (!Number.isFinite(stake) || stake! < MIN_STAKE || stake! > MAX_STAKE)
    return Response.json({ error: `Stake must be between ${CURRENCY_SYMBOL} ${MIN_STAKE} and ${CURRENCY_SYMBOL} ${MAX_STAKE.toLocaleString()}` }, { status: 400 });
  if (!Number.isInteger(entryDigit) || entryDigit! < 0 || entryDigit! > 9)
    return Response.json({ error: "Invalid entry digit" }, { status: 400 });
  if (!Number.isInteger(targetDigit) || targetDigit! < 0 || targetDigit! > 9)
    return Response.json({ error: "Invalid target digit" }, { status: 400 });
  // Block zero-probability bets (Over 9 = impossible; Under 0 = impossible)
  if (side === "Over"  && targetDigit! >= 9) return Response.json({ error: "Invalid target: no digit is greater than 9" }, { status: 400 });
  if (side === "Under" && targetDigit! <= 0) return Response.json({ error: "Invalid target: no digit is less than 0"    }, { status: 400 });

  const ticks       = Math.max(1, Math.min(30, durationTicks ?? 5));
  const stakeVal    = stake!;
  const grossPayout = Number((stakeVal * payoutRate(side, targetDigit!)).toFixed(2));
  const payoutVal   = applyProfitRetention(stakeVal, grossPayout);
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
          metadata:  { game: "binary", tradeId: trade.id, market, side, targetDigit, durationTicks: ticks, grossPayout },
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
