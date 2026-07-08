// Shared, server-authoritative settlement for directional contracts (Rise/Fall,
// Higher/Lower). Used by the settle route (browser poll) and the cron sweep.
//
// SAFETY: the PENDING -> terminal transition is an atomic updateMany WHERE
// status=PENDING. Only the worker that flips the row credits the wallet, so the
// poll and the cron can never double-pay. The exit spot is always fetched
// server-side — the client value is never trusted.

import { db } from "@/lib/db";
import { TransactionStatus, TransactionType, type DirectionalTrade } from "@prisma/client";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { creditWinnings } from "@/lib/balance";

export type SettleResult = { outcome: "won" | "lost" | "already"; winAmount: number; exitSpot: number };

function pfRevealMetadata(trade: DirectionalTrade) {
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

/**
 * Atomically finalize a PENDING directional trade given a resolved outcome
 * (won + credit + exit spot computed by resolveContract). `credit` is the KSh
 * to pay (0 for a loss; a partial amount is possible for a vanilla that expired
 * slightly in-the-money). Only the worker that flips the row pays out.
 */
export async function finalizeDirectional(
  trade: DirectionalTrade,
  opts: { won: boolean; credit: number; exitSpot: number },
): Promise<SettleResult> {
  const credit = Number(Math.max(0, opts.credit).toFixed(2));
  const exit = Number(opts.exitSpot.toFixed(5));
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.directionalTrade.updateMany({
      where: { id: trade.id, status: "PENDING" },
      data:  { status: opts.won ? "WON" : "LOST", exitSpot: exit, settledAt: now },
    });
    if (claimed.count === 0) return { outcome: "already", winAmount: 0, exitSpot: exit };

    if (credit > 0) {
      await creditWinnings(tx, trade.userId, credit);
      await tx.transaction.create({
        data: {
          userId: trade.userId,
          type: TransactionType.BET_WIN,
          amount: credit,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `directional-win-${trade.userId}-${trade.id}`,
          provider: "directional",
          metadata: {
            game: "directional", tradeId: trade.id, market: trade.market, kind: trade.kind, side: trade.side,
            entrySpot: Number(trade.entrySpot), exitSpot: exit, barrier: trade.barrier == null ? null : Number(trade.barrier),
            ...pfRevealMetadata(trade),
          },
        },
      });
    }
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: opts.won ? "DIRECTIONAL_WON" : "DIRECTIONAL_LOST",
        title: opts.won ? "Trade won" : "Trade settled",
        body: credit > 0
          ? `${CURRENCY_SYMBOL} ${credit.toLocaleString(MONEY_LOCALE)} was credited to your wallet.`
          : `Your ${CURRENCY_SYMBOL} ${Number(trade.stake).toLocaleString(MONEY_LOCALE)} ${trade.side.toLowerCase()} trade did not win.`,
        link: "/binary",
      },
    });

    return { outcome: opts.won ? "won" : "lost", winAmount: credit, exitSpot: exit };
  });
}

export type VoidResult = { outcome: "refunded" | "already" };

/** Refund a PENDING directional trade's stake and mark it VOID (unsettleable). */
export async function voidDirectional(trade: DirectionalTrade, reason: string): Promise<VoidResult> {
  const stake = Number(trade.stake);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.directionalTrade.updateMany({
      where: { id: trade.id, status: "PENDING" },
      data:  { status: "VOID", settledAt: now },
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
        reference: `directional-void-${trade.userId}-${trade.id}`,
        provider: "directional",
        metadata: { game: "directional", tradeId: trade.id, market: trade.market, kind: trade.kind, side: trade.side, reason, ...pfRevealMetadata(trade) },
      },
    });
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: "DIRECTIONAL_VOID",
        title: "Trade refunded",
        body: `Your ${CURRENCY_SYMBOL} ${stake.toLocaleString(MONEY_LOCALE)} stake was refunded — the trade couldn't be settled.`,
        link: "/binary",
      },
    });

    return { outcome: "refunded" };
  });
}
