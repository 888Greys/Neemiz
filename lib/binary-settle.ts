// Shared, server-authoritative settlement for binary digit contracts.
//
// Two callers settle trades: the user's settle route (driven by the browser
// poll) and the /api/cron/settle-binary sweep (catches trades whose browser
// went away). Both go through settleTradeWithDigit / voidTrade here so the
// money path lives in exactly one place.
//
// SAFETY: the PENDING -> WON/LOST/VOID transition is claimed with updateMany
// inside the transaction. Only the worker whose updateMany actually flips a
// row goes on to touch the wallet — so the user poll and the cron (or two
// concurrent requests) can never double-credit the same trade.

import { db } from "@/lib/db";
import { TransactionStatus, TransactionType, type BinaryTrade } from "@prisma/client";
import { retainedProfit } from "@/lib/house-retention";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { evaluateTrade, payoutRate } from "neemiz-binary-engine";
import { creditWinnings } from "@/lib/balance";

export { evaluateTrade, payoutRate };

/** Reveal the committed provably-fair seed + terms once a trade is terminal, so
 *  the win/refund ledger row carries everything needed to independently replay
 *  the outcome. No-op for trades placed without a proof. */
function pfRevealMetadata(trade: BinaryTrade) {
  if (!trade.pfCommitment || !trade.pfSignature || !trade.pfServerSeed) return {};
  return {
    pfReveal: {
      commitment: trade.pfCommitment,
      signature: trade.pfSignature,
      serverSeed: trade.pfServerSeed,
      clientSeed: trade.pfClientSeed,
      nonce: trade.pfNonce,
      payoutMultiplier: trade.pfPayoutMultiplier == null ? null : Number(trade.pfPayoutMultiplier),
      revealedAt: new Date().toISOString(),
    },
  };
}

export type SettleOutcome = "won" | "lost" | "already";

export type SettleResult = {
  outcome: SettleOutcome;
  exitDigit: number;
  winAmount: number;
};

/**
 * Atomically settle a PENDING trade against a server-derived exit digit.
 * Returns { outcome: "already" } if some other worker already settled it (no
 * wallet change happens in that case).
 */
export async function settleTradeWithDigit(trade: BinaryTrade, exitDigit: number): Promise<SettleResult> {
  const won         = evaluateTrade(trade.side, exitDigit, trade.targetDigit);
  const stake       = Number(trade.stake);
  const winAmount   = won ? Number(trade.payout) : 0;
  const grossPayout = Number(trade.payout);
  const retainedAmount = 0;
  const now = new Date();

  return db.$transaction(async (tx) => {
    // Claim the PENDING -> terminal transition. count === 0 means another
    // worker beat us to it; bail out without touching the wallet.
    const claimed = await tx.binaryTrade.updateMany({
      where: { id: trade.id, status: "PENDING" },
      data:  { status: won ? "WON" : "LOST", exitDigit, settledAt: now },
    });
    if (claimed.count === 0) return { outcome: "already", exitDigit, winAmount: 0 };

    if (won) {
      await creditWinnings(tx, trade.userId, winAmount);
      await tx.transaction.create({
        data: {
          userId:    trade.userId,
          type:      TransactionType.BET_WIN,
          amount:    winAmount,
          currency:  "KES",
          status:    TransactionStatus.COMPLETED,
          reference: `binary-win-${trade.userId}-${trade.id}`,
          provider:  "binary",
          metadata:  { game: "binary", tradeId: trade.id, market: trade.market, side: trade.side, exitDigit, multiplier: Number(trade.payout) / stake, retainedAmount, ...pfRevealMetadata(trade) },
        },
      });
    }
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type:   won ? "BINARY_WON" : "BINARY_LOST",
        title:  won ? "Binary trade won" : "Binary trade settled",
        body:   won
          ? `${CURRENCY_SYMBOL} ${winAmount.toLocaleString(MONEY_LOCALE)} was credited to your wallet.`
          : `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} trade did not win.`,
        link:   "/binary",
      },
    });

    return { outcome: won ? "won" : "lost", exitDigit, winAmount };
  });
}

export type VoidResult = { outcome: "refunded" | "already" };

/**
 * Refund a PENDING trade's stake and mark it VOID. Used by the cron sweep for
 * trades that expired without ever getting a settlement digit (feed outage) —
 * the player never loses money to our infrastructure being down.
 */
export async function voidTrade(trade: BinaryTrade, reason: string): Promise<VoidResult> {
  const stake = Number(trade.stake);
  const now   = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.binaryTrade.updateMany({
      where: { id: trade.id, status: "PENDING" },
      data:  { status: "VOID", settledAt: now },
    });
    if (claimed.count === 0) return { outcome: "already" };

    await creditWinnings(tx, trade.userId, stake);
    await tx.transaction.create({
      data: {
        userId:    trade.userId,
        type:      TransactionType.REFUND,
        amount:    stake,
        currency:  "KES",
        status:    TransactionStatus.COMPLETED,
        reference: `binary-void-${trade.userId}-${trade.id}`,
        provider:  "binary",
        metadata:  { game: "binary", tradeId: trade.id, market: trade.market, side: trade.side, reason, ...pfRevealMetadata(trade) },
      },
    });
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type:   "BINARY_VOID",
        title:  "Binary trade refunded",
        body:   `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} stake was refunded — the trade couldn't be settled.`,
        link:   "/binary",
      },
    });

    return { outcome: "refunded" };
  });
}
