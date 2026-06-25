import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";
import {
  getMarketScorecard,
  windowOf,
  EAT_OFFSET_MS,
  nairobiHourKey,
  type MarketKey,
  type MarketMetric,
  type CountryCode,
  type Window,
} from "@/lib/admin/metrics";

// ─── Market deep-dive data (Phase 2) ─────────────────────────────────────────
// Powers ONE reusable deep-dive template rendered for all 6 markets. Returns a
// uniform MarketDetail so the page component never branches on market: the KPI
// strip, the 14-day GGR series, the biggest open positions, the top players,
// and a per-market health strip.
//
// The four "betting-shaped" markets (sports, predictions, aviator, binary) share
// the GGR = stakes − payouts model and are driven generically from `Source`
// configs. Forex (P&L is the closed profitLoss, flipped) and P2P (fees, not a
// house game) are computed on their own. Binary rolls up its four tables.
//
// Prisma model delegates don't share a typed interface, so the generic helpers
// take the delegate as a narrow structural type and read dynamic columns by
// name — the column names are pinned to schema.prisma and covered by the
// deep-dive's runtime verification.

export type SeriesPoint = { date: string; ggr: number };
export type OpenPosition = { id: string; user: string; label: string; amount: number };
export type PlayerPnl = { user: string; net: number };
export type HealthItem = { label: string; detail: string; tone: "ok" | "warn" | "danger" };

export type MarketDetail = {
  metric: MarketMetric;
  /** "hour" when the chart covers a single Nairobi day, else "day". */
  granularity: "hour" | "day";
  series: SeriesPoint[];
  openPositions: OpenPosition[];
  topPlayers: PlayerPnl[];
  health: HealthItem[];
};

type Delegate = {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  groupBy: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  count: (args: unknown) => Promise<number>;
};

type UserSel = { username: string | null; email: string | null };

// One stake/payout source feeding the generic betting builders. A market is a
// list of sources (binary has four).
type Source = {
  delegate: Delegate;
  stakeField: string;
  stakeTime: string;
  payoutField: string;
  payoutTime: string;
  // Extra filter applied to payout rows. Empty for tables where the payout
  // column is null unless paid (sports/predictions/aviator); the won/closed
  // status for binary tables whose payout column always holds the potential.
  payoutWhere: Record<string, unknown>;
  openWhere: Record<string, unknown>;
  openAmountField: string;
  label: (row: Record<string, unknown>) => string;
};

const num = (v: unknown): number => Number(v ?? 0);
// Day buckets are Nairobi calendar days: shift the instant into EAT before
// slicing the date, so a row at 01:00 EAT lands on the right local day rather
// than the previous UTC day.
const dayKey = (d: Date) => new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
const displayUser = (u: UserSel | undefined | null) =>
  u?.username ?? u?.email ?? "unknown";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SERIES_DAY_CAP = 92; // keep long ranges ("All") from exploding the chart

/**
 * Buckets for the GGR/fees chart, driven by the selected window so the chart
 * follows the range filter (it used to be pinned to a fixed 14 days). A window
 * spanning a single Nairobi day ("Today" / a picked day) is bucketed hour-by-hour
 * (12am→12am) like the cockpit; longer ranges are daily, capped to the most
 * recent SERIES_DAY_CAP days. Returns the seeded map plus the matching keyer so
 * callers bucket their rows the same way.
 */
function seriesBuckets(w: Window): { hourly: boolean; key: (d: Date) => string; map: Record<string, number> } {
  const hourly = w.end.getTime() - w.start.getTime() <= 25 * HOUR_MS;
  const key = hourly ? nairobiHourKey : dayKey;
  const map: Record<string, number> = {};

  // Nairobi midnight at/just-before the window start.
  const startEat = new Date(w.start.getTime() + EAT_OFFSET_MS);
  startEat.setUTCHours(0, 0, 0, 0);
  const midnight = startEat.getTime() - EAT_OFFSET_MS;

  if (hourly) {
    for (let h = 0; h < 24; h++) map[key(new Date(midnight + h * HOUR_MS))] = 0;
  } else {
    const fullDays = Math.max(1, Math.ceil((w.end.getTime() - midnight) / DAY_MS));
    const count = Math.min(SERIES_DAY_CAP, fullDays);
    const base = midnight + (fullDays - count) * DAY_MS; // show the most recent `count` days
    for (let i = 0; i < count; i++) map[key(new Date(base + i * DAY_MS))] = 0;
  }
  return { hourly, key, map };
}

async function bettingSeries(sources: Source[], base: object, w: Window): Promise<SeriesPoint[]> {
  const { key, map } = seriesBuckets(w);
  const range = { gte: w.start, lt: w.end };

  await Promise.all(sources.flatMap((s) => [
    s.delegate
      .findMany({ where: { ...base, [s.stakeTime]: range }, select: { [s.stakeTime]: true, [s.stakeField]: true } })
      .then((rows) => {
        for (const r of rows) {
          const k = key(r[s.stakeTime] as Date);
          if (k in map) map[k] += num(r[s.stakeField]);
        }
      }),
    s.delegate
      .findMany({ where: { ...base, ...s.payoutWhere, [s.payoutTime]: range }, select: { [s.payoutTime]: true, [s.payoutField]: true } })
      .then((rows) => {
        for (const r of rows) {
          const k = key(r[s.payoutTime] as Date);
          if (k in map) map[k] -= num(r[s.payoutField]);
        }
      }),
  ]));

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ggr]) => ({ date, ggr: Math.round(ggr) }));
}

async function bettingOpenPositions(sources: Source[], base: object, take = 6): Promise<OpenPosition[]> {
  const lists = await Promise.all(sources.map((s) =>
    s.delegate.findMany({
      where: { ...base, ...s.openWhere },
      orderBy: { [s.openAmountField]: "desc" },
      take,
      include: { user: { select: { username: true, email: true } } },
    }).then((rows) => rows.map((r) => ({
      id: String(r.id),
      user: displayUser(r.user as UserSel),
      label: s.label(r),
      amount: num(r[s.openAmountField]),
    }))),
  ));
  return lists.flat().sort((a, b) => b.amount - a.amount).slice(0, take);
}

async function bettingTopPlayers(sources: Source[], base: object, w: Window, take = 6): Promise<PlayerPnl[]> {
  const range = { gte: w.start, lt: w.end };
  const net = new Map<string, number>(); // userId → player net (payouts − stakes)

  await Promise.all(sources.flatMap((s) => [
    s.delegate.groupBy({ by: ["userId"], where: { ...base, [s.stakeTime]: range }, _sum: { [s.stakeField]: true } })
      .then((rows) => { for (const r of rows) net.set(String(r.userId), (net.get(String(r.userId)) ?? 0) - num((r._sum as Record<string, unknown>)[s.stakeField])); }),
    s.delegate.groupBy({ by: ["userId"], where: { ...base, ...s.payoutWhere, [s.payoutTime]: range }, _sum: { [s.payoutField]: true } })
      .then((rows) => { for (const r of rows) net.set(String(r.userId), (net.get(String(r.userId)) ?? 0) + num((r._sum as Record<string, unknown>)[s.payoutField])); }),
  ]));

  const top = [...net.entries()]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take);
  if (top.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, username: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, displayUser(u)]));
  return top.map(([id, v]) => ({ user: byId.get(id) ?? "unknown", net: Math.round(v) }));
}

// ─── Per-market source configs ────────────────────────────────────────────────

function betSelectionLabel(r: Record<string, unknown>): string {
  const t = r.betType === "MULTI" ? "ACCA" : "single";
  return `${t} @ ${num(r.totalOdds).toFixed(2)}`;
}

const SOURCES: Partial<Record<MarketKey, Source[]>> = {
  sports: [{
    delegate: db.bet as unknown as Delegate,
    stakeField: "stake", stakeTime: "createdAt",
    payoutField: "winAmount", payoutTime: "settledAt", payoutWhere: {},
    openWhere: { status: "PENDING" }, openAmountField: "potentialWin",
    label: betSelectionLabel,
  }],
  predictions: [{
    delegate: db.polymarketBet as unknown as Delegate,
    stakeField: "stake", stakeTime: "createdAt",
    payoutField: "winAmount", payoutTime: "settledAt", payoutWhere: {},
    openWhere: { status: "PENDING" }, openAmountField: "potentialWin",
    label: (r) => `${r.outcome} · ${String(r.question ?? "").slice(0, 28)}`,
  }],
  aviator: [{
    delegate: db.aviatorBet as unknown as Delegate,
    stakeField: "betAmount", stakeTime: "placedAt",
    payoutField: "winAmount", payoutTime: "placedAt", payoutWhere: {},
    openWhere: { status: "ACTIVE" }, openAmountField: "betAmount",
    label: (r) => (r.autoCashout ? `auto @ ${num(r.autoCashout).toFixed(2)}x` : "manual cashout"),
  }],
  binary: [
    {
      delegate: db.binaryTrade as unknown as Delegate,
      stakeField: "stake", stakeTime: "createdAt",
      payoutField: "payout", payoutTime: "settledAt", payoutWhere: { status: "WON" },
      openWhere: { status: "PENDING" }, openAmountField: "payout",
      label: (r) => `${r.market} · ${r.side}`,
    },
    {
      delegate: db.accumulatorTrade as unknown as Delegate,
      stakeField: "stake", stakeTime: "createdAt",
      payoutField: "payout", payoutTime: "settledAt", payoutWhere: { status: "CLOSED" },
      openWhere: { status: "OPEN" }, openAmountField: "stake",
      label: (r) => `${r.market} · accumulator ${num(r.growthRate)}%`,
    },
    {
      delegate: db.directionalTrade as unknown as Delegate,
      stakeField: "stake", stakeTime: "createdAt",
      payoutField: "payout", payoutTime: "settledAt", payoutWhere: { status: "WON" },
      openWhere: { status: "PENDING" }, openAmountField: "payout",
      label: (r) => `${r.market} · ${r.side}`,
    },
    {
      delegate: db.leveragedTrade as unknown as Delegate,
      stakeField: "stake", stakeTime: "createdAt",
      payoutField: "payout", payoutTime: "settledAt", payoutWhere: { status: "CLOSED" },
      openWhere: { status: "OPEN" }, openAmountField: "maxPayout",
      label: (r) => `${r.market} · ${r.kind} ${r.direction}`,
    },
  ],
};

// ─── Forex & P2P (non-generic) ────────────────────────────────────────────────

async function forexDetail(base: object, w: Window): Promise<Omit<MarketDetail, "metric" | "health" | "granularity">> {
  const range = { gte: w.start, lt: w.end };
  const { key, map } = seriesBuckets(w);

  const [closed, open, byUser] = await Promise.all([
    (db.forexTrade as unknown as Delegate).findMany({
      where: { ...base, status: "CLOSED", closedAt: range },
      select: { closedAt: true, profitLoss: true },
    }),
    (db.forexTrade as unknown as Delegate).findMany({
      where: { ...base, status: "OPEN" },
      orderBy: { margin: "desc" }, take: 6,
      include: { user: { select: { username: true, email: true } } },
    }),
    db.forexTrade.groupBy({
      by: ["userId"], where: { ...base, status: "CLOSED", closedAt: range }, _sum: { profitLoss: true },
    }),
  ]);

  for (const r of closed) {
    const k = key(r.closedAt as Date);
    if (k in map) map[k] += -num(r.profitLoss); // house GGR = −player P&L
  }

  const top = byUser
    .map((r) => ({ id: r.userId, net: num(r._sum.profitLoss) }))
    .filter((r) => r.net !== 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, 6);
  const users = top.length
    ? await db.user.findMany({ where: { id: { in: top.map((t) => t.id) } }, select: { id: true, username: true, email: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, displayUser(u)]));

  return {
    series: Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, ggr]) => ({ date, ggr: Math.round(ggr) })),
    openPositions: open.map((r) => ({
      id: String(r.id),
      user: displayUser(r.user as UserSel),
      label: `${r.symbol} · ${r.direction}`,
      amount: num(r.margin),
    })),
    topPlayers: top.map((t) => ({ user: byId.get(t.id) ?? "unknown", net: Math.round(t.net) })),
  };
}

async function p2pDetail(base: object, w: Window): Promise<Omit<MarketDetail, "metric" | "health" | "granularity">> {
  const range = { gte: w.start, lt: w.end };
  const { key, map } = seriesBuckets(w);

  const [feeRows, open, volByUser] = await Promise.all([
    db.transaction.findMany({
      where: { ...base, provider: "p2p_fee", status: "COMPLETED", createdAt: range },
      select: { createdAt: true, metadata: true },
    }),
    db.p2POrder.findMany({
      where: { status: { in: ["PENDING", "PAID"] } },
      orderBy: { fiatAmount: "desc" }, take: 6,
      include: { buyer: { select: { username: true, email: true } } },
    }),
    db.p2POrder.groupBy({
      by: ["buyerId"], where: { status: "RELEASED", releasedAt: range }, _sum: { fiatAmount: true },
    }),
  ]);

  for (const r of feeRows) {
    const meta = r.metadata as { feeKesAmount?: unknown } | null;
    const fee = Number(meta?.feeKesAmount);
    const k = key(r.createdAt);
    if (k in map && Number.isFinite(fee) && fee >= 0) map[k] += fee;
  }

  const top = volByUser
    .map((r) => ({ id: r.buyerId, net: num(r._sum.fiatAmount) }))
    .sort((a, b) => b.net - a.net)
    .slice(0, 6);
  const users = top.length
    ? await db.user.findMany({ where: { id: { in: top.map((t) => t.id) } }, select: { id: true, username: true, email: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, displayUser(u)]));

  return {
    series: Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, ggr]) => ({ date, ggr: Math.round(ggr) })),
    openPositions: open.map((r) => ({
      id: r.id,
      user: displayUser(r.buyer as UserSel),
      label: `${r.crypto} · ${r.paymentMethod}`,
      amount: num(r.fiatAmount),
    })),
    topPlayers: top.map((t) => ({ user: byId.get(t.id) ?? "unknown", net: Math.round(t.net) })),
  };
}

// ─── Per-market health strips ─────────────────────────────────────────────────

async function healthFor(key: MarketKey): Promise<HealthItem[]> {
  switch (key) {
    case "sports": {
      // The known getFixtureDetail stateId-5 bug: bets never flip WON/LOST.
      const stuck = await db.bet.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
      return [{
        label: stuck > 0 ? `${stuck} fixtures unsettled >24h` : "Settlement healthy",
        detail: stuck > 0 ? "getFixtureDetail never returns stateId 5" : "all bets settling",
        tone: stuck > 0 ? "danger" : "ok",
      }];
    }
    case "binary": {
      const voided = await db.binaryTrade.count({ where: { status: "VOID", settledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
      return [{ label: voided > 0 ? `${voided} contracts voided (24h)` : "Cron sweep healthy", detail: "feed-outage refunds", tone: voided > 0 ? "warn" : "ok" }];
    }
    case "p2p": {
      const disputes = await db.p2PDispute.count({ where: { status: "OPEN" } });
      return [{ label: disputes > 0 ? `${disputes} open disputes` : "No open disputes", detail: "buyer/seller escrow conflicts", tone: disputes > 0 ? "danger" : "ok" }];
    }
    case "aviator":
      return [{ label: "Payout-cap fairness", detail: "open issue — provably-fair verifier", tone: "warn" }];
    case "forex":
      return [{ label: "Margin & stop-out", detail: "monitor open-lot exposure", tone: "ok" }];
    case "predictions":
      return [{ label: "Resolution lag", detail: "settles on Polymarket conditionId", tone: "ok" }];
  }
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export async function getMarketDetail(
  key: MarketKey,
  opts?: { window?: Window; seriesDays?: number; country?: CountryCode },
): Promise<MarketDetail> {
  const country = opts?.country ?? "KE";
  // The chart now follows the selected range (was pinned to a fixed 14 days).
  // Fall back to the last 14 days only when no window is supplied.
  const seriesWindow = opts?.window ?? windowOf(opts?.seriesDays ?? 14);
  const playerWindow = seriesWindow;
  const granularity: "hour" | "day" =
    seriesWindow.end.getTime() - seriesWindow.start.getTime() <= 25 * HOUR_MS ? "hour" : "day";

  const excludedIds = await getExcludedUserIds();
  const notExcluded = excludedIds.length ? { userId: { notIn: excludedIds } } : {};
  // p2p_fee rows and order tables key off different user columns; the generic
  // betting `base` (userId) is only applied where the model has that column.
  const base = notExcluded;

  const [metric, health, body] = await Promise.all([
    getMarketScorecard(key, { window: opts?.window, country }),
    healthFor(key),
    (async (): Promise<Omit<MarketDetail, "metric" | "health" | "granularity">> => {
      if (key === "forex") return forexDetail(base, seriesWindow);
      if (key === "p2p") return p2pDetail({}, seriesWindow);
      const sources = SOURCES[key]!;
      const [series, openPositions, topPlayers] = await Promise.all([
        bettingSeries(sources, base, seriesWindow),
        bettingOpenPositions(sources, base),
        bettingTopPlayers(sources, base, playerWindow),
      ]);
      return { series, openPositions, topPlayers };
    })(),
  ]);

  return { metric, health, granularity, ...body };
}
