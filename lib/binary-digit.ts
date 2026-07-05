// Single source of truth for deriving a contract's "last digit" from a quote.
//
// Both the browser chart (components/binary/binary-client.tsx) and the
// server-side settlement (lib/binary-price.ts) MUST use this exact function so
// the digit a player sees on the chart matches the digit the server settles on.
// Any drift between the two derivations is a fairness/exploit risk.
export { quoteToDigit } from "neemiz-binary-engine";
