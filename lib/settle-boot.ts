/**
 * Boot wiring for tick-driven settlement: attach feed listener + rebuild due-list.
 * Idempotent across HMR / repeated register() calls.
 */
import { addTickListener, startDerivFeed, type TickListener } from "@/lib/deriv-feed";
import { onSymbolTick, rebuildFromDb, setDueSettleFn } from "@/lib/settle-due-list";
import { settleDueEntry } from "@/lib/settle-from-tick";

const globalForBoot = globalThis as unknown as {
  __neemizSettleBooted?: boolean;
  __neemizSettleTickListener?: TickListener;
};

export async function startTickSettlement(): Promise<void> {
  startDerivFeed();
  setDueSettleFn(settleDueEntry);

  if (!globalForBoot.__neemizSettleTickListener) {
    const listener: TickListener = (symbol, tick) => {
      onSymbolTick(symbol, tick.epoch);
    };
    globalForBoot.__neemizSettleTickListener = listener;
    addTickListener(listener);
  }

  if (globalForBoot.__neemizSettleBooted) return;
  globalForBoot.__neemizSettleBooted = true;

  try {
    const n = await rebuildFromDb();
    if (n > 0) console.info(`[settle-boot] rebuilt ${n} pending trades into due-list`);
  } catch (err) {
    // Don't leave booted=true stuck if DB was briefly down — allow retry.
    globalForBoot.__neemizSettleBooted = false;
    console.warn("[settle-boot] rebuildFromDb failed", err instanceof Error ? err.message : err);
  }
}
