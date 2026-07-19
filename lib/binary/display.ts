/**
 * Binary ticket display helpers — payout return %, win-condition copy, and
 * best-effort interim open-position status. Pure; no pricing / settle math.
 */

import type { DirectionalKind, DirectionalSide } from "@/lib/directional";
import { evaluateDirectional } from "@/lib/directional";

export type DigitSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";
export type DigitFamily = "evenOdd" | "matchDiffer" | "overUnder";

/** Return % when `payout` is total credit (stake + profit). Null if inputs invalid. */
export function returnPct(payout: number, stake: number): number | null {
  if (!(stake > 0) || !Number.isFinite(payout)) return null;
  return Math.round(((payout - stake) / stake) * 100);
}

/**
 * Absolute payout + return %, e.g. `$17.20 · +72%`.
 * Pass `prefix: "Payout"` for mobile Buy lines (`Payout $17.20 · +72%`).
 * Pass `prefix: "max"` for Vanilla max lines (`max $850.00 · +4900%`).
 */
export function formatPayoutWithReturn(
  formatMoney: (kes: number) => string,
  payout: number,
  stake: number,
  opts?: { prefix?: "Payout" | "max" },
): string {
  const money = formatMoney(payout);
  const pct = returnPct(payout, stake);
  const pctPart = pct == null ? "" : ` · ${pct >= 0 ? "+" : ""}${pct}%`;
  if (opts?.prefix === "Payout") return `Payout ${money}${pctPart}`;
  if (opts?.prefix === "max") return `max ${money}${pctPart}`;
  return `${money}${pctPart}`;
}

/** One-sentence win condition for the armed side (or family when side omitted). */
export function digitWinCondition(
  family: DigitFamily,
  side: DigitSide | null | undefined,
  targetDigit: number,
): string {
  if (side === "Even") return "Win if the last digit is even at expiry.";
  if (side === "Odd") return "Win if the last digit is odd at expiry.";
  if (side === "Matches") return `Win if the last digit equals ${targetDigit}.`;
  if (side === "Differs") return `Win if the last digit is not ${targetDigit}.`;
  if (side === "Over") return `Win if the last digit is over ${targetDigit} at expiry.`;
  if (side === "Under") return `Win if the last digit is under ${targetDigit} at expiry.`;
  if (family === "evenOdd") return "Win if the last digit's parity matches your pick at expiry.";
  if (family === "matchDiffer") {
    return `Matches equals ${targetDigit}; Differs wins on any other last digit.`;
  }
  return `Over wins above ${targetDigit}; Under wins below it at expiry.`;
}

export function directionalWinCondition(
  kind: DirectionalKind,
  side: DirectionalSide | null | undefined,
): string {
  if (kind === "RISE_FALL") {
    if (side === "RISE") return "Win if the exit price finishes above your entry.";
    if (side === "FALL") return "Win if the exit price finishes below your entry.";
    return "Win if the exit price finishes above (Rise) or below (Fall) your entry.";
  }
  if (kind === "HIGHER_LOWER") {
    if (side === "HIGHER") return "Win if the exit price finishes above the barrier.";
    if (side === "LOWER") return "Win if the exit price finishes below the barrier.";
    return "Win if the exit price finishes above (Higher) or below (Lower) the barrier.";
  }
  if (kind === "TOUCH_NO_TOUCH") {
    if (side === "TOUCH") return "Win if price touches the barrier before expiry.";
    if (side === "NO_TOUCH") return "Win if price never touches the barrier before expiry.";
    return "Touch must hit the barrier before expiry; No Touch must never hit it.";
  }
  // VANILLA
  return "Paid by how far price finishes past your strike, up to max.";
}

export function accumulatorWinCondition(): string {
  return "Survive inside the barrier each tick; growth compounds.";
}

export function leveragedWinCondition(kind: "MULTIPLIER" | "TURBO"): string {
  if (kind === "TURBO") return "Profit grows with price; contract ends if the barrier is hit.";
  return "Profit scales with price move × multiplier; stop-out can end the trade.";
}

export type InterimStatus = "winning" | "losing" | "settling";

/** Digit interim: current last digit vs contract rule (best-effort, not settled). */
export function digitInterimStatus(params: {
  side: DigitSide;
  targetDigit: number;
  liveDigit: number;
  settlesAt: number;
  now?: number;
}): InterimStatus {
  const now = params.now ?? Date.now();
  if (now >= params.settlesAt) return "settling";
  const d = params.liveDigit;
  const t = params.targetDigit;
  let winning = false;
  if (params.side === "Even") winning = d % 2 === 0;
  else if (params.side === "Odd") winning = d % 2 === 1;
  else if (params.side === "Matches") winning = d === t;
  else if (params.side === "Differs") winning = d !== t;
  else if (params.side === "Over") winning = d > t;
  else winning = d < t;
  return winning ? "winning" : "losing";
}

/**
 * Directional interim from live spot (+ optional path for Touch).
 * Best-effort only — Touch uses path-or-current barrier cross when available.
 */
export function directionalInterimStatus(params: {
  kind: DirectionalKind;
  side: DirectionalSide;
  entrySpot: number;
  barrier: number | null;
  liveSpot: number;
  settlesAt: number;
  /** Post-entry prices for Touch path check (optional). */
  pathSpots?: number[];
  now?: number;
}): InterimStatus {
  const now = params.now ?? Date.now();
  if (now >= params.settlesAt) return "settling";

  if (params.kind === "TOUCH_NO_TOUCH") {
    const barrier = params.barrier;
    if (!(barrier != null && barrier > 0)) return "losing";
    const up = barrier > params.entrySpot;
    const spots = params.pathSpots?.length ? params.pathSpots : [params.liveSpot];
    const touched = spots.some((p) => (up ? p >= barrier : p <= barrier));
    const winning = params.side === "TOUCH" ? touched : !touched;
    return winning ? "winning" : "losing";
  }

  if (params.kind === "VANILLA") {
    const strike = params.barrier ?? params.entrySpot;
    const itm =
      params.side === "CALL"
        ? params.liveSpot > strike
        : params.liveSpot < strike;
    return itm ? "winning" : "losing";
  }

  const winning = evaluateDirectional({
    kind: params.kind as "RISE_FALL" | "HIGHER_LOWER",
    side: params.side,
    entrySpot: params.entrySpot,
    exitSpot: params.liveSpot,
    barrier: params.barrier,
  });
  return winning ? "winning" : "losing";
}
