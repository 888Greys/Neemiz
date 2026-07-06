// ─────────────────────────────────────────────────────────────────────────────
// THE SETTLEMENT KERNEL — single source of truth for "did this contract win?"
//
// This module is the one place that decides a binary-options outcome from a
// realized tick path. It exists to enforce the product's core law:
//
//   A contract may only be sold at a price the house can PROVE is +EV for the
//   house — where "prove" means the win probability was produced by the exact
//   same code that will later settle the contract, over the exact same
//   discretized process the market actually follows.
//
// Every historical exploit (Touch/No-Touch +524%, Odd/Even +40%, accumulator
// +363%, directional deep-ITM guaranteed win) was the same defect: the PRICE
// was computed with one model and the SETTLEMENT decided with another. When the
// two disagree, some contract is +EV for the player.
//
// The fix is structural: pricing must not use a closed-form probability. It must
// call `estimateWinProb` (see the pricing engine, forthcoming) which Monte-Carlo
// simulates THESE kernel functions over the market model, and settlement must
// call THESE SAME functions over the real ticks. Price and settlement then
// cannot drift, because they are literally the same code.
//
// RULES for anything that touches this file:
//   • Kernel functions are PURE: (contract, tickPath) -> outcome. No I/O, no DB,
//     no clock, no randomness, no network. Determinism is what makes them
//     replayable for both pricing simulation and provably-fair verification.
//   • Never add a "fallback" that invents an outcome for missing/degenerate
//     input. A contract that cannot be settled deterministically must surface as
//     unresolved (VOID/refund upstream), never as a guessed win/loss.
//   • Both the settlement path AND the pricing simulation import from here. Do
//     not fork a second copy of the win logic anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { quoteToDigit } from "@/lib/binary-digit";
import { evaluateTrade } from "neemiz-binary-engine";
import {
  resolveContract,
  evaluateDirectional,
  type ResolveParams,
  type ContractResolution,
  type DirectionalKind,
  type DirectionalSide,
} from "@/lib/directional";

// A realized (or simulated) tick path: chronological price samples. `epoch` is
// the tick's server timestamp; pricing simulation may use synthetic epochs.
export type TickPath = { price: number; epoch: number }[];

// ─── Digit family (Even/Odd/Matches/Differs/Over/Under) ──────────────────────

export type DigitSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";

/** Derive a contract's settlement digit from a quote. The ONLY correct way to
 *  turn a price into the digit both the chart and settlement agree on. */
export function exitDigitFromQuote(quote: number): number {
  return quoteToDigit(quote);
}

/** Did a digit contract win, given the already-derived exit digit? */
export function digitContractWon(side: DigitSide, targetDigit: number, exitDigit: number): boolean {
  return evaluateTrade(side, exitDigit, targetDigit);
}

/** Settle a digit contract straight from the exit-tick quote (derive + decide).
 *  This is the kernel entry a pricing simulation calls per simulated path. */
export function digitWonFromQuote(side: DigitSide, targetDigit: number, exitQuote: number): boolean {
  return digitContractWon(side, targetDigit, exitDigitFromQuote(exitQuote));
}

// ─── Directional / path family (Rise-Fall, Higher-Lower, Touch, Vanilla) ─────
// `resolveContract` walks the tick path exactly as settlement does (early touch
// resolution, duration-tick expiry, vanilla intrinsic + retention). It is the
// canonical path kernel; re-exported here so pricing and settlement share it.

export { resolveContract, evaluateDirectional };
export type { ResolveParams, ContractResolution, DirectionalKind, DirectionalSide };
