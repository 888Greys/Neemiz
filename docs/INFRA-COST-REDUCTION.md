# Infrastructure Cost Reduction — Open-Source / Free Alternatives

_Last updated: 2026-06-11_

This document maps every paid/limited third-party service Neemiz depends on to a
free-tier or self-hosted open-source alternative, with feasibility notes for the
production VPS (`ssh nez`). Goal: run the platform on free tiers + the existing
VPS, accepting small trade-offs (mainly a few minutes' delay on some crypto
deposit crediting).

## VPS capacity (decides what is self-hostable)

| Resource | Value |
|---|---|
| Disk | 193 GB total, ~164 GB free |
| RAM | 11 GB (~9 GB available) |
| CPU | 6 cores |

**Implication:** EVM full nodes are **not** feasible (Ethereum Erigon ≈ 1.4 TB,
BSC ≈ 2.5 TB, Polygon ≈ 2 TB). A **pruned Bitcoin node + index (~30–80 GB) fits.**
So: use free RPC/explorer APIs for EVM/TRON, and optionally self-host BTC.

## The key lever: polling fallback already exists

`lib/crypto/deposit-checker.ts` already detects deposits by **polling Etherscan
(free) and TronGrid (free)** via the `check-deposits` cron. Moralis and Tatum
webhooks are only the *instant* notification layer on top. Dropping them and
relying on polling costs nothing and is already implemented — the only trade-off
is crediting latency (poll interval instead of instant).

## Per-service plan

| Service | Current limit/cost | Free / open-source alternative | VPS feasible? |
|---|---|---|---|
| **Moralis** (ERC20/BEP20/Polygon deposit webhooks) | Free CU cap; 12 addresses on stream | Etherscan-V2 polling (free, ETH+BSC) already in code; add Polygon via free PolygonScan or Ankr public RPC. Keep Moralis free tier as optional instant layer. | ✅ no node needed |
| **Tatum — TRON (TRC20-USDT)** | Free: 5-address cap, HMAC gated | TronGrid free + polling (already coded). Drop Tatum for TRON. | ✅ |
| **Tatum — BTC** | same | Self-host **BTCPay Server** or **pruned Bitcoin Core + electrs** → free, instant, own webhook | ✅ pruned+index ≈ 30–80 GB |
| **The Odds API** | Monthly credit cap (previously broke settlement) | **TheSportsDB** (already integrated, free) for results; **football-data.org** / **API-Football** free tiers for odds; existing fixture cache cuts spend | ✅ |
| **EVM full nodes** (only if eliminating RPC deps) | — | Erigon/Geth/BSC | ❌ disk too small — use free public RPCs |

## Recommended approach (cheapest, lowest-ops), in order

### (a) EVM + TRON deposits → polling only  ← start here
- Lean on `check-deposits` cron (Etherscan-V2 + TronGrid, both free).
- Tighten cron interval to ~1–2 min for acceptable crediting latency.
- Lets you **drop Tatum-TRON** and removes Moralis as a hard dependency.
- Trade-off: deposits credited within poll interval instead of instantly.
- Effort: code change in deposit-checker/cron only. No new infra.

### (b) BTC → self-host BTCPay Server
- Docker deploy on the VPS, pruned Bitcoin node (~1 hr setup, fits disk).
- Open-source, free, instant BTC deposit detection + webhook → replaces Tatum-BTC.
- Trade-off: one more service to maintain; initial block sync time.

### (c) Odds → TheSportsDB + free odds tier
- Use TheSportsDB (already wired) for results; add football-data.org / API-Football
  free tier for odds; keep the fixture cache layer to stay under limits.
- No paid Odds API needed unless premium markets are required.

## Net result
The platform can run on **free tiers + the existing VPS**. Only trade-off is a
couple minutes' delay on EVM/TRON deposit crediting (BTC stays instant via BTCPay).
Env vars `TATUM_*` / `MORALIS_*` can remain set as an optional instant layer; the
system stays correct without them via polling.

## Related
- Env inventory & migration state: see memory `neemiz-vercel-migration`.
- Settlement / sports data architecture: `docs/SPORTS-SETTLEMENT.md`.
