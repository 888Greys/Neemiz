import { db } from "@/lib/db";
import { getExcludedUserIds } from "@/lib/admin-excluded";

// ─── Admin metrics foundation (Phase 0) ──────────────────────────────────────
// One place that computes the per-market scorecard the whole admin reads from.
//
// Why this exists: house P&L in the Transaction ledger (BET_STAKE − BET_WIN) is
// GLOBAL — transactions carry no market tag. To treat each of the 6 markets as
// an independent P&L unit we must compute from each game's SOURCE table, where
// the stake and payout columns live. Every screen (cockpit cards, market
// deep-dive, country view) consumes MarketMetric so the numbers always agree.
//
// Country dimension: the platform is single-country (Kenya) today — there is no
// country column on User yet (only a +254 phone). `country` is threaded through
// every function and pinned to "KE" so the (market × country) grid is real the
// day a second country lands, with no query refactor. `countryFilter()` is the
// single seam to change then.

export type MarketKey =
  | "sports"
  | "binary"
  | "aviator"
  | "predictions"
  | "forex"
  | "p2p";

export type CountryCode = "KE"; // widen when expansion lands

export const MARKET_LABELS: Record<MarketKey, string> = {
  sports: "Sports",
  binary: "Binary",
  aviator: "Aviator",
  predictions: "Predictions",
  forex: "Forex",
  p2p: "P2P desk",
};

export const MARKET_KEYS: MarketKey[] = [
  "sports",
  "binary",
  "aviator",
  "predictions",
  "forex",
  "p2p",
];

export type MarketMetric = {
  key: MarketKey;
  label: string;
  /** Stakes/volume placed in the window (KSh). P2P: fiat trade volume. */
  turnover: number;
  /** House gross gaming revenue: stakes − payouts on settled positions (KSh).
   *  P2P: platform fee revenue (it is an exchange, not a house game). */
  ggr: number;
  /** ggr / turnover, 0..1. 0 when turnover is 0. */
  margin: number;
  /** Distinct players active in the window. */
  activePlayers: number;
  /** Positions still open/pending (count). P2P: live orders. */
  openContracts: number;
  /** Worst-case payout still owed on open positions (KSh). Best-effort: exact
   *  where the table stores a fixed potential payout; approximate (flagged via
   *  `liabilityExact`) where settlement needs tick replay (accumulators,
   *  multipliers/turbos). */
  openLiability: number;
  /** false when openLiability is a lower-bound approximation, not exact. */
  liabilityExact: boolean;
};

export type Window = { start: Date; end: Date };

// ─── Nairobi-anchored day boundaries ─────────────────────────────────────────
// The business is Kenya-only, so a "day" must mean a Nairobi calendar day —
// 00:00→24:00 EAT — regardless of where the server process runs (Docker on the
// nez VPS in France defaults to UTC). Kenya observes no DST, so EAT is a fixed
// UTC+3 the year round and we can anchor every boundary with a constant offset
// instead of pulling in a tz database. All returned Dates are absolute UTC
// instants, which is exactly what Prisma compares timestamptz columns against.
export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The UTC instant of Nairobi midnight, `daysAgo` Nairobi-days before today. */
export function nairobiMidnight(daysAgo = 0): Date {
  // Shift "now" into EAT wall-clock space, floor to midnight there, then shift
  // the instant back to real UTC.
  const eat = new Date(Date.now() + EAT_OFFSET_MS);
  eat.setUTCHours(0, 0, 0, 0);
  eat.setUTCDate(eat.getUTCDate() - daysAgo);
  return new Date(eat.getTime() - EAT_OFFSET_MS);
}

/** Nairobi midnight for an explicit `YYYY-MM-DD` (interpreted as an EAT date). */
export function nairobiMidnightOf(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d) - EAT_OFFSET_MS);
}

/** `YYYY-MM-DD` for the Nairobi calendar day an instant falls on. */
export function nairobiDayKey(d: Date): string {
  return new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** `HH:00` for the Nairobi clock-hour an instant falls on. */
export function nairobiHourKey(d: Date): string {
  return `${new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(11, 13)}:00`;
}

/** Build a [start, end) window ending now. */
export function windowOf(days: number): Window {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}

export function todayWindow(): Window {
  return { start: nairobiMidnight(0), end: new Date() };
}

/** The last *complete* Nairobi day: [start of yesterday, start of today). */
export function yesterdayWindow(): Window {
  return { start: nairobiMidnight(1), end: nairobiMidnight(0) };
}

/** A single explicit Nairobi day: [its midnight, the next midnight). */
export function dayWindow(ymd: string): Window {
  const start = nairobiMidnightOf(ymd);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function monthToDateWindow(): Window {
  // First of the current month at Nairobi midnight.
  const eat = new Date(Date.now() + EAT_OFFSET_MS);
  const start = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), 1) - EAT_OFFSET_MS);
  return { start, end: new Date() };
}

/** The last N Nairobi-calendar days incl. today: [midnight (N-1) days ago, now). */
export function lastNDaysWindow(n: number): Window {
  return { start: nairobiMidnight(n - 1), end: new Date() };
}

/**
 * Canonical window for an admin range token. Single source of truth shared by
 * every windowed admin API; the matching UI labels live in lib/admin/ranges.ts.
 * A `day:YYYY-MM-DD` token selects one explicit Nairobi calendar day.
 */
export function rangeWindow(range: string | null): Window {
  if (range?.startsWith("day:")) {
    const ymd = range.slice(4);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return dayWindow(ymd);
  }
  switch (range) {
    case "yesterday": return yesterdayWindow();
    case "7d":  return lastNDaysWindow(7);
    case "30d": return lastNDaysWindow(30);
    case "mtd": return monthToDateWindow();
    case "all": return lastNDaysWindow(3650);
    default:    return todayWindow(); // "today"
  }
}

/** Number of day-buckets to seed for a daily chart over a window (capped). */
export function windowDays(w: Window, cap = 92): number {
  const d = Math.ceil((w.end.getTime() - w.start.getTime()) / 86_400_000);
  return Math.min(Math.max(1, d), cap);
}

// Single seam for the country dimension. Today there is no country column, so
// every country resolves to the whole dataset. When User gains a country (from
// the +254-style phone prefix or signup geo), return `{ user: { country } }`
// here and every market query inherits it.
function countryFilter(_country: CountryCode): Record<string, never> {
  return {};
}

function margin(ggr: number, turnover: number): number {
  return turnover > 0 ? ggr / turnover : 0;
}

const num = (v: unknown): number => Number(v ?? 0);

// ─── Per-market resolvers ─────────────────────────────────────────────────────
// Each returns a full MarketMetric for one (market × country × window). They run
// in parallel from getMarketScorecards(). `excludedIds` keeps suspended
// exploiters + owner test accounts out of real-money figures, matching the rest
// of the admin.

type Ctx = {
  window: Window;
  country: CountryCode;
  notExcluded: { userId?: { notIn: string[] } };
};

async function sportsMetric(ctx: Ctx): Promise<MarketMetric> {
  const { window: w, notExcluded } = ctx;
  const base = { ...notExcluded, ...countryFilter(ctx.country) };

  const [staked, won, open, players] = await Promise.all([
    db.bet.aggregate({
      where: { ...base, createdAt: { gte: w.start, lt: w.end } },
      _sum: { stake: true },
    }),
    db.bet.aggregate({
      where: { ...base, settledAt: { gte: w.start, lt: w.end } },
      _sum: { winAmount: true },
    }),
    db.bet.aggregate({
      where: { ...base, status: "PENDING" },
      _sum: { potentialWin: true },
      _count: true,
    }),
    db.bet.findMany({
      where: { ...base, createdAt: { gte: w.start, lt: w.end } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const turnover = num(staked._sum.stake);
  const ggr = turnover - num(won._sum.winAmount);
  return {
    key: "sports",
    label: MARKET_LABELS.sports,
    turnover,
    ggr,
    margin: margin(ggr, turnover),
    activePlayers: players.length,
    openContracts: open._count,
    openLiability: num(open._sum.potentialWin),
    liabilityExact: true,
  };
}

async function predictionsMetric(ctx: Ctx): Promise<MarketMetric> {
  const { window: w, notExcluded } = ctx;
  const base = { ...notExcluded, ...countryFilter(ctx.country) };

  const [staked, won, open, players] = await Promise.all([
    db.polymarketBet.aggregate({
      where: { ...base, createdAt: { gte: w.start, lt: w.end } },
      _sum: { stake: true },
    }),
    db.polymarketBet.aggregate({
      where: { ...base, settledAt: { gte: w.start, lt: w.end } },
      _sum: { winAmount: true },
    }),
    db.polymarketBet.aggregate({
      where: { ...base, status: "PENDING" },
      _sum: { potentialWin: true },
      _count: true,
    }),
    db.polymarketBet.findMany({
      where: { ...base, createdAt: { gte: w.start, lt: w.end } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const turnover = num(staked._sum.stake);
  const ggr = turnover - num(won._sum.winAmount);
  return {
    key: "predictions",
    label: MARKET_LABELS.predictions,
    turnover,
    ggr,
    margin: margin(ggr, turnover),
    activePlayers: players.length,
    openContracts: open._count,
    openLiability: num(open._sum.potentialWin),
    liabilityExact: true,
  };
}

async function aviatorMetric(ctx: Ctx): Promise<MarketMetric> {
  const { window: w, notExcluded } = ctx;
  // The live Aviator engine (the Go crash service) records to the transaction
  // ledger as provider="aviator-service": BET_STAKE on a placed bet, BET_WIN on
  // cashout, REFUND on a voided round. The legacy `aviator_bets` table has not
  // been written since the engine swap (2026-05-25), so we MUST read the ledger
  // here or every aviator figure reads zero. Rounds last seconds, so in-flight
  // open liability is negligible and not tracked.
  const base = {
    ...notExcluded,
    provider: "aviator-service",
    status: "COMPLETED" as const,
    createdAt: { gte: w.start, lt: w.end },
  };

  const [staked, won, refunded, players] = await Promise.all([
    db.transaction.aggregate({ where: { ...base, type: "BET_STAKE" }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { ...base, type: "BET_WIN" }, _sum: { amount: true } }),
    db.transaction.aggregate({ where: { ...base, type: "REFUND" }, _sum: { amount: true } }),
    db.transaction.findMany({ where: { ...base, type: "BET_STAKE" }, select: { userId: true }, distinct: ["userId"] }),
  ]);

  // Refunds return a stake that never played, so net them out of both turnover
  // (amount actually wagered) and GGR (house take).
  const turnover = num(staked._sum.amount) - num(refunded._sum.amount);
  const ggr = turnover - num(won._sum.amount);
  return {
    key: "aviator",
    label: MARKET_LABELS.aviator,
    turnover,
    ggr,
    margin: margin(ggr, turnover),
    activePlayers: players.length,
    openContracts: 0,
    openLiability: 0,
    liabilityExact: false,
  };
}

async function forexMetric(ctx: Ctx): Promise<MarketMetric> {
  const { window: w, notExcluded } = ctx;
  const base = { ...notExcluded, ...countryFilter(ctx.country) };

  // Forex P&L is the closed-position profitLoss flipped to the house side
  // (player profit = house loss). Turnover ≈ margin committed on trades opened.
  const [opened, closed, open, players] = await Promise.all([
    db.forexTrade.aggregate({
      where: { ...base, openedAt: { gte: w.start, lt: w.end } },
      _sum: { margin: true },
    }),
    db.forexTrade.aggregate({
      where: { ...base, status: "CLOSED", closedAt: { gte: w.start, lt: w.end } },
      _sum: { profitLoss: true },
    }),
    db.forexTrade.aggregate({
      where: { ...base, status: "OPEN" },
      _sum: { margin: true },
      _count: true,
    }),
    db.forexTrade.findMany({
      where: { ...base, openedAt: { gte: w.start, lt: w.end } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const turnover = num(opened._sum.margin);
  const ggr = -num(closed._sum.profitLoss); // house gain = −player P&L
  return {
    key: "forex",
    label: MARKET_LABELS.forex,
    turnover,
    ggr,
    margin: margin(ggr, turnover),
    activePlayers: players.length,
    openContracts: open._count,
    openLiability: num(open._sum.margin),
    liabilityExact: false,
  };
}

// Binary is a FAMILY of four Deriv-style products. They share one card/deep-dive
// so the owner sees "binary" as one independent unit; this resolver rolls them
// up. Stake/payout column names differ per table, hence the per-table blocks.
async function binaryMetric(ctx: Ctx): Promise<MarketMetric> {
  const { window: w, notExcluded } = ctx;
  const base = { ...notExcluded, ...countryFilter(ctx.country) };
  const placed = { createdAt: { gte: w.start, lt: w.end } };
  const settled = { settledAt: { gte: w.start, lt: w.end } };

  const [
    // digit contracts
    digStake, digWon, digOpen,
    // accumulators
    accStake, accClosed, accOpen,
    // directional
    dirStake, dirWon, dirOpen,
    // leveraged
    levStake, levClosed, levOpen,
    players,
  ] = await Promise.all([
    db.binaryTrade.aggregate({ where: { ...base, ...placed }, _sum: { stake: true } }),
    db.binaryTrade.aggregate({ where: { ...base, status: "WON", ...settled }, _sum: { payout: true } }),
    db.binaryTrade.aggregate({ where: { ...base, status: "PENDING" }, _sum: { payout: true }, _count: true }),

    db.accumulatorTrade.aggregate({ where: { ...base, ...placed }, _sum: { stake: true } }),
    db.accumulatorTrade.aggregate({ where: { ...base, status: "CLOSED", ...settled }, _sum: { payout: true } }),
    db.accumulatorTrade.aggregate({ where: { ...base, status: "OPEN" }, _sum: { stake: true, takeProfit: true }, _count: true }),

    db.directionalTrade.aggregate({ where: { ...base, ...placed }, _sum: { stake: true } }),
    db.directionalTrade.aggregate({ where: { ...base, status: "WON", ...settled }, _sum: { payout: true } }),
    db.directionalTrade.aggregate({ where: { ...base, status: "PENDING" }, _sum: { payout: true }, _count: true }),

    db.leveragedTrade.aggregate({ where: { ...base, ...placed }, _sum: { stake: true } }),
    db.leveragedTrade.aggregate({ where: { ...base, status: "CLOSED", ...settled }, _sum: { payout: true } }),
    db.leveragedTrade.aggregate({ where: { ...base, status: "OPEN" }, _sum: { maxPayout: true }, _count: true }),

    // distinct players across all four tables, deduped in JS
    Promise.all([
      db.binaryTrade.findMany({ where: { ...base, ...placed }, select: { userId: true }, distinct: ["userId"] }),
      db.accumulatorTrade.findMany({ where: { ...base, ...placed }, select: { userId: true }, distinct: ["userId"] }),
      db.directionalTrade.findMany({ where: { ...base, ...placed }, select: { userId: true }, distinct: ["userId"] }),
      db.leveragedTrade.findMany({ where: { ...base, ...placed }, select: { userId: true }, distinct: ["userId"] }),
    ]),
  ]);

  const turnover =
    num(digStake._sum.stake) +
    num(accStake._sum.stake) +
    num(dirStake._sum.stake) +
    num(levStake._sum.stake);

  const payouts =
    num(digWon._sum.payout) +
    num(accClosed._sum.payout) +
    num(dirWon._sum.payout) +
    num(levClosed._sum.payout);

  const ggr = turnover - payouts;

  // Liability: digit + directional expose a fixed `payout`, so those are exact.
  // Accumulators (proxy: stake + takeProfit cap) and leveraged (maxPayout cap)
  // are upper-bounded by the schema but the live mark needs tick replay → not
  // exact. maxPayout is the house's hard liability cap, the right figure to show.
  const openLiability =
    num(digOpen._sum.payout) +
    num(accOpen._sum.stake) + num(accOpen._sum.takeProfit) +
    num(dirOpen._sum.payout) +
    num(levOpen._sum.maxPayout);

  const openContracts =
    digOpen._count + accOpen._count + dirOpen._count + levOpen._count;

  const playerIds = new Set<string>();
  for (const list of players) for (const r of list) playerIds.add(r.userId);

  return {
    key: "binary",
    label: MARKET_LABELS.binary,
    turnover,
    ggr,
    margin: margin(ggr, turnover),
    activePlayers: playerIds.size,
    openContracts,
    openLiability,
    liabilityExact: false,
  };
}

// P2P is an exchange, not a house game: "turnover" is fiat volume traded,
// "ggr" is platform fee revenue (KES value stamped into the p2p_fee
// transaction metadata at release), liability is crypto escrow locked in live
// orders. Disputes are surfaced separately by the cockpit alerts rail.
async function p2pMetric(ctx: Ctx): Promise<MarketMetric> {
  const { window: w, notExcluded } = ctx;
  const base = { ...notExcluded, ...countryFilter(ctx.country) };

  const [volume, feeRows, open, buyers] = await Promise.all([
    db.p2POrder.aggregate({
      where: { status: "RELEASED", releasedAt: { gte: w.start, lt: w.end } },
      _sum: { fiatAmount: true },
    }),
    db.transaction.findMany({
      where: { ...base, provider: "p2p_fee", status: "COMPLETED", createdAt: { gte: w.start, lt: w.end } },
      select: { metadata: true },
    }),
    db.p2POrder.count({ where: { status: { in: ["PENDING", "PAID"] } } }),
    db.p2POrder.findMany({
      where: { createdAt: { gte: w.start, lt: w.end } },
      select: { buyerId: true },
      distinct: ["buyerId"],
    }),
  ]);

  const turnover = num(volume._sum.fiatAmount);
  let ggr = 0;
  for (const r of feeRows) {
    const meta = r.metadata as { feeKesAmount?: unknown } | null;
    const fee = Number(meta?.feeKesAmount);
    if (Number.isFinite(fee) && fee >= 0) ggr += fee;
  }

  return {
    key: "p2p",
    label: MARKET_LABELS.p2p,
    turnover,
    ggr,
    margin: margin(ggr, turnover),
    activePlayers: buyers.length,
    openContracts: open,
    openLiability: 0, // escrow is crypto-denominated; surfaced on the Risk screen
    liabilityExact: false,
  };
}

const RESOLVERS: Record<MarketKey, (ctx: Ctx) => Promise<MarketMetric>> = {
  sports: sportsMetric,
  binary: binaryMetric,
  aviator: aviatorMetric,
  predictions: predictionsMetric,
  forex: forexMetric,
  p2p: p2pMetric,
};

/**
 * The scorecard for every market, for one country and time window. This is the
 * single function the cockpit's 6 cards read from; the market deep-dive calls
 * the same resolvers for one key. All resolvers run in parallel.
 */
export async function getMarketScorecards(opts?: {
  window?: Window;
  country?: CountryCode;
  markets?: MarketKey[];
}): Promise<MarketMetric[]> {
  const window = opts?.window ?? todayWindow();
  const country = opts?.country ?? "KE";
  const keys = opts?.markets ?? MARKET_KEYS;

  const excludedIds = await getExcludedUserIds();
  const notExcluded: Ctx["notExcluded"] = excludedIds.length ? { userId: { notIn: excludedIds } } : {};
  const ctx: Ctx = { window, country, notExcluded };

  return Promise.all(keys.map((k) => RESOLVERS[k](ctx)));
}

/** Single-market scorecard (for the deep-dive page). */
export async function getMarketScorecard(
  key: MarketKey,
  opts?: { window?: Window; country?: CountryCode },
): Promise<MarketMetric> {
  const [m] = await getMarketScorecards({ ...opts, markets: [key] });
  return m;
}
