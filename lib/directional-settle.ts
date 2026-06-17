// Shared, server-authoritative settlement for directional contracts (Rise/Fall,
// Higher/Lower). Used by the settle route (browser poll) and the cron sweep.
//
// SAFETY: the PENDING -> terminal transition is an atomic updateMany WHERE
// status=PENDING. Only the worker that flips the row credits the wallet, so the
// poll and the cron can never double-pay. The exit spot is always fetched
// server-side — the client value is never trusted.

import { db } from "@/lib/db";
import { TransactionStatus, TransactionType, type DirectionalTrade } from "@prisma/client";
import { evaluateDirectional, type DirectionalSide } from "@/lib/directional";

export type SettleResult = { outcome: "won" | "lost" | "already"; winAmount: number; exitSpot: number };

/** Atomically settle a PENDING directional trade against a server-derived exit spot. */
export async function settleDirectionalWithExit(trade: DirectionalTrade, exitSpot: number): Promise<SettleResult> {
  const won = evaluateDirectional({
    kind: trade.kind,
    side: trade.side as DirectionalSide,
    entrySpot: Number(trade.entrySpot),
    exitSpot,
    barrier: trade.barrier == null ? null : Number(trade.barrier),
  });
  const winAmount = won ? Number(trade.payout) : 0;
  const exit = Number(exitSpot.toFixed(5));
  const now = new Date();

  return db.$transaction(async (tx) => {
    const claimed = await tx.directionalTrade.updateMany({
      where: { id: trade.id, status: "PENDING" },
      data:  { status: won ? "WON" : "LOST", exitSpot: exit, settledAt: now },
    });
    if (claimed.count === 0) return { outcome: "already", winAmount: 0, exitSpot: exit };

    if (won) {
      await tx.user.update({ where: { id: trade.userId }, data: { walletBalance: { increment: winAmount } } });
      await tx.transaction.create({
        data: {
          userId: trade.userId,
          type: TransactionType.BET_WIN,
          amount: winAmount,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference: `directional-win-${trade.userId}-${trade.id}`,
          provider: "directional",
          metadata: { game: "directional", tradeId: trade.id, market: trade.market, kind: trade.kind, side: trade.side, entrySpot: Number(trade.entrySpot), exitSpot: exit, barrier: trade.barrier == null ? null : Number(trade.barrier) },
        },
      });
    }
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: won ? "DIRECTIONAL_WON" : "DIRECTIONAL_LOST",
        title: won ? "Trade won" : "Trade settled",
        body: won
          ? `KSh ${winAmount.toLocaleString("en-KE")} was credited to your wallet.`
          : `Your KSh ${Number(trade.stake).toLocaleString("en-KE")} ${trade.side.toLowerCase()} trade did not win.`,
        link: "/binary",
      },
    });

    return { outcome: won ? "won" : "lost", winAmount, exitSpot: exit };
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

    await tx.user.update({ where: { id: trade.userId }, data: { walletBalance: { increment: stake } } });
    await tx.transaction.create({
      data: {
        userId: trade.userId,
        type: TransactionType.REFUND,
        amount: stake,
        currency: "KES",
        status: TransactionStatus.COMPLETED,
        reference: `directional-void-${trade.userId}-${trade.id}`,
        provider: "directional",
        metadata: { game: "directional", tradeId: trade.id, market: trade.market, kind: trade.kind, side: trade.side, reason },
      },
    });
    await tx.notification.create({
      data: {
        userId: trade.userId,
        type: "DIRECTIONAL_VOID",
        title: "Trade refunded",
        body: `Your KSh ${stake.toLocaleString("en-KE")} stake was refunded — the trade couldn't be settled.`,
        link: "/binary",
      },
    });

    return { outcome: "refunded" };
  });
}
