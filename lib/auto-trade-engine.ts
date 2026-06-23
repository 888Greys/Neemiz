// Server-side engine for the binary auto-trader. Places trades and advances
// each RUNNING session by one step. Called only by /api/cron/auto-trade (and
// reused by the start route to fire the first trade immediately).
//
// Settlement is NOT done here — auto trades are ordinary PENDING BinaryTrades,
// so the existing /api/cron/settle-binary sweep settles them server-side. This
// engine only *places* and *steps*, which keeps the authoritative win/loss
// logic in one place (the "outcomes settle server-side" rule).

import { db } from "@/lib/db";
import { TransactionStatus, TransactionType, type AutoTradeSession } from "@prisma/client";
import { getServerBinaryDigit } from "@/lib/binary-price";
import { payoutRate } from "@/lib/binary-settle";
import { applyProfitRetention } from "@/lib/house-retention";
import { nextStake, stopStatus, type AutoStrategy } from "@/lib/auto-trade";

const n = (d: unknown) => Number(d);

/**
 * Place one binary digit trade for a session at its currentStake. Atomically
 * debits the wallet; links the trade via autoSessionId; records the stake txn.
 * Throws "INSUFFICIENT_BALANCE" if the wallet can't cover the stake.
 */
async function placeNext(session: AutoTradeSession): Promise<string> {
  const stake = n(session.currentStake);
  const { digit: entryDigit } = await getServerBinaryDigit(session.market);

  const grossPayout = Number((stake * payoutRate(session.side, session.targetDigit)).toFixed(2));
  const payout      = applyProfitRetention(stake, grossPayout);
  const settleBefore = new Date(Date.now() + session.durationTicks * 1000 + 90_000);

  const tradeId = await db.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({
      where: { id: session.userId, walletBalance: { gte: stake } },
      data:  { walletBalance: { decrement: stake } },
    });
    if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

    const trade = await tx.binaryTrade.create({
      data: {
        userId:        session.userId,
        market:        session.market,
        side:          session.side,
        stake,
        payout,
        targetDigit:   session.targetDigit,
        entryDigit,
        durationTicks: session.durationTicks,
        settleBefore,
        status:        "PENDING",
        autoSessionId: session.id,
      },
    });

    await tx.transaction.create({
      data: {
        userId:    session.userId,
        type:      TransactionType.BET_STAKE,
        amount:    stake,
        currency:  "KES",
        status:    TransactionStatus.COMPLETED,
        reference: `binary-auto-stake-${session.id}-${trade.id}`,
        provider:  "binary",
        metadata:  { game: "binary", auto: true, sessionId: session.id, tradeId: trade.id, market: session.market, side: session.side },
      },
    });

    await tx.autoTradeSession.update({
      where: { id: session.id },
      data:  { lastTradeId: trade.id },
    });

    return trade.id;
  });

  return tradeId;
}

async function halt(sessionId: string, status: string, reason: string) {
  await db.autoTradeSession.update({
    where: { id: sessionId },
    // status is a Prisma enum; the string values match the enum members.
    data:  { status: status as never, stopReason: reason },
  });
}

export interface StepOutcome {
  sessionId: string;
  action: "placed" | "waiting" | "stopped";
  detail?: string;
}

/**
 * Advance one session by a single step:
 *  - first run (no lastTradeId)         → place the first trade
 *  - last trade still PENDING           → wait (in-flight)
 *  - last trade settled                 → book P&L, size next stake, check
 *                                          TP/SL/max-runs, then place or stop
 */
export async function stepSession(session: AutoTradeSession): Promise<StepOutcome> {
  if (session.status !== "RUNNING") return { sessionId: session.id, action: "waiting", detail: "not running" };

  // First trade of the session.
  if (!session.lastTradeId) {
    try {
      await placeNext(session);
      return { sessionId: session.id, action: "placed", detail: "first trade" };
    } catch (e) {
      await halt(session.id, "ERROR", e instanceof Error ? e.message : "place failed");
      return { sessionId: session.id, action: "stopped", detail: "ERROR" };
    }
  }

  const last = await db.binaryTrade.findUnique({ where: { id: session.lastTradeId } });
  if (!last) {
    await halt(session.id, "ERROR", "last trade missing");
    return { sessionId: session.id, action: "stopped", detail: "ERROR" };
  }

  // Still settling — nothing to do this tick.
  if (last.status === "PENDING") return { sessionId: session.id, action: "waiting", detail: "in-flight" };

  // VOID (refunded, feed outage): neutral — re-place at the same stake, no run counted.
  if (last.status === "VOID") {
    try {
      await placeNext(session);
      return { sessionId: session.id, action: "placed", detail: "re-place after VOID" };
    } catch (e) {
      await halt(session.id, "ERROR", e instanceof Error ? e.message : "place failed");
      return { sessionId: session.id, action: "stopped", detail: "ERROR" };
    }
  }

  // Settled WON / LOST — book the result.
  const won = last.status === "WON";
  const pnl = won ? n(last.payout) - n(last.stake) : -n(last.stake);

  const step = nextStake(
    session.strategy as AutoStrategy,
    { baseStake: n(session.baseStake), currentStake: n(session.currentStake), multiplier: n(session.multiplier), cyclePnl: n(session.cyclePnl) },
    won,
    pnl,
  );

  const runsDone = session.runsDone + 1;
  const totalPnl = n(session.totalPnl) + pnl;

  // Persist the booked result first (so progress is durable even if we stop).
  await db.autoTradeSession.update({
    where: { id: session.id },
    data: {
      runsDone,
      wins:   session.wins + (won ? 1 : 0),
      losses: session.losses + (won ? 0 : 1),
      totalPnl,
      cyclePnl: step.cyclePnl,
      currentStake: step.nextStake,
    },
  });

  // Stop conditions take priority over placing another trade.
  const terminal = stopStatus({
    totalPnl, runsDone,
    takeProfit: n(session.takeProfit),
    stopLoss:   n(session.stopLoss),
    maxRuns:    session.maxRuns,
  });
  if (terminal) {
    await halt(session.id, terminal, terminal === "DONE_TP" ? "take-profit reached"
      : terminal === "DONE_SL" ? "stop-loss reached" : "max runs reached");
    return { sessionId: session.id, action: "stopped", detail: terminal };
  }

  // Place the next trade at the freshly-sized stake.
  try {
    const fresh = await db.autoTradeSession.findUnique({ where: { id: session.id } });
    if (!fresh || fresh.status !== "RUNNING") return { sessionId: session.id, action: "waiting", detail: "stopped concurrently" };
    await placeNext(fresh);
    return { sessionId: session.id, action: "placed", detail: `run ${runsDone + 1}` };
  } catch (e) {
    await halt(session.id, "ERROR", e instanceof Error ? e.message : "place failed");
    return { sessionId: session.id, action: "stopped", detail: "ERROR" };
  }
}

/** Step every RUNNING session once. Returns a compact summary. */
export async function stepAllSessions(limit = 200): Promise<StepOutcome[]> {
  const running = await db.autoTradeSession.findMany({
    where: { status: "RUNNING" },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  const out: StepOutcome[] = [];
  for (const s of running) {
    try { out.push(await stepSession(s)); }
    catch (e) { out.push({ sessionId: s.id, action: "waiting", detail: e instanceof Error ? e.message : "error" }); }
  }
  return out;
}
