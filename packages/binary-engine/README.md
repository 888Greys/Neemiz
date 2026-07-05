# neemiz-binary-engine

A lightweight, server-safe, and dependency-free TypeScript library for fetching Deriv synthetic index tick feeds and evaluating digit options contracts (Even/Odd, Matches/Differs, Over/Under).

This is a modular extract of the core trading engine powering Neemiz's synthetic options platform.

## Features

- 🔌 **Deriv API WebSocket Client**: Easy connection management to retrieve authoritative tick quotes and histories.
- 🎯 **Digit Derivation**: Consistent client-server extraction logic ensuring the digit users see matches the digit settled on.
- 🧮 **Settle Rules**: Automatic win/loss checking for Even/Odd, Matches/Differs, and Over/Under options.
- 💰 **Risk & Payout Math**: Hardened multiplier rates with standard 5% house edges pre-calibrated.

---

## Installation

```bash
npm install neemiz-binary-engine
```

*Note: In older Node.js environments (Node < 18) where `globalThis.WebSocket` is not available, you should install the `ws` package and pass it as `WebSocketClass` during initialization.*

---

## Quickstart

### 1. Connecting to the Deriv Price Feed
```typescript
import { DerivClient } from "neemiz-binary-engine";

const client = new DerivClient({
  wsUrl: "wss://api.derivws.com/trading/v1/options/ws/public", // default
  wsTimeoutMs: 6000,                                         // default
});

// Fetch latest tick price for Volatility 100 (1s) Index
const price = await client.fetchLatestPrice("1HZ100V");
console.log(`Latest Price: ${price}`);
```

### 2. Settling a Digit Option Contract
```typescript
import { quoteToDigit, evaluateTrade, payoutRate } from "neemiz-binary-engine";

const exitPrice = 124.832;
const targetDigit = 3;
const predictionSide = "Matches";
const stake = 100; // in local currency (e.g. KES, USD)

// Extract the last digit (scaled to 2 decimal places)
const exitDigit = quoteToDigit(exitPrice); // 3

// Evaluate if prediction matched
const isWin = evaluateTrade(predictionSide, exitDigit, targetDigit); // true

// Calculate payout
const rate = payoutRate(predictionSide, targetDigit); // 9.15
const grossPayout = isWin ? stake * rate : 0; // 915

console.log(`Outcome: ${isWin ? "WON" : "LOST"}`);
console.log(`Payout: ${grossPayout}`);
```

### 3. Running in Node.js (with custom `ws` package)
If you are running in a backend script without native `globalThis.WebSocket`:
```typescript
import { DerivClient } from "neemiz-binary-engine";
import WebSocket from "ws";

const client = new DerivClient({
  WebSocketClass: WebSocket
});
```

---

## API Reference

### `DerivClient`
Main class to stream and fetch ticks from the Deriv API.

#### `new DerivClient(options?: DerivClientOptions)`
Options:
- `wsUrl?: string`: URL of the Deriv WebSocket endpoint (defaults to `"wss://api.derivws.com/trading/v1/options/ws/public"`).
- `wsTimeoutMs?: number`: Milliseconds to wait before throwing a timeout error (defaults to `6000`).
- `WebSocketClass?: any`: Custom WebSocket constructor (defaults to `globalThis.WebSocket`).

#### `fetchLatestPrice(symbol: string): Promise<number>`
Establishes a WebSocket connection, queries the latest tick for `symbol`, and closes the socket. Returns the numeric asset price.

#### `fetchTickHistory(symbol: string, startEpoch: number, count?: number): Promise<TickPoint[]>`
Queries tick history after `startEpoch` up to `count` total points. Returns an array of `{ price: number; epoch: number }` sorted chronologically.

---

### Digit & Rule Utilities

#### `quoteToDigit(quote: number): number`
Takes a float price quote and returns its last digit. Formula: `Math.abs(Math.floor(quote * 100)) % 10`.

#### `evaluateTrade(side: string, exitDigit: number, targetDigit: number): boolean`
Evaluates a trade constraint. Supports:
- `"Even"`: Won if `exitDigit` is even.
- `"Odd"`: Won if `exitDigit` is odd.
- `"Matches"`: Won if `exitDigit` matches `targetDigit`.
- `"Differs"`: Won if `exitDigit` is different from `targetDigit`.
- `"Over"`: Won if `exitDigit` is strictly greater than `targetDigit`.
- `"Under"`: Won if `exitDigit` is strictly less than `targetDigit`.

#### `payoutRate(side: string, targetDigit: number): number`
Returns the payout multiplier:
- Matches: `9.15`
- Differs: `1.05`
- Even / Odd: `1.90`
- Over: `9.5 / (9 - targetDigit)` (floored to 2 decimal places)
- Under: `9.5 / targetDigit` (floored to 2 decimal places)

---

## License

MIT
