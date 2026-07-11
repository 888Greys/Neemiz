// Single source of truth for digit-contract quarantines, shared by the server
// pricing gate (lib/binary/server-price.ts) and the binary UI
// (components/binary/binary-client.tsx) so the two can never drift — the UI must
// not offer a contract the server rejects, and vice-versa.
//
// Markets whose digit calibration is currently mis-measured for Under and price
// it +EV. Live autopsy (7d): R_50 Under ran RTP ~1.33–1.42 on mid digits (Under
// 4/5/6) while the SAME digits on 1Hz markets settled house-favorable. The
// conditional win-prob the engine measures on R_50 calibration ticks understates
// the live low-digit skew, so the multiplier is set far too high. Fail closed
// until the R_50 digit distribution / quoteToDigit precision is recalibrated and
// proven RTP ≤ 1. Reversible: remove the symbol once the calibration lands.
export const UNDER_QUARANTINED_MARKETS = new Set<string>(["R_50"]);

/** True if `Under` must not be offered/priced on this market right now. */
export function isUnderQuarantined(market?: string | null): boolean {
  return !!market && UNDER_QUARANTINED_MARKETS.has(market);
}
