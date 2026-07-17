// Binary auto-trader — pure strategy math + validation, shared by the start
// route and the server stepping cron (/api/cron/auto-trade). No DB or I/O here
// so it's trivially testable and the engine can't drift from the API.

import { FALLBACK_USD_KES, MAX_PLAY_USD, MIN_PLAY_USD } from "@/lib/play-usd";

export type AutoStrategy = "FIXED" | "MARTINGALE" | "DALEMBERT" | "OSCARS";
export type AutoSessionStatus =
  | "RUNNING" | "STOPPED" | "DONE_TP" | "DONE_SL" | "DONE_RUNS" | "ERROR";

// Hard guardrails — enforced server-side so a runaway Martingale can't drain a
// wallet. Floored at ~$1 / capped at ~$500 in KES (see lib/play-usd).
export const AUTO_MIN_STAKE = FALLBACK_USD_KES * MIN_PLAY_USD;
export const AUTO_MAX_STAKE = FALLBACK_USD_KES * MAX_PLAY_USD;
export const AUTO_MAX_RUNS_CAP = 500;       // a session can place at most this many trades
export const AUTO_MAX_MULTIPLIER = 5;       // Martingale factor ceiling
export const AUTO_MIN_MULTIPLIER = 1.1;

export interface SessionSizingState {
  baseStake: number;
  currentStake: number;
  multiplier: number;
  cyclePnl: number; // running P&L of the current Oscar's grind cycle
}

export interface StepResult {
  nextStake: number;   // clamped to [AUTO_MIN_STAKE, AUTO_MAX_STAKE]
  cyclePnl: number;    // updated cycle P&L (only meaningful for OSCARS)
}

const clampStake = (n: number) =>
  Math.min(AUTO_MAX_STAKE, Math.max(AUTO_MIN_STAKE, Math.round(n * 100) / 100));

/**
 * Given the outcome of the trade that just settled, compute the stake for the
 * next trade per the chosen strategy.
 *
 * @param won     did the last trade win
 * @param pnl     net P&L of the last trade (payout - stake on a win; -stake on a loss)
 */
export function nextStake(
  strategy: AutoStrategy,
  s: SessionSizingState,
  won: boolean,
  pnl: number,
): StepResult {
  const unit = s.baseStake; // 1 "unit" = the base stake

  switch (strategy) {
    case "FIXED":
      return { nextStake: clampStake(s.baseStake), cyclePnl: 0 };

    case "MARTINGALE":
      // Chase losses by scaling up; bank a win by resetting to base.
      return {
        nextStake: clampStake(won ? s.baseStake : s.currentStake * s.multiplier),
        cyclePnl: 0,
      };

    case "DALEMBERT":
      // Gentler than Martingale: +1 unit after a loss, -1 unit after a win.
      return {
        nextStake: clampStake(won ? s.currentStake - unit : s.currentStake + unit),
        cyclePnl: 0,
      };

    case "OSCARS": {
      // Oscar's Grind: never raise after a loss; raise by 1 unit after a win,
      // but never stake more than what's needed to close the cycle at +1 unit
      // profit. When the cycle banks >= 1 unit, reset to base and start fresh.
      const cyclePnl = s.cyclePnl + pnl;
      if (cyclePnl >= unit) {
        return { nextStake: clampStake(s.baseStake), cyclePnl: 0 }; // cycle won → reset
      }
      if (!won) {
        return { nextStake: clampStake(s.currentStake), cyclePnl }; // hold on a loss
      }
      // Won but cycle not yet closed → step up by a unit, capped so the next win
      // can't overshoot the +1-unit target.
      const remainingToTarget = unit - cyclePnl;          // > 0 here
      const stepped = Math.min(s.currentStake + unit, Math.max(unit, remainingToTarget));
      return { nextStake: clampStake(stepped), cyclePnl };
    }
  }
}

export interface StopCheck {
  totalPnl: number;
  runsDone: number;
  takeProfit: number; // positive
  stopLoss: number;   // positive (halt at -stopLoss)
  maxRuns: number;
}

/** Returns the terminal status if the session should stop, else null. */
export function stopStatus(c: StopCheck): Exclude<AutoSessionStatus, "RUNNING" | "STOPPED" | "ERROR"> | null {
  if (c.totalPnl >= c.takeProfit) return "DONE_TP";
  if (c.totalPnl <= -c.stopLoss)  return "DONE_SL";
  if (c.runsDone >= c.maxRuns)    return "DONE_RUNS";
  return null;
}

export interface StartInput {
  market?: string;
  side?: string;
  targetDigit?: number;
  durationTicks?: number;
  strategy?: string;
  baseStake?: number;
  multiplier?: number;
  takeProfit?: number;
  stopLoss?: number;
  maxRuns?: number;
}

export const AUTO_MARKETS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
export const AUTO_SIDES   = ["Even", "Odd", "Matches", "Differs", "Over", "Under"];
const STRATEGIES: AutoStrategy[] = ["FIXED", "MARTINGALE", "DALEMBERT", "OSCARS"];

export interface ValidatedStart {
  market: string; side: string; targetDigit: number; durationTicks: number;
  strategy: AutoStrategy; baseStake: number; multiplier: number;
  takeProfit: number; stopLoss: number; maxRuns: number;
}

/** Validate+normalize a start request. Throws Error(message) on bad input. */
export function validateStart(b: StartInput): ValidatedStart {
  const market = String(b.market ?? "");
  if (!AUTO_MARKETS.includes(market)) throw new Error("Invalid market");

  const side = String(b.side ?? "");
  if (!AUTO_SIDES.includes(side)) throw new Error("Invalid side");

  const targetDigit = Number(b.targetDigit ?? 0);
  if (!Number.isInteger(targetDigit) || targetDigit < 0 || targetDigit > 9)
    throw new Error("Invalid target digit");
  if (side === "Over"  && targetDigit >= 9) throw new Error("Invalid target: no digit is greater than 9");
  if (side === "Under" && targetDigit <= 0) throw new Error("Invalid target: no digit is less than 0");

  const durationTicks = Math.max(1, Math.min(30, Math.round(Number(b.durationTicks ?? 5))));

  const strategy = String(b.strategy ?? "FIXED").toUpperCase() as AutoStrategy;
  if (!STRATEGIES.includes(strategy)) throw new Error("Invalid strategy");

  const baseStake = Number(b.baseStake ?? 0);
  if (!Number.isFinite(baseStake) || baseStake < AUTO_MIN_STAKE || baseStake > AUTO_MAX_STAKE)
    throw new Error(`Base stake must be between ${AUTO_MIN_STAKE} and ${AUTO_MAX_STAKE.toLocaleString()}`);

  let multiplier = Number(b.multiplier ?? 2);
  if (strategy !== "MARTINGALE") multiplier = 2; // unused by other strategies
  else if (!Number.isFinite(multiplier) || multiplier < AUTO_MIN_MULTIPLIER || multiplier > AUTO_MAX_MULTIPLIER)
    throw new Error(`Multiplier must be between ${AUTO_MIN_MULTIPLIER} and ${AUTO_MAX_MULTIPLIER}`);

  const takeProfit = Number(b.takeProfit ?? 0);
  if (!Number.isFinite(takeProfit) || takeProfit <= 0)
    throw new Error("Take-profit must be greater than 0");

  // Stop-loss is mandatory — it's the runaway-Martingale brake.
  const stopLoss = Number(b.stopLoss ?? 0);
  if (!Number.isFinite(stopLoss) || stopLoss <= 0)
    throw new Error("Stop-loss is required and must be greater than 0");

  const maxRuns = Math.round(Number(b.maxRuns ?? 0));
  if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > AUTO_MAX_RUNS_CAP)
    throw new Error(`Max runs must be between 1 and ${AUTO_MAX_RUNS_CAP}`);

  return { market, side, targetDigit, durationTicks, strategy, baseStake, multiplier, takeProfit, stopLoss, maxRuns };
}
