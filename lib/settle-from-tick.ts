/**
 * Tick-driven settle wrappers — mirror the HTTP settle routes, then push Realtime.
 * No new money logic; never voids (cron owns that).
 */
import { db } from "@/lib/db";
import { getContractExitDigit, getServerTickHistory } from "@/lib/binary-price";
import { settleTradeWithDigit } from "@/lib/binary-settle";
import { resolveContract, type DirectionalSide } from "@/lib/directional";
import { finalizeDirectional } from "@/lib/directional-settle";
import { broadcastTradeSettled } from "@/lib/realtime-user";
import type { DueEntry } from "@/lib/settle-due-list";

export async function settleDueEntry(entry: DueEntry): Promise<"done" | "keep"> {
  if (entry.kind === "binary") return settleBinaryDue(entry);
  return settleDirectionalDue(entry);
}

async function settleBinaryDue(entry: DueEntry): Promise<"done" | "keep"> {
  const trade = await db.binaryTrade.findUnique({ where: { id: entry.tradeId } });
  if (!trade || trade.status !== "PENDING") return "done";
  if (trade.entryEpoch == null) return "keep"; // cron voids legacy
  if (Date.now() > trade.settleBefore.getTime()) return "done"; // cron voids

  let exit;
  try {
    exit = await getContractExitDigit(trade.market, trade.entryEpoch, trade.durationTicks);
  } catch (err) {
    console.warn("[settle-from-tick] binary digit fetch", err instanceof Error ? err.message : err);
    return "keep";
  }
  if (!exit.ready) return "keep";

  try {
    const result = await settleTradeWithDigit(trade, exit.digit);
    if (result.outcome === "already") return "done"; // other worker already pushed
    const won = result.outcome === "won";
    await broadcastTradeSettled(trade.userId, {
      kind: "binary",
      tradeId: trade.id,
      outcome: result.outcome,
      winAmount: result.winAmount,
      entryDigit: trade.entryDigit,
      exitDigit: result.exitDigit,
      status: won ? "WON" : "LOST",
    });
    return "done";
  } catch (err) {
    console.warn("[settle-from-tick] binary settle", err instanceof Error ? err.message : err);
    return "keep";
  }
}

async function settleDirectionalDue(entry: DueEntry): Promise<"done" | "keep"> {
  const trade = await db.directionalTrade.findUnique({ where: { id: entry.tradeId } });
  if (!trade || trade.status !== "PENDING") return "done";
  if (Date.now() > trade.settleBefore.getTime()) return "done";

  let ticks;
  try {
    ticks = await getServerTickHistory(trade.market, trade.entryEpoch, trade.durationTicks + 20);
  } catch (err) {
    console.warn("[settle-from-tick] directional history", err instanceof Error ? err.message : err);
    return "keep";
  }

  const resolution = resolveContract({
    kind: trade.kind,
    side: trade.side as DirectionalSide,
    entrySpot: Number(trade.entrySpot),
    barrier: trade.barrier == null ? null : Number(trade.barrier),
    durationTicks: trade.durationTicks,
    stake: Number(trade.stake),
    payout: Number(trade.payout),
    payoutPerPoint: trade.payoutPerPoint == null ? null : Number(trade.payoutPerPoint),
  }, ticks);

  if (!resolution.ready) return "keep";

  try {
    const result = await finalizeDirectional(trade, {
      won: resolution.won,
      credit: resolution.credit,
      exitSpot: resolution.exitSpot,
    });
    if (result.outcome === "already") return "done"; // other worker already pushed
    const won = result.outcome === "won";
    await broadcastTradeSettled(trade.userId, {
      kind: "directional",
      tradeId: trade.id,
      outcome: result.outcome,
      winAmount: result.winAmount,
      exitSpot: result.exitSpot,
      status: won ? "WON" : "LOST",
    });
    return "done";
  } catch (err) {
    console.warn("[settle-from-tick] directional settle", err instanceof Error ? err.message : err);
    return "keep";
  }
}
