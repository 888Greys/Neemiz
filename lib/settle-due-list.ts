/**
 * In-memory due-list of PENDING digit/directional contracts for tick-driven settle.
 * Per-process (each cluster worker has its own). Atomic claim in finalize paths
 * makes dual-worker races safe ("already").
 */
import { db } from "@/lib/db";

export type DueKind = "binary" | "directional";

export type DueEntry = {
  kind: DueKind;
  tradeId: string;
  userId: string;
  market: string;
  entryEpoch: number;
  durationTicks: number;
  dueEpoch: number;
  settleBeforeMs: number;
};

type DueListState = {
  byMarket: Map<string, DueEntry[]>;
  byTradeId: Map<string, DueEntry>;
  inFlight: Set<string>;
  rebuilt: boolean;
};

const globalForDue = globalThis as unknown as { __neemizSettleDue?: DueListState };

function state(): DueListState {
  if (!globalForDue.__neemizSettleDue) {
    globalForDue.__neemizSettleDue = {
      byMarket: new Map(),
      byTradeId: new Map(),
      inFlight: new Set(),
      rebuilt: false,
    };
  }
  return globalForDue.__neemizSettleDue;
}

function sortByDue(a: DueEntry, b: DueEntry) {
  return a.dueEpoch - b.dueEpoch || a.tradeId.localeCompare(b.tradeId);
}

export function registerDue(entry: Omit<DueEntry, "dueEpoch"> & { dueEpoch?: number }): void {
  const dueEpoch = entry.dueEpoch ?? entry.entryEpoch + entry.durationTicks;
  const full: DueEntry = { ...entry, dueEpoch };
  if (!Number.isFinite(full.entryEpoch) || !Number.isFinite(full.durationTicks) || full.durationTicks < 1) return;
  if (Date.now() > full.settleBeforeMs) return;

  const s = state();
  const prev = s.byTradeId.get(full.tradeId);
  if (prev) {
    const list = s.byMarket.get(prev.market);
    if (list) {
      const idx = list.findIndex((e) => e.tradeId === full.tradeId);
      if (idx >= 0) list.splice(idx, 1);
    }
  }
  s.byTradeId.set(full.tradeId, full);
  let list = s.byMarket.get(full.market);
  if (!list) {
    list = [];
    s.byMarket.set(full.market, list);
  }
  list.push(full);
  list.sort(sortByDue);
}

export function unregisterDue(tradeId: string): void {
  const s = state();
  const entry = s.byTradeId.get(tradeId);
  if (!entry) return;
  s.byTradeId.delete(tradeId);
  s.inFlight.delete(tradeId);
  const list = s.byMarket.get(entry.market);
  if (!list) return;
  const idx = list.findIndex((e) => e.tradeId === tradeId);
  if (idx >= 0) list.splice(idx, 1);
  if (list.length === 0) s.byMarket.delete(entry.market);
}

export function getDueEntries(market: string): readonly DueEntry[] {
  return state().byMarket.get(market) ?? [];
}

export function __resetDueListForTests(): void {
  globalForDue.__neemizSettleDue = {
    byMarket: new Map(),
    byTradeId: new Map(),
    inFlight: new Set(),
    rebuilt: false,
  };
}

export function __dueListSizeForTests(): number {
  return state().byTradeId.size;
}

/**
 * Load PENDING digit + directional trades that still have a settle window.
 * Idempotent — safe to call on every worker boot.
 */
export async function rebuildFromDb(): Promise<number> {
  const now = new Date();
  const [binary, directional] = await Promise.all([
    db.binaryTrade.findMany({
      where: {
        status: "PENDING",
        entryEpoch: { not: null },
        settleBefore: { gt: now },
      },
      select: {
        id: true,
        userId: true,
        market: true,
        entryEpoch: true,
        durationTicks: true,
        settleBefore: true,
      },
      take: 5000,
    }),
    db.directionalTrade.findMany({
      where: {
        status: "PENDING",
        settleBefore: { gt: now },
      },
      select: {
        id: true,
        userId: true,
        market: true,
        entryEpoch: true,
        durationTicks: true,
        settleBefore: true,
      },
      take: 5000,
    }),
  ]);

  // Clear and rebuild so we don't keep stale entries from a previous HMR cycle.
  const s = state();
  s.byMarket.clear();
  s.byTradeId.clear();
  s.inFlight.clear();

  for (const t of binary) {
    if (t.entryEpoch == null) continue;
    registerDue({
      kind: "binary",
      tradeId: t.id,
      userId: t.userId,
      market: t.market,
      entryEpoch: t.entryEpoch,
      durationTicks: t.durationTicks,
      settleBeforeMs: t.settleBefore.getTime(),
    });
  }
  for (const t of directional) {
    registerDue({
      kind: "directional",
      tradeId: t.id,
      userId: t.userId,
      market: t.market,
      entryEpoch: t.entryEpoch,
      durationTicks: t.durationTicks,
      // Touch can resolve early — try each post-entry tick; resolveContract gates readiness.
      dueEpoch: t.entryEpoch + 1,
      settleBeforeMs: t.settleBefore.getTime(),
    });
  }

  s.rebuilt = true;
  return s.byTradeId.size;
}

type SettleFn = (entry: DueEntry) => Promise<"done" | "keep">;

let settleFn: SettleFn | null = null;

/** Inject the async settler (avoids circular imports at module load). */
export function setDueSettleFn(fn: SettleFn): void {
  settleFn = fn;
}

/**
 * Called on each new feed tick. Kicks settle for due entries without blocking
 * the WebSocket handler.
 */
export function onSymbolTick(symbol: string, epoch: number): void {
  if (!settleFn) return;
  const s = state();
  const list = s.byMarket.get(symbol);
  if (!list || list.length === 0) return;

  const now = Date.now();
  const snapshot = [...list];
  const due: DueEntry[] = [];
  for (const entry of snapshot) {
    if (entry.dueEpoch > epoch) break; // sorted by dueEpoch
    if (now > entry.settleBeforeMs) {
      // Window expired — drop from memory; cron owns void/refund.
      unregisterDue(entry.tradeId);
      continue;
    }
    if (s.inFlight.has(entry.tradeId)) continue;
    due.push(entry);
  }

  for (const entry of due) {
    s.inFlight.add(entry.tradeId);
    void settleFn(entry)
      .then((result) => {
        if (result === "done") unregisterDue(entry.tradeId);
      })
      .catch((err) => {
        console.warn("[settle-due] settle error", entry.tradeId, err instanceof Error ? err.message : err);
      })
      .finally(() => {
        s.inFlight.delete(entry.tradeId);
      });
  }
}
