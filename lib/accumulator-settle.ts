// Shared, server-authoritative settlement for accumulator contracts.
//
// Used by the cash-out route (browser-driven) and the settle-accumulators cron
// (catches contracts whose browser vanished). Both finalize through here, so the
// money path lives in one place.
//
// SAFETY: the OPEN -> terminal transition is an atomic updateMany WHERE
// status=OPEN. Only the worker that flips the row touches the wallet, so a
// cash-out, the cron, and concurrent requests can never double-pay or pay a
// busted contract. House edge = the standard 30% profit retention on the grown
// payout (the barrier itself is fair).

import { db } from "@/lib/db";
import { TransactionStatus, TransactionType, type AccumulatorTrade } from "@prisma/client";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { creditWinnings } from "@/lib/balance";

export type FinalizeResult = {
  outcome: "closed" | "busted" | "already";
  creditedPayout: number; // KSh actually paid to the user (0 for bust)
  ticksSurvived: number;
  exitSpot: number;
};

/**
 * Finalize an OPEN accumulator to a terminal state.
 * - status "CLOSED": pay the grown payout (after 30% profit retention).
 * - status "BUSTED": no payout (the stake was already debited at buy).
 * Returns { outcome: "already" } if another worker settled it first — no wallet
 * change happens in that case.
 */
export async function finalizeAccumulator(
  trade: AccumulatorTrade,
  opts: {
    status: "CLOSED" | "BUSTED";
    grossPayout: number; // unrounded grown payout; ignored for a bust
    ticksSurvived: number;
    exitSpot: number;
    reason: string; // "cash_out" | "take_profit" | "max_ticks" | "breach"
  },
): Promise<FinalizeResult> {
  const stake = Number(trade.stake);
  const won = opts.status === "CLOSED";
  const grossPayout = won ? Number(opts.grossPayout.toFixed(2)) : 0;
  const creditedPayout = won ? applyProfitRetention(stake, grossPayout) : 0;
  const retainedAmount = won ? retainedProfit(stake, grossPayout) : 0;
  const exitSpot = Number(opts.exitSpot.toFixed(5));
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.accumulatorTrade.updateMany({
      where: { id: trade.id, status: "OPEN" },
      data: {
        status: opts.status,
        payout: creditedPayout,
        ticksSurvived: opts.ticksSurvived,
        exitSpot,
        settledAt: now,
      },
    });
    if (claimed.count === 0) {
      return { outcome: "already", creditedPayout: 0, ticksSurvived: opts.ticksSurvived, exitSpot };
    }

    if (won && creditedPayout > 0) {
      await creditWinnings(tx, trade.userId, creditedPayout);
      await tx.transaction.create({
        data: {
          userId: trade.userId,
          type: TransactionType.BET_WIN,
          amount: creditedPayout,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `accumulator-close-${trade.id}`,
          provider: "accumulator",
          metadata: {
            game: "accumulator", tradeId: trade.id, market: trade.market,
            growthRate: trade.growthRate, ticksSurvived: opts.ticksSurvived,
            reason: opts.reason, grossPayout, retainedAmount,
          },
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: won ? "ACCUMULATOR_WON" : "ACCUMULATOR_LOST",
        title: won ? "Accumulator closed in profit" : "Accumulator busted",
        body: won
          ? `${CURRENCY_SYMBOL} ${creditedPayout.toLocaleString(MONEY_LOCALE)} was credited to your wallet (${opts.ticksSurvived} ticks).`
          : `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} accumulator hit the barrier and busted.`,
        link: "/binary",
      },
    });

    return { outcome: won ? "closed" : "busted", creditedPayout, ticksSurvived: opts.ticksSurvived, exitSpot };
  });
}

export type VoidResult = { outcome: "refunded" | "already" };

/** Refund an OPEN accumulator's stake and mark it VOID (unsettleable / feed outage). */
export async function voidAccumulator(trade: AccumulatorTrade, reason: string): Promise<VoidResult> {
  const stake = Number(trade.stake);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.accumulatorTrade.updateMany({
      where: { id: trade.id, status: "OPEN" },
      data: { status: "VOID", payout: stake, settledAt: now },
    });
    if (claimed.count === 0) return { outcome: "already" };

    await creditWinnings(tx, trade.userId, stake);
    await tx.transaction.create({
      data: {
        userId: trade.userId,
        type: TransactionType.REFUND,
        amount: stake,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference: `accumulator-void-${trade.id}`,
        provider: "accumulator",
        metadata: { game: "accumulator", tradeId: trade.id, market: trade.market, reason },
      },
    });
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: "ACCUMULATOR_VOID",
        title: "Accumulator refunded",
        body: `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} stake was refunded — the contract couldn't be settled.`,
        link: "/binary",
      },
    });

    return { outcome: "refunded" };
  });
}
