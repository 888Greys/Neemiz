# Plan: List native “self-paying” cryptos (no separate gas hot-wallet)

**Paste this file path into Claude to implement in the background:**

```
docs/NATIVE-CRYPTO-LISTING-PLAN.md
```

Absolute path (Windows):

```
C:\Users\HP\Desktop\My OS\Neemiz\docs\NATIVE-CRYPTO-LISTING-PLAN.md
```

---

## Goal

List cryptocurrencies that work **like Bitcoin**: withdrawing **that coin itself** does **not** require funding a separate gas hot wallet (no ETH for ERC-20, no TRX for USDT-TRC20, no BNB for BEP-20 USDT).

Fees are paid **in the same asset** being sent.

Keep existing live assets:

| Asset | Network | Notes |
|-------|---------|--------|
| BTC | BITCOIN | Already live — native |
| USDT | POLYGON | Live — platform covers POL gas (token, not native) |
| USDC | POLYGON | Live — same as USDT |

---

## What “free / self-paying” means

**Include (native coin):**
- User withdraws `COIN` on its native chain.
- Network fee is paid from `COIN` balance (or free bandwidth that still doesn’t need a *different* gas token).
- Ops does **not** need to keep a separate gas inventory just to move that coin.

**Exclude (tokens that need gas):**
- USDT/USDC on ERC-20, TRC-20, BEP-20, etc.
- Any SPL / TRC-20 / ERC-20 / BEP-20 token that burns a different native for fees.

**Note:** Polygon USDT/USDC stay as today (platform-funded POL). This plan is about **new native listings**, not changing stables.

---

## Recommended list (all self-paying natives)

### Phase A — ship first (fits current stack)

We already have HD / watch paths for **BTC**, **Tron**, and **EVM**. Prefer natives that reuse that.

| Code | Name | Network id (proposed) | Why first | Self-paying? |
|------|------|------------------------|-----------|--------------|
| **TRX** | Tron | `TRON` | Tron address derivation + TronGrid already exist; native TRX ≠ USDT-TRC20 | Yes |
| **ETH** | Ethereum | `ERC20` / `ETHEREUM` | EVM xpub already exists; ETH is native gas | Yes |
| **BNB** | BNB (BSC native) | `BEP20` / `BSC` | Same EVM address family; native BNB | Yes |
| **POL** | Polygon | `POLYGON` | Same EVM address; native POL (optional if we want native, not only stables) | Yes |

> **TRX yes:** native TRX is self-paying. Do **not** confuse with USDT-TRC20 (that needs TRX energy).

### Phase B — high demand, new chain adapters

| Code | Name | Network | Self-paying? | Effort |
|------|------|---------|--------------|--------|
| **SOL** | Solana | `SOLANA` | Yes | New address + RPC + signer |
| **LTC** | Litecoin | `LITECOIN` | Yes | UTXO like BTC (new derivation/path) |
| **XRP** | XRP | `XRPL` | Yes | New ledger + destination tag |
| **DOGE** | Dogecoin | `DOGECOIN` | Yes | UTXO-like |
| **BCH** | Bitcoin Cash | `BITCOINCASH` | Yes | UTXO-like |

### Phase C — later / optional

ADA, AVAX (C-Chain is EVM-ish but still ops), TON, NEAR, ALGO, SUI, APT, ATOM, DOT, XLM — all native/self-paying for the coin itself, but each needs its own deposit detection + signer support. **Do not list in UI as live until deposit + withdraw both work.**

---

## Product rule

For every new row in deposit/withdraw UI:

1. `enabled: true` only when **deposit address + credit + withdraw** work end-to-end.
2. Otherwise show `soon: true` (same pattern as current ETH in method registry).
3. Never list a **token** network under this “self-paying” program unless gas is platform-covered (like Polygon USDT today).

---

## Implementation plan (for Claude)

### 1. Catalogue (single source of truth)

Update / extend:

- `lib/wallet-deposit-options.ts` → `CRYPTO_DEPOSIT_ASSETS`, `VALID_CRYPTO_DEPOSIT_NETWORKS`
- `lib/wallet-withdraw-options.ts` → `CRYPTO_WITHDRAW_ASSETS`, `VALID_CRYPTO_WITHDRAW_NETWORKS`
- `lib/payments/method-registry.ts` → `walletLive` / `cryptoGroup` for new codes
- `lib/payments/country-methods.ts` → `GLOBAL_CRYPTO_METHODS` if needed
- P2P lists only if product wants them tradable: `components/p2p-merchant-client.tsx` `P2P_CRYPTOS`, browse/express coin lists, ads API `VALID_CRYPTOS`

**Phase A UI target (live or soon flags explicit):**

```
BTC   BITCOIN   live (existing)
USDT  POLYGON   live (existing)
USDC  POLYGON   live (existing)
TRX   TRON      live when wired
ETH   ETHEREUM  live when wired (or soon until withdraw ready)
BNB   BEP20     soon or live when native BNB withdraw ready
POL   POLYGON   optional soon
SOL   SOLANA    soon
LTC   LITECOIN  soon
XRP   XRPL      soon
DOGE  DOGECOIN  soon
```

### 2. Address derivation (`lib/crypto/`)

- **TRX:** reuse Tron path `m/44'/195'/0'/0/N` — store `crypto=TRX`, `network=TRON` (confirm naming vs existing `TRC20` usage; prefer `TRON` for native).
- **ETH / BNB / POL:** reuse EVM address; distinct `network` for deposit watchers.
- **SOL / LTC / XRP / DOGE:** new derive + xpub/signer support — mark soon until done.

Register watchers (Moralis / Tatum / chain RPC) per network in `hd-wallet.ts` / deposit registration.

### 3. Deposit detection

- Extend `lib/crypto/deposit-checker.ts` (and reconcile cron) for native TRX, ETH, BNB, etc.
- Credit user wallet ledger with correct `crypto` + `network`.
- Tests for parsers / network allowlists.

### 4. Withdrawals (signer)

- Signer must broadcast native transfers (TRX, ETH, BNB…) without a separate gas top-up step for *that* asset.
- Hot wallet holds the **same** asset for fees (normal).
- Do **not** enable USDT-TRC20 as part of this plan.

### 5. Wallet UI

- `components/wallet-client.tsx` already maps `CRYPTO_DEPOSIT_ASSETS` / `CRYPTO_WITHDRAW_ASSETS` — keep that pattern.
- Icons / network labels for TRON, ETHEREUM, etc.
- Clear copy: “Native · fees paid in TRX” (etc.).

### 6. P2P (optional, separate flag)

Only add to P2P browse/ads when escrow + merchant fund flows support that crypto. Prefer **wallet first**, P2P second.

### 7. Tests

- Extend `tests/wallet-deposit-options.test.ts` for new assets/networks.
- Add unit tests for any new deposit checkers.
- Do not break Polygon USDT/USDC or BTC.

### 8. Ops / env

Document required env keys (TronGrid, RPC URLs, Tatum/Moralis chains) in README or this doc’s checklist when enabling each asset.

Respect existing kill switch: `CRYPTO_DEPOSITS_ENABLED` must stay fail-closed.

---

## Suggested Claude execution order

1. **Catalogue + UI soon rows** for Phase B/C (safe, no chain risk).
2. **TRX native** end-to-end (highest value; stack mostly ready).
3. **ETH native** deposit + withdraw.
4. **BNB native** if BSC watcher/signer ready.
5. Stop before SOL/LTC/XRP unless explicitly asked — those are new chain projects.

---

## Acceptance criteria

- [ ] Docs/UI clearly distinguish native TRX vs USDT-TRC20.
- [ ] Live list only includes self-paying natives (plus existing Polygon stables).
- [ ] No new token network that requires a *different* gas coin unless platform gas is funded and documented.
- [ ] Deposit + withdraw work for each `enabled: true` asset.
- [ ] Tests updated; BTC / Polygon USDT / USDC still green.
- [ ] No seed/mnemonic in web app; signer-only signing unchanged.

---

## Phase 2 — TRX native: status & go-live

**Code shipped (PR: native TRX):**
- Signer (`signer/src/broadcaster.ts`) now broadcasts **native TRX** — `broadcastTron`
  branches on `crypto === "TRX"` to a `sendNativeTRX` (TronGrid `/wallet/createtransaction`
  TransferContract, fee paid from the TRX itself, **no** hot-wallet gas top-up).
- Deposit detection already existed (`checkTronTRXDeposits`, routed by `checkDeposits`
  for network `TRC20` + crypto `TRX`).
- Deposit-address derivation (`deriveTronAddress`, network `TRC20`) and the generic
  withdraw route (`app/api/crypto/withdraw/route.ts`, validates against
  `VALID_CRYPTO_WITHDRAW_NETWORKS`) are network-agnostic — no change needed.
- Catalogue: TRX uses network id **`TRC20`** (shared Tron family; `displayNet` keeps it
  visually distinct from USDT-TRC20). Listed **Coming soon** until the signer is deployed.

**Go-live checklist (do AFTER deploying the signer to soi):**
1. **Deploy the signer** with the native-TRX change to soi (manual, like BTC — rebuild the
   `signer/` container over WireGuard; confirm `resume.sh` / not halted). No new env needed
   (reuses `TRONGRID_API_KEY`).
2. **Smoke test** a tiny real TRX withdrawal end-to-end (deposit a little TRX to a derived
   address, then withdraw it out) and confirm the tronscan tx.
3. **Flip the catalogue** (one small PR):
   - `lib/wallet-deposit-options.ts`: TRX → `enabled: true, soon: false`; add
     `VALID_CRYPTO_DEPOSIT_NETWORKS.TRX = ["TRC20"]`.
   - `lib/wallet-withdraw-options.ts`: add TRX to `CRYPTO_WITHDRAW_ASSETS` +
     `VALID_CRYPTO_WITHDRAW_NETWORKS.TRX = ["TRC20"]`.
   - `app/api/crypto/withdraw/route.ts`: add `MIN_WITHDRAWAL.TRX` (e.g. 10).
4. Keep `CRYPTO_DEPOSITS_ENABLED=true` (fail-closed kill switch stays).

## Out of scope

- Enabling USDT on TRC20 / ERC20 / BEP20.
- Changing house gas funding for Polygon stables.
- Listing every Phase C coin as live without adapters.

---

## Quick answer for product

**Yes — list all self-paying natives we intend to support**, but:

- **Live now / next:** BTC (done), **TRX**, **ETH**, optionally **BNB** / **POL**.
- **Show as Coming soon:** SOL, LTC, XRP, DOGE, BCH, then Phase C.
- **Do not** list every blockchain coin as live until custody works.
