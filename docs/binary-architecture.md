# Binary Options — Robust Architecture

> Status: **design + foundation landed.** The whole binary-options product is
> offline for rebuild (see `lib/game-guard.ts` → `isBinaryOptionsInMaintenance`).
> This doc is the reference we build the rebuild against.

## The one law

> **A contract may only be sold at a price the house can *prove* is +EV for the
> house — where "prove" means the win probability was produced by the exact same
> code that will later settle it, over the exact same discretized process the
> market actually follows.**

Every historical exploit was one defect wearing different clothes: the **price**
was computed with one model and the **settlement** decided with another. When the
two disagree, some contract becomes +EV for the player and gets drained.

| Incident | Price model | Settlement reality | Result |
|---|---|---|---|
| Touch/No-Touch +524% | continuous reflection principle | 5 discrete ticks | NO_TOUCH underpriced |
| Odd/Even +40%, digit bias | assumed uniform digits | real (skewed) digits | parity bets +EV |
| Accumulator +363% | σ under-measured, barrier clamped | real survival | compounds +EV |
| Directional deep-ITM | `rateFromProb` clamp/floor + 0.5 fallbacks | real barrier | guaranteed win |

Kill the *class*: make price and settlement the **same code**. That is the whole
architecture.

## Layers

```
  MARKET MODEL   calibration cron → per-symbol σ, drift, jump, digit dist
       │                            (versioned, TTL; STALE ⇒ contracts disabled)
       ▼
  PRICING ENGINE   estimateWinProb(contract) = Monte-Carlo the SETTLEMENT KERNEL
       │           price = floor((1 − edgeFloor) / winProb), capped
       │           reject if winProb > MAX_WIN_PROB or price > liability cap
       ├───────────────┬────────────────────────────────
       ▼               ▼
  QUOTE (signed)   SETTLEMENT   both call the SAME kernel: didWin(contract, path)
       │               │        atomic PENDING→WON/LOST claim, feed outage ⇒ VOID
       ▼               ▼
  RISK + GUARDRAILS   liability caps · per-user RTP monitor · auto-halt ·
                      fairness-harness CI gate
```

### The settlement kernel — `lib/binary/kernel.ts`
Pure `(contract, tickPath) → outcome`. The single source of truth for "did it
win?". Called **millions of times over simulated paths** to price, and **once
over the real path** to settle. They cannot drift because they are the same
function. Rules: pure (no I/O/clock/RNG), **no outcome-inventing fallbacks** (a
contract that can't be settled deterministically must surface as VOID, never a
guessed win/loss), and no forked copy of win-logic anywhere.

### The fairness core — `lib/binary/fairness.ts`
`estimateWinProb` (Monte-Carlo the kernel), `measureRtp`, `safePayoutMultiplier`
(edge floor + house-safe *round-down*), and market simulation. Shared by the
test and the live audit.

## Bet lifecycle

1. **Quote (server-authored, signed).** Load `market_params` (reject if stale).
   `estimateWinProb` via the kernel → `price`. Return a signed quote
   `{contractSpec, price, paramsVersion, serverSeedHash, expiresAt}`. The client
   never sends a price or probability.
2. **Placement.** Validate the quote (unexpired, HMAC intact), debit stake with
   the atomic `updateMany` claim, store `entrySpot`, `paramsVersion`, seed
   commitment.
3. **Settlement.** Pull real ticks from `entryEpoch`, run the **same kernel**,
   atomic `PENDING→WON/LOST`, credit on win. Feed outage ⇒ VOID/refund. No client
   input ever touches the outcome.

## Provably fair
Commit–reveal for path-dependent outcomes: publish `serverSeedHash` at quote
time, derive the path/digit selection from `HMAC(serverSeed, clientSeed, nonce)`
(or bind to the immutable Deriv tick epoch), reveal `serverSeed` after
settlement. A public verifier reproduces the result — which also *forces*
price/settlement consistency, since a gap would be publicly visible.

## Measure, never assume
`market_params(symbol, version, sigma, drift, jump*, digit_dist, sampled_at,
status)` is refreshed by a calibration cron and read by pricing. Every contract
records the `params_version` it was priced under (full audit trail). Stale/thin
data ⇒ **fail closed** (contract disabled), never a guessed fallback. Replace
every `assume / clamp / fallback` in the old code with **measure or refuse**.

## Two automated nets
- **CI fairness gate** — `tests/fairness.test.ts` (`npm run test:fairness`).
  Encodes the invariant: a kernel-priced contract has realized RTP ≤ 1 for every
  family. Any pricing change that breaks it fails the build.
- **Live audit** — `scripts/fairness-sim.ts` (`npm run fairness:live`). Pulls
  real Deriv ticks and reports which *current live* contracts are +EV. Read-only.
- **Runtime RTP guard** (to build) — per-user, per-game realized RTP watched
  continuously; auto-halt + alert on threshold breach, wired to `game-guard`.
  Keep the P2P cash-out gate so a successful exploit still can't launder out.

## Pricing method (step 3) — why NOT classic options math

Black–Scholes and the reflection principle are what *broke* the product: they
assume a continuous, constant-volatility, no-jump market, and Deriv's synthetics
are discrete, fat-tailed and (JD10) jumpy. So pricing is **nonparametric**:

1. **Bootstrap real windows.** Draw many contiguous `duration`-tick windows from
   the recent real feed (contiguous, so volatility clustering / autocorrelation /
   jumps survive — not iid resampling).
2. **Run the kernel** over each window → the player's win frequency, measured by
   the same code that settles. No σ to under-measure, real digit distribution,
   real discrete touch behaviour. The Touch and digit gaps vanish by construction.
3. **Price off the Wilson UPPER bound** of that win frequency (house-conservative:
   sampling error can only cost the house margin) with a hard **edge floor**,
   payout **rounded down**, **liability caps**, and a **near-certainty reject**
   (the deep-ITM class). Insufficient/thin data ⇒ refuse to quote.

Implemented in `lib/binary/pricing.ts`; proven house-safe out-of-sample in
`tests/pricing.test.ts` and on **live Deriv data** in `scripts/pricing-proof.ts`
(`npm run pricing:proof`) — the worst legacy contract (NO_TOUCH @0.5σ) went from
104–118% RTP (player +EV) to ≤ 99% on every symbol. The edge floor (9%) is set
to absorb the regime drift low-vol indices show between calibration and
settlement; symbols too unstable to price safely should be failed-closed.

## Build order
1. ✅ **Extract the settlement kernel** — `lib/binary/kernel.ts` (behavior-preserving).
2. ✅ **Fairness harness + CI gate** — `lib/binary/fairness.ts`, `tests/fairness.test.ts`, `scripts/fairness-sim.ts`.
3. ✅ **Nonparametric pricing engine** — `lib/binary/pricing.ts`, `tests/pricing.test.ts`, `scripts/pricing-proof.ts`. Proven RTP ≤ 1 out-of-sample on live data.
4. ⏳ **Calibration cron + `market_params`** — persist the rolling per-symbol tick buffer; fail closed on stale.
5. ⏳ **Wire routes to the engine** — bet routes call the engine for the price; signed quotes + commit-reveal provably-fair; then re-enable behind the maintenance switch, one family at a time (Rise/Fall first).
6. ⏳ **Runtime RTP guard.**

## Regression pin
`tests/fairness.test.ts` also pins the root defect: the closed-form Touch model
*understates* the true discrete NO_TOUCH win rate (a discrete path touches ≤ as
often as the continuous path the model assumes). That gap is the exploit; the
kernel-priced tests have no such gap because they price off the same discrete
settlement. When step 3 rebuilds Touch pricing on the kernel, that gap closes.
