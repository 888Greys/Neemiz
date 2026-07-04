/**
 * Single source of truth for deriving a contract's "last digit" from a quote.
 *
 * Both the browser chart and the server-side settlement MUST use this exact
 * function so the digit a player sees on the chart matches the digit the
 * server settles on. Any drift between the two derivations is a fairness/exploit risk.
 */
export function quoteToDigit(quote: number): number {
  return Math.abs(Math.floor(quote * 100)) % 10;
}
