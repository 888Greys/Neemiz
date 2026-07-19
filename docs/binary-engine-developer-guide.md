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
| `lib/binary-price.ts` | Deriv access: `getServerTickHistory`, **`getLiveEntrySpot`** (fresh, uncached entry), `getContractExitDigit` (deterministic exit tick at `entryEpoch + durationTicks`). | I/O (Deriv) |
| `lib/binary/server-price.ts` | Request-path pricing (`priceDirectionalServer`) — turns a bet request + ticks into a stored payout. | ✅ pure |
| `lib/binary/provably-fair.ts` | Commit-reveal + signed quotes + `verifyOutcome` (kernel replay). | ✅ pure |
| `lib/binary/rtp-guard.ts` | Runtime guard: measures realized RTP, auto-halts a bleeding kind, flags high-RTP players. | I/O (DB) |
| `lib/game-guard.ts` | Kill switches: master maintenance, per-family live allowlist, per-bet-type disable, `disableBetType`. | I/O (DB) |
| `lib/directional.ts` | Contract math + `resolveContract` (the kernel's directional core). | ✅ pure |

## Bet lifecycle (directional, the live product)

`app/api/directional/bet/route.ts` POST:

1. **Auth + gates** — Supabase user, rate-limit, `isBetTypeDisabled(game, type)`.
2. **Market data** — `getCalibrationTicks(market)` (cached window + per-symbol `edge`) **and** `getLiveEntrySpot(market)` (fresh entry spot/epoch — never cached, closes the stale-entry timing edge).
3. **Price** — `priceDirectionalServer({ …, ticks: window, edgeFloor: calib.edge })`. Rejects near-certain / thin data (fail-closed).
4. **Prove** — `buildProof(...)` commits `SHA256(serverSeed)`, HMAC-signs the terms incl. `entryEpoch` + `payoutMultiplier`.
5. **Persist** — atomic debit → `directionalTrade` (PENDING) + `BET_STAKE` transaction. The stake tx stores public proof fields only (`commitment`, `signature`, `clientSeed`, `nonce`, multiplier); the private `serverSeed` lives on the trade row and is not returned until terminal status. Return `provablyFair { commitment, signature, clientSeed, nonce }`.
6. **Settle** (`/api/cron/settle-directional` + poll) — pull real ticks from `entryEpoch`, run the **same kernel** (`resolveContract`), `finalizeDirectional` flips PENDING→WON/LOST with an atomic claim, credits on win. Feed outage → VOID/refund. Win/refund transactions include `metadata.pfReveal`; losses reveal through the verifier endpoint because no payout transaction is created.

Settlement and pricing share `resolveContract`, so they cannot disagree.

## Pricing internals

- **`priceDirectionalContract`** — block-bootstrap `samples` windows from real ticks, run the kernel on each → win frequency; price off the **Wilson upper bound** (house-conservative) with the symbol edge floor, round the payout **down**, cap liability, reject near-certain (`maxWinProb`) / thin (`minTicks`).
- **`measureSymbolEdge`** — split the window, price Rise/Fall on the first half, measure realized win-rate on the held-out half, size the edge to cover drift **beyond a 1.5×SE noise band**. Clamped `[0.06, 0.15]`; thin data → max. Cached per calibration window.
- **Digits** — `priceDigitContract` / `priceDigitServer` prices off the **measured** last-digit distribution (never uniform). Wired on `POST /api/binary/bet`. Matches uses a stability gate (reject skewed ~10% freq) and a higher edge floor (15%); Over/Under use sticky-digit conditional pricing + microstructure/quarantine gates.

## Provably fair

Directional outcomes replay from public Deriv ticks, so the core proof needs no
server RNG:
- **Commitment** `SHA256(serverSeed)` published at bet time (bound to `clientSeed` + `nonce`); revealed only after settlement (`verifyReveal`). serverSeed does **not** affect the outcome — its job is pre-commitment/anti-backdating.
- **Signed quote** — HMAC over canonical terms incl. `entryEpoch`; `verifyQuoteSignature`. Tamper-evident. Secret: `PROVABLY_FAIR_SECRET`. In production there is no fallback to admin/2FA secrets.
- **Outcome** — `verifyOutcome(terms, forwardTicks, stake)` replays the kernel; anyone can re-fetch the public ticks and confirm. Verifiers: authenticated `GET /api/directional/verify?tradeId=...` for users/support, or `bunx tsx scripts/verify-trade.ts <tradeId>` server-side.

## Guards & operations (all DB-flag, no deploy)

`system_settings` keys, 10s cache:
- `disabled_bet_types` — per-`game:type` kill list. When the row is **absent**, code uses `DEFAULT_DISABLED` in `lib/game-guard.ts` (currently empty — all engine-backed digit/directional families + soft-reopened accumulator). When the row **exists**, its comma-separated value fully replaces the code baseline (empty string = nothing disabled). The RTP guard writes here via `disableBetType()` to auto-halt a bleeding kind. **No admin UI** — edit via SQL on the app DB.

**Prod / VPS — clear a stuck kill-switch override** (takes effect within ~10s cache TTL):

```sql
UPDATE system_settings SET value = '' WHERE key = 'disabled_bet_types';
-- or remove the override entirely so code DEFAULT_DISABLED applies:
-- DELETE FROM system_settings WHERE key = 'disabled_bet_types';
```

Crons (CRON_SECRET-gated, on nez crontab): `/api/cron/rtp-guard` (every 10m — auto-halt + high-RTP alerts), `/api/cron/rtp-summary` (periodic health digest), `/api/cron/admin-change-alert`. RTP guard env: `RTP_HALT_THRESHOLD` (1.10), `RTP_HALT_MIN_SAMPLE` (200), `RTP_USER_ALERT_THRESHOLD` (1.15), `RTP_WINDOW_HOURS` (12).

**Accumulator note:** soft-reopened on fair-barrier + 30% retention math (`lib/accumulator`), not kernel-priced and not watched by `rtp-guard`. Kill with token `accumulator:ALL` if realized edge turns player-favorable.

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
5. Ship behind `disabled_bet_types` if needed; clear the token to go live; watch the RTP guard / rtp-summary.
