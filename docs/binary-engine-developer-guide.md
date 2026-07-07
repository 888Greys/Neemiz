# Binary Engine — Developer Guide

Engineering reference for the rebuilt binary-options engine. For the owner-facing
rationale see [binary-architecture.md](./binary-architecture.md); this is the
module map, data flow, and how to extend/operate it safely.

## The law (repeat it before you change pricing)

> A contract may only be sold at a price proven +EV for the house, where the win
> probability is produced by the **same code** that settles it, over the **same
> discretized process** the market follows.

Every past exploit was a price/settlement mismatch. Do not introduce a closed-form
price, a "uniform"/"0.5" assumption, or an outcome-inventing fallback. Measure, or
refuse to quote.

## Module map

| Module | Responsibility | Pure? |
|---|---|---|
| `lib/binary/kernel.ts` | **Settlement kernel** — the single source of truth for "did this contract win, given the tick path". Both pricing and settlement call it. | ✅ pure |
| `lib/binary/fairness.ts` | Harness core: `estimateWinProb`, `measureRtp`, `safePayoutMultiplier`, seeded market sim (`makeRng`, `simulatePath`). | ✅ pure |
| `lib/binary/pricing.ts` | Nonparametric pricing: `sampleWindows` (block bootstrap), `wilsonUpper`, `priceDirectionalContract`, `priceDigitContract`, `measureSymbolEdge`. | ✅ pure |
| `lib/binary/calibration.ts` | Real-tick supply per symbol (cached ~3s) + the per-symbol `edge`. Fail-closed on thin data. | I/O (Deriv) |
| `lib/binary-price.ts` | Deriv access: `getServerTickHistory`, **`getLiveEntrySpot`** (fresh, uncached entry), `getServerBinaryDigit`. | I/O (Deriv) |
| `lib/binary/server-price.ts` | Request-path pricing (`priceDirectionalServer`) — turns a bet request + ticks into a stored payout. | ✅ pure |
| `lib/binary/provably-fair.ts` | Commit-reveal + signed quotes + `verifyOutcome` (kernel replay). | ✅ pure |
| `lib/binary/rtp-guard.ts` | Runtime guard: measures realized RTP, auto-halts a bleeding kind, flags high-RTP players. | I/O (DB) |
| `lib/game-guard.ts` | Kill switches: master maintenance, per-family live allowlist, per-bet-type disable, `disableBetType`. | I/O (DB) |
| `lib/directional.ts` | Contract math + `resolveContract` (the kernel's directional core). | ✅ pure |

## Bet lifecycle (directional, the live product)

`app/api/directional/bet/route.ts` POST:

1. **Auth + gates** — Supabase user, rate-limit, `isBinaryContractServable(kind)` (maintenance/allowlist), `isBetTypeDisabled`.
2. **Market data** — `getCalibrationTicks(market)` (cached window + per-symbol `edge`) **and** `getLiveEntrySpot(market)` (fresh entry spot/epoch — never cached, closes the stale-entry timing edge).
3. **Price** — `priceDirectionalServer({ …, ticks: window, edgeFloor: calib.edge })`. Rejects near-certain / thin data (fail-closed).
4. **Prove** — `buildProof(...)` commits `SHA256(serverSeed)`, HMAC-signs the terms incl. `entryEpoch` + `payoutMultiplier`.
5. **Persist** — atomic debit → `directionalTrade` (PENDING) + `BET_STAKE` transaction; proof stored in the stake tx `metadata.pf`. Return `provablyFair { commitment, signature, clientSeed, nonce }`.
6. **Settle** (`/api/cron/settle-directional` + poll) — pull real ticks from `entryEpoch`, run the **same kernel** (`resolveContract`), `finalizeDirectional` flips PENDING→WON/LOST with an atomic claim, credits on win. Feed outage → VOID/refund.

Settlement and pricing share `resolveContract`, so they cannot disagree.

## Pricing internals

- **`priceDirectionalContract`** — block-bootstrap `samples` windows from real ticks, run the kernel on each → win frequency; price off the **Wilson upper bound** (house-conservative) with the symbol edge floor, round the payout **down**, cap liability, reject near-certain (`maxWinProb`) / thin (`minTicks`).
- **`measureSymbolEdge`** — split the window, price Rise/Fall on the first half, measure realized win-rate on the held-out half, size the edge to cover drift **beyond a 1.5×SE noise band**. Clamped `[0.06, 0.15]`; thin data → max. Cached per calibration window.
- **Digits** — `priceDigitContract` prices off the **measured** last-digit distribution (never uniform). ⚠️ Not yet wired to the live route: `Matches` is drift-sensitive (rare event × big payout) and needs a stability gate + higher digit edge before enabling. See the digit note in memory.

## Provably fair

Directional outcomes replay from public Deriv ticks, so the core proof needs no
server RNG:
- **Commitment** `SHA256(serverSeed)` published at bet time (bound to `clientSeed` + `nonce`); revealed at/after settlement (`verifyReveal`). serverSeed does **not** affect the outcome — its job is pre-commitment/anti-backdating.
- **Signed quote** — HMAC over canonical terms incl. `entryEpoch`; `verifyQuoteSignature`. Tamper-evident. Secret: `PROVABLY_FAIR_SECRET` (falls back to `ADMIN_2FA_SECRET`).
- **Outcome** — `verifyOutcome(terms, forwardTicks, stake)` replays the kernel; anyone can re-fetch the public ticks and confirm. Verifier: `bunx tsx scripts/verify-trade.ts <tradeId>`.

## Guards & operations (all DB-flag, no deploy)

`system_settings` keys, 10s cache:
- `binary_options_maintenance` — master switch (default ON = whole suite offline).
- `binary_live_families` — per-family allowlist (currently `directional:RISE_FALL,directional:HIGHER_LOWER,directional:TOUCH_NO_TOUCH`).
- `disabled_bet_types` — per-`game:type` kill list; the RTP guard writes here via `disableBetType()` to auto-halt a bleeding kind.

Crons (CRON_SECRET-gated, on nez crontab): `/api/cron/rtp-guard` (every 10m — auto-halt + high-RTP alerts), `/api/cron/admin-change-alert`. RTP guard env: `RTP_HALT_THRESHOLD` (1.10), `RTP_HALT_MIN_SAMPLE` (200), `RTP_USER_ALERT_THRESHOLD` (1.15), `RTP_WINDOW_HOURS` (12).

## Testing & proof tools

- `npm test` — 95 tests. Fairness invariant (`tests/fairness.test.ts`) is the **CI gate**: kernel-priced ⇒ RTP ≤ 1 for every family.
- `bunx tsx scripts/pricing-proof.ts` — live before/after vs closed-form.
- `bunx tsx scripts/edge-proof.ts` — live per-symbol edges + out-of-sample RTP.
- `bunx tsx scripts/verify-trade.ts <tradeId>` — provably-fair verification of a real trade.

## Extending — add a contract family safely

1. Add its win logic to the **kernel** (pure `(contract, path) → outcome`); no fallbacks.
2. Add a `priceXContract` in `pricing.ts` that Monte-Carlos the kernel; add it to `tests/fairness.test.ts` and confirm RTP ≤ 1.
3. Wire the route through `server-price` + `calibration` (fresh entry where entry matters), fail-closed.
4. Add commit-reveal via `buildProof`.
5. Ship OFF; enable one symbol/family at a time via `binary_live_families`; watch the RTP guard.
