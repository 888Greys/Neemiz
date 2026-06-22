// Shared, server-authoritative settlement for leveraged contracts (Multipliers,
// Turbos). Used by the cash-out route (browser-driven) and the settle-leveraged
// cron (catches contracts whose browser vanished). Both finalize through here, so
// the money path lives in one place.
//
// SAFETY: the OPEN -> terminal transition is an atomic updateMany WHERE
// status=OPEN. Only the worker that flips the row touches the wallet, so a
// cash-out, the cron, and concurrent requests can never double-pay or pay a
// stopped/knocked-out contract. House edge = the standard 30% profit retention on
// the gross payout (stop-out/knockout truncation adds to it).

import { db } from "@/lib/db";
import { TransactionStatus, TransactionType, type LeveragedTrade } from "@prisma/client";
import { applyProfitRetention, retainedProfit } from "@/lib/house-retention";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

export type LeveragedTerminal = "CLOSED" | "STOPPED" | "KNOCKED_OUT";

export type FinalizeResult = {
  outcome: "closed" | "stopped" | "knocked_out" | "already";
  creditedPayout: number; // KSh actually paid to the user (0 for stop-out/knockout)
  exitSpot: number;
};

/**
 * Finalize an OPEN leveraged contract to a terminal state.
 * - "CLOSED": pay the gross payout after 30% profit retention (a stop-loss/break-
 *   even pays back the remaining equity with no profit, so retention is a no-op).
 * - "STOPPED" / "KNOCKED_OUT": no payout (the stake was already debited at buy).
 * Returns { outcome: "already" } if another worker settled it first.
 */
export async function finalizeLeveraged(
  trade: LeveragedTrade,
  opts: {
    status: LeveragedTerminal;
    grossPayout: number; // unrounded; ignored for stop-out / knockout
    exitSpot: number;
    reason: string; // "cash_out" | "take_profit" | "stop_loss" | "profit_cap" | "stop_out" | "knockout"
  },
): Promise<FinalizeResult> {
  const stake = Number(trade.stake);
  const closed = opts.status === "CLOSED";
  const grossPayout = closed ? Number(opts.grossPayout.toFixed(2)) : 0;
  const creditedPayout = closed ? applyProfitRetention(stake, grossPayout) : 0;
  const retainedAmount = closed ? retainedProfit(stake, grossPayout) : 0;
  const exitSpot = Number(opts.exitSpot.toFixed(5));
  const now = new Date();

  const terminalOutcome = closed ? "closed" : opts.status === "STOPPED" ? "stopped" : "knocked_out";

  return db.$transaction(async (tx) => {
    const claimed = await tx.leveragedTrade.updateMany({
      where: { id: trade.id, status: "OPEN" },
      data: { status: opts.status, payout: creditedPayout, exitSpot, settledAt: now },
    });
    if (claimed.count === 0) {
      return { outcome: "already", creditedPayout: 0, exitSpot };
    }

    if (creditedPayout > 0) {
      await tx.user.update({
        where: { id: trade.userId },
        data: { walletBalance: { increment: creditedPayout } },
      });
      await tx.transaction.create({
        data: {
          userId: trade.userId,
          type: TransactionType.BET_WIN,
          amount: creditedPayout,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `leveraged-close-${trade.id}`,
          provider: "leveraged",
          metadata: {
            game: "leveraged", tradeId: trade.id, market: trade.market, kind: trade.kind,
            direction: trade.direction, reason: opts.reason, grossPayout, retainedAmount,
          },
        },
      });
    }

    const profit = creditedPayout >= stake;
    const kindLabel = trade.kind === "MULTIPLIER" ? "Multiplier" : "Turbo";
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: closed ? (profit ? "LEVERAGED_WON" : "LEVERAGED_CLOSED") : "LEVERAGED_LOST",
        title: closed
          ? (profit ? `${kindLabel} closed in profit` : `${kindLabel} closed`)
          : `${kindLabel} ${opts.status === "STOPPED" ? "stopped out" : "knocked out"}`,
        body: closed
          ? `${CURRENCY_SYMBOL} ${creditedPayout.toLocaleString(MONEY_LOCALE)} was credited to your wallet.`
          : `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} ${kindLabel.toLowerCase()} ${opts.status === "STOPPED" ? "hit its stop-out" : "hit its knockout barrier"}.`,
        link: "/binary",
      },
    });

    return { outcome: terminalOutcome, creditedPayout, exitSpot };
  });
}

export type VoidResult = { outcome: "refunded" | "already" };

/** Refund an OPEN leveraged contract's stake and mark it VOID (unsettleable). */
export async function voidLeveraged(trade: LeveragedTrade, reason: string): Promise<VoidResult> {
  const stake = Number(trade.stake);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.leveragedTrade.updateMany({
      where: { id: trade.id, status: "OPEN" },
      data: { status: "VOID", payout: stake, settledAt: now },
    });
    if (claimed.count === 0) return { outcome: "already" };

    await tx.user.update({
      where: { id: trade.userId },
      data: { walletBalance: { increment: stake } },
    });
    await tx.transaction.create({
      data: {
        userId: trade.userId,
        type: TransactionType.REFUND,
        amount: stake,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference: `leveraged-void-${trade.id}`,
        provider: "leveraged",
        metadata: { game: "leveraged", tradeId: trade.id, market: trade.market, kind: trade.kind, reason },
      },
    });
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: "LEVERAGED_VOID",
        title: "Contract refunded",
        body: `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} stake was refunded — the contract couldn't be settled.`,
        link: "/binary",
      },
    });

    return { outcome: "refunded" };
  });
}
