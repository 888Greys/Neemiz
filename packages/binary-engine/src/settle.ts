export type BinaryTradeSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";

/**
 * Check if the trade prediction won or lost based on the exit digit.
 *
 * @param side The contract type prediction ("Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under")
 * @param exitDigit The final digit settled on the server
 * @param targetDigit The target barrier digit chosen by the user
 */
export function evaluateTrade(
  side: BinaryTradeSide | string,
  exitDigit: number,
  targetDigit: number
): boolean {
  if (side === "Even")    return exitDigit % 2 === 0;
  if (side === "Odd")     return exitDigit % 2 === 1;
  if (side === "Matches") return exitDigit === targetDigit;
  if (side === "Differs") return exitDigit !== targetDigit;
  if (side === "Over")    return exitDigit > targetDigit;
  return exitDigit < targetDigit; // Under
}

/**
 * Calculates the payout rate for a given prediction.
 * House edge is calibrated at ~5% on all contract types.
 *
 * @param side The contract type prediction
 * @param targetDigit The target barrier digit chosen by the user
 */
export function payoutRate(side: BinaryTradeSide | string, targetDigit: number): number {
  if (side === "Matches") return 9.15;
  if (side === "Differs") return 1.05;
  if (side === "Even" || side === "Odd") return 1.90;
  if (side === "Over") {
    const wins = 9 - targetDigit;
    return wins > 0 ? Math.floor((9.5 / wins) * 100) / 100 : 0;
  }
  const wins = targetDigit;
  return wins > 0 ? Math.floor((9.5 / wins) * 100) / 100 : 0;
}
