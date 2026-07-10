import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  __dueListSizeForTests,
  __resetDueListForTests,
  getDueEntries,
  onSymbolTick,
  registerDue,
  setDueSettleFn,
  unregisterDue,
} from "@/lib/settle-due-list";

describe("settle-due-list", () => {
  beforeEach(() => {
    __resetDueListForTests();
    setDueSettleFn(async () => "done");
  });

  it("registers and sorts by dueEpoch", () => {
    registerDue({
      kind: "binary",
      tradeId: "b2",
      userId: "u1",
      market: "1HZ100V",
      entryEpoch: 100,
      durationTicks: 5,
      settleBeforeMs: Date.now() + 60_000,
    });
    registerDue({
      kind: "binary",
      tradeId: "b1",
      userId: "u1",
      market: "1HZ100V",
      entryEpoch: 100,
      durationTicks: 3,
      settleBeforeMs: Date.now() + 60_000,
    });
    const list = getDueEntries("1HZ100V");
    expect(list.map((e) => e.tradeId)).toEqual(["b1", "b2"]);
    expect(list[0].dueEpoch).toBe(103);
    expect(list[1].dueEpoch).toBe(105);
  });

  it("does not settle before dueEpoch", async () => {
    const settle = vi.fn(async () => "done" as const);
    setDueSettleFn(settle);
    registerDue({
      kind: "binary",
      tradeId: "b1",
      userId: "u1",
      market: "R_100",
      entryEpoch: 1000,
      durationTicks: 5,
      settleBeforeMs: Date.now() + 60_000,
    });
    onSymbolTick("R_100", 1003); // due at 1005
    await Promise.resolve();
    expect(settle).not.toHaveBeenCalled();
    expect(__dueListSizeForTests()).toBe(1);
  });

  it("settles when epoch reaches dueEpoch and unregisters on done", async () => {
    const settle = vi.fn(async () => "done" as const);
    setDueSettleFn(settle);
    registerDue({
      kind: "directional",
      tradeId: "d1",
      userId: "u1",
      market: "R_100",
      entryEpoch: 1000,
      durationTicks: 3,
      settleBeforeMs: Date.now() + 60_000,
    });
    onSymbolTick("R_100", 1003);
    await vi.waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(__dueListSizeForTests()).toBe(0));
  });

  it("keeps entry when settler returns keep", async () => {
    const settle = vi.fn(async () => "keep" as const);
    setDueSettleFn(settle);
    registerDue({
      kind: "binary",
      tradeId: "b1",
      userId: "u1",
      market: "1HZ10V",
      entryEpoch: 50,
      durationTicks: 2,
      settleBeforeMs: Date.now() + 60_000,
    });
    onSymbolTick("1HZ10V", 52);
    await vi.waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
    expect(__dueListSizeForTests()).toBe(1);
  });

  it("unregisterDue removes the entry", () => {
    registerDue({
      kind: "binary",
      tradeId: "b1",
      userId: "u1",
      market: "JD10",
      entryEpoch: 1,
      durationTicks: 1,
      settleBeforeMs: Date.now() + 60_000,
    });
    unregisterDue("b1");
    expect(getDueEntries("JD10")).toEqual([]);
    expect(__dueListSizeForTests()).toBe(0);
  });

  it("drops expired entries on tick without calling settle", async () => {
    const settle = vi.fn(async () => "done" as const);
    setDueSettleFn(settle);
    vi.useFakeTimers();
    const now = Date.now();
    registerDue({
      kind: "binary",
      tradeId: "old",
      userId: "u1",
      market: "1HZ25V",
      entryEpoch: 1,
      durationTicks: 1,
      settleBeforeMs: now + 5_000,
    });
    expect(__dueListSizeForTests()).toBe(1);
    vi.setSystemTime(now + 10_000);
    onSymbolTick("1HZ25V", 100);
    expect(settle).not.toHaveBeenCalled();
    expect(__dueListSizeForTests()).toBe(0);
    vi.useRealTimers();
  });
});
