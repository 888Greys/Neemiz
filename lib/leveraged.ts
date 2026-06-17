// Leveraged contract math — Multipliers and Turbos. Pure functions shared by the
// client (display) and the server (pricing + settlement) so both agree exactly.
//
// MULTIPLIER: P&L = stake × M × (signed fractional move). Equity = stake + P&L.
//   The position STOPS OUT (total loss) the moment equity hits 0 — i.e. a move of
//   1/M against you. Optional take-profit / stop-loss levels are honored exactly
//   (synthetic feeds have no slippage), so they fill at the configured level.
//
// TURBO: you buy stake/|entry−barrier| contracts, each paying 1 per point of
//   distance from a one-sided KNOCKOUT barrier. Value = ppp × distance; if the
//   spot touches the barrier the contract is KNOCKED OUT (worth 0) — path
//   dependent, resolved on the tick that breaches it, never out-cashable late.
//
// Both are open-ended live cash-out contracts. House edge = the standard 30%
// profit retention at cash-out (applied in the settle lib) plus stop-out/knockout
// truncation, so there is never a +EV path. A profit cap bounds house liability.

export type LeveragedKindT = "MULTIPLIER" | "TURBO";
export type LeveragedDirection = "UP" | "DOWN";

// Selectable multipliers (Deriv-style). Higher M ⇒ tighter stop-out.
export const MULTIPLIERS = [30, 50, 100, 200, 400] as const;

// Gross payout is capped at this multiple of stake (bounds house liability and
// guarantees an abandoned contract resolves at the cap instead of growing).
export const LEVERAGED_MAX_MULT = 50;

// Turbo barrier distance guardrails (fraction of spot). A min distance bounds the
// leverage so a 1-tick knockout can't mint an absurd payout-per-point.
export const MIN_TURBO_DIST_FRAC = 0.001; // 0.1% of spot
export const MAX_TURBO_DIST_FRAC = 0.05;  // 5% of spot

export function isValidMultiplier(m: number): boolean {
  return (MULTIPLIERS as readonly number[]).includes(m);
}

/** The spot at which a multiplier position stops out (equity hits 0). */
export function multiplierStopOutPrice(entrySpot: number, multiplier: number, direction: LeveragedDirection): number {
  const dir = direction === "UP" ? 1 : -1;
  // equity 0 ⇔ dir·(price/entry − 1) = −1/M  ⇔  price = entry·(1 − dir/M)
  return entrySpot * (1 - dir / multiplier);
}

/** Turbo contracts bought per stake: each pays 1 per point of distance to barrier. */
export function turboPayoutPerPoint(stake: number, entrySpot: number, barrier: number): number {
  const dist = Math.abs(entrySpot - barrier);
  if (!(dist > 0)) return 0;
  return stake / dist;
}

/** Clamp a turbo barrier so its distance from spot stays within the guardrails. */
export function clampTurboBarrier(entrySpot: number, barrier: number, direction: LeveragedDirection): number {
  const minDist = entrySpot * MIN_TURBO_DIST_FRAC;
  const maxDist = entrySpot * MAX_TURBO_DIST_FRAC;
  const dist = Math.min(maxDist, Math.max(minDist, Math.abs(entrySpot - barrier)));
  // UP (long) barrier sits below spot; DOWN (short) barrier sits above spot.
  return direction === "UP" ? entrySpot - dist : entrySpot + dist;
}

export type ReplayTick = { price: number; epoch: number };

export type LeveragedParams = {
  kind: LeveragedKindT;
  direction: LeveragedDirection;
  entrySpot: number;
  stake: number;
  multiplier: number | null;     // MULTIPLIER only
  barrier: number | null;        // TURBO knockout price (MULTIPLIER ignores it)
  payoutPerPoint: number | null; // TURBO only
  takeProfit?: number | null;    // profit (KSh above stake) that auto-closes
  stopLoss?: number | null;      // loss (KSh below stake) that auto-closes
  closeEpoch?: number;           // only count ticks at/under this epoch (default: all)
};

/**
 * Raw gross value of the position at a given spot (unclamped; can be ≤ 0).
 * `terminal` flags a stop-out (multiplier) or knockout (turbo) at this spot.
 */
export function leveragedValueAt(
  p: Pick<LeveragedParams, "kind" | "direction" | "entrySpot" | "stake" | "multiplier" | "barrier" | "payoutPerPoint">,
  price: number,
): { value: number; terminal: "stop_out" | "knockout" | null } {
  const dir = p.direction === "UP" ? 1 : -1;
  if (p.kind === "MULTIPLIER") {
    const frac = (price - p.entrySpot) / p.entrySpot;
    const equity = p.stake + p.stake * (p.multiplier ?? 0) * dir * frac;
    return { value: equity, terminal: equity <= 0 ? "stop_out" : null };
  }
  // TURBO — distance to barrier in the favourable direction.
  const dist = dir === 1 ? price - (p.barrier ?? 0) : (p.barrier ?? 0) - price;
  if (dist <= 0) return { value: 0, terminal: "knockout" };
  return { value: (p.payoutPerPoint ?? 0) * dist, terminal: null };
}

export type LeveragedOutcome = {
  kind: "OPEN" | "CLOSED" | "STOPPED" | "KNOCKED_OUT";
  reason: "live" | "cash_out" | "take_profit" | "stop_loss" | "profit_cap" | "stop_out" | "knockout";
  exitSpot: number;
  grossPayout: number; // unrounded; 0 for stop-out / knockout
};

/**
 * Replay the tick path from entry and return the contract outcome.
 *
 * Walks ticks in order (only those with epoch <= closeEpoch). Within each tick,
 * guaranteed take-profit / stop-loss levels fill first (at the configured level,
 * not the tick price), then the profit cap, then a stop-out/knockout. A terminal
 * event that already happened can't be out-cashed by a late request because we
 * settle by tick epoch, not request time. If none fire up to closeEpoch the
 * outcome is OPEN (a cash-out pays the live value at the last tick).
 */
export function resolveLeveraged(p: LeveragedParams, ticks: ReplayTick[]): LeveragedOutcome {
  const maxGross = p.stake * LEVERAGED_MAX_MULT;
  const takeProfit = p.takeProfit ?? null;
  const stopLoss = p.stopLoss ?? null;
  const closeEpoch = p.closeEpoch ?? Number.POSITIVE_INFINITY;
  const koKind = p.kind === "MULTIPLIER" ? "STOPPED" : "KNOCKED_OUT";
  const koReason = p.kind === "MULTIPLIER" ? "stop_out" : "knockout";

  let lastPrice = p.entrySpot;

  for (const t of ticks) {
    if (t.epoch > closeEpoch) break;
    if (!(t.price > 0) || !Number.isFinite(t.price)) continue; // skip junk ticks
    lastPrice = t.price;

    const { value, terminal } = leveragedValueAt(p, t.price);
    const profit = value - p.stake;

    // Guaranteed levels fill at the configured level (no slippage on synthetics).
    if (takeProfit != null && profit >= takeProfit) {
      return { kind: "CLOSED", reason: "take_profit", exitSpot: t.price, grossPayout: p.stake + takeProfit };
    }
    if (stopLoss != null && -profit >= stopLoss) {
      return { kind: "CLOSED", reason: "stop_loss", exitSpot: t.price, grossPayout: Math.max(0, p.stake - stopLoss) };
    }
    if (value >= maxGross) {
      return { kind: "CLOSED", reason: "profit_cap", exitSpot: t.price, grossPayout: maxGross };
    }
    if (terminal) {
      return { kind: koKind, reason: koReason, exitSpot: t.price, grossPayout: 0 };
    }
  }

  // No terminal event up to closeEpoch — report the live value for a cash-out.
  const { value } = leveragedValueAt(p, lastPrice);
  return { kind: "OPEN", reason: "live", exitSpot: lastPrice, grossPayout: Math.max(0, Math.min(value, maxGross)) };
}
