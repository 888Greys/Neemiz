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

## Phase A — native EVM coins (ETH, BNB, POL): SHIPPED

**Code shipped (this PR):** ETH, BNB, POL listed live end-to-end, reusing the
existing EVM rail with **no signer redeploy** (native sends already work):

- **Address:** shared EVM address (`deriveEVMAddress`, `m/44'/60'/0'/0/N`) — reused
  across `ERC20`/`BEP20`/`POLYGON` by `getOrCreateDepositAddress`. Registered with
  Moralis (already whitelisted for those three networks).
- **Deposit detection:** `checkEVMDeposits` handles native coins (Etherscan-V2
  `txlist`) via the `EVM_TOKENS` map. Added a native `POL:POLYGON` entry to
  `lib/crypto/token-registry.ts`; `ETH:ERC20` and `BNB:BEP20` already existed.
- **Withdrawal:** `broadcastEVM` already sends native value when the crypto has no
  token contract, and tops up gas in the same coin from the hot wallet (same as
  Polygon stables). `broadcastWithdrawal` routes `ERC20`/`BEP20`/`POLYGON` to it;
  explorer URLs already cover all three. **No `signer/` change → no redeploy.**
- **Catalogue:** ETH uses network id **`ERC20`** (chain 1) to reuse the rail;
  `displayNet` stays "Ethereum". BNB→`BEP20`, POL→`POLYGON`. Added to
  `VALID_CRYPTO_DEPOSIT_NETWORKS` / `VALID_CRYPTO_WITHDRAW_NETWORKS`,
  `CRYPTO_WITHDRAW_ASSETS`, and `MIN_WITHDRAWAL` (ETH 0.005, BNB 0.01, POL 2).

**⚠️ Go-live checklist before flipping traffic on:**
1. **Signer spend caps** — `policy.ts` per-tx/daily caps fall back to
   `DEFAULT: 1000` *in units of the coin*. 1000 ETH is ~$2M. Set explicit env
   caps on the signer host, e.g.
   `SIGNER_PER_TX_CAP={"ETH":1,"BNB":5,"POL":5000,"BTC":0.05}` and a matching
   `SIGNER_DAILY_CAP`. (This gap also affects the already-live BTC/TRX rails.)
2. **Fund the EVM hot wallet** with ETH / BNB / POL for gas top-ups (index 0).
3. **`ETHERSCAN_API_KEY`** must be set (deposit detection throws without it).
4. **Smoke test** a tiny real deposit + withdrawal on each of ETH, BNB, POL and
   confirm the explorer tx before announcing.
5. Keep `CRYPTO_DEPOSITS_ENABLED=true` (fail-closed kill switch stays).

## Phase B (partial) — Litecoin (LTC): SHIPPED (code)

LTC listed live end-to-end, reusing the **BTC UTXO rail** with **no new xpub/seed**:

- **Address:** LTC reuses the BTC secp256k1 key (same `MASTER_XPUB_BTC` path),
  re-encoded with Litecoin's P2PKH version byte `0x30` (`L…`). `deriveLTCAddress`
  in `xpub.ts`; `getOrCreateDepositAddress` treats `LITECOIN` as its own UTXO
  branch (not EVM-address-reuse). Signer `keys.ts` maps `LITECOIN`→coin path 0
  and encodes/matches the LTC address, so it controls the key with no new env.
- **Deposit detection:** `checkLTCDeposits` reuses the Esplora parser against
  `litecoinspace.org` (identical JSON to Blockstream). `LTC_EXPLORERS` +
  `getLTCBalance` added; `checkDeposits`/`tryGetOnChainBalance` route `LITECOIN`.
- **Withdrawal:** signer `broadcastBTC` generalized to `broadcastUTXO(chain,…)`
  (`UTXO_CHAINS` map: API base + address decoder + explorer). Tx construction,
  sighash, DER signing are byte-identical to BTC. Self-paying: fee out of the LTC.
- **Catalogue/route/UI/tests:** LTC flipped live in deposit + withdraw options,
  `MIN_WITHDRAWAL.LTC=0.01`, `NETWORK_LABEL.LITECOIN`, and tests updated
  (incl. `tests/ltc-address.test.ts` proving the `L…` encoding).

**⚠️ LTC go-live (in addition to the EVM checklist above):**
1. **Fund the LTC hot wallet** — the LTC address for HD index 0 (same key as the
   BTC hot wallet, LTC-encoded) needs a little LTC so max-send withdrawals work.
2. **Signer redeploy required** — unlike the EVM coins, `signer/` changed
   (broadcaster/keys/address-codec). Rebuild the signer container on soi.
3. **`LTC_API`** optional env override (defaults to `https://litecoinspace.org/api`);
   set a backup Esplora endpoint if desired. Same for `BTC_API`.
4. **Smoke test** a tiny real LTC deposit + withdrawal and confirm on the explorer
   before announcing.

## Phase B (partial) — Dogecoin (DOGE): WIRED, pending smoke test

DOGE is fully plumbed end-to-end but deliberately **left `soon` / not in the
allowlists**, because its explorer path is new and could not be exercised in-repo.

- **Address / key:** reuses the BTC secp256k1 key (like LTC), re-encoded with
  DOGE's P2PKH version byte `0x1e` (`D…`). `deriveDOGEAddress`, `getOrCreateDepositAddress`
  DOGE branch, signer `keys.ts` maps `DOGECOIN`→coin path 0.
- **Withdrawal:** the signer's `broadcastUTXO` now takes a pluggable **provider**.
  BTC/LTC use the Esplora provider; DOGE uses a **BlockCypher provider** (UTXO
  list / fee / broadcast — different JSON shape, koinu = 1e8). Tx build/sign is
  the same proven secp256k1 UTXO code. Per-chain `dust` (DOGE 1,000,000 koinu).
- **Deposit detection:** `checkDOGEDeposits` + `getDOGEBalance` via BlockCypher.
  `checkDeposits`/`tryGetOnChainBalance` route `DOGECOIN`.
- **Pre-staged:** `MIN_WITHDRAWAL.DOGE`, `NETWORK_LABEL.DOGECOIN`, address tests.

**⚠️ DOGE requires (before flipping live) — a signer redeploy + smoke test AND:**
1. `BLOCKCYPHER_TOKEN` env on both the app and the signer (BlockCypher free tier
   is heavily rate-limited without a token). Optional `DOGE_API` override.
2. Fund the DOGE hot wallet (index-0 key, DOGE-encoded).
3. **Verify the BlockCypher provider against real DOGE** — deposit detection JSON,
   fee estimation (koinu/kB → koinu/vByte), and the `/txs/push` broadcast shape.
4. **The one-line go-live flip** (after smoke test passes):
   - `wallet-deposit-options.ts`: DOGE → `enabled: true, soon: false`, add
     `VALID_CRYPTO_DEPOSIT_NETWORKS.DOGE = ["DOGECOIN"]`.
   - `wallet-withdraw-options.ts`: add DOGE asset + `VALID_CRYPTO_WITHDRAW_NETWORKS.DOGE`.
   - Update the two option tests (move DOGE from the `soon` set to live).

## Phase B (partial) — Bitcoin Cash (BCH): WIRED, pending smoke test

BCH is fully plumbed but left `soon` / out of the allowlists (unverified explorer).
It reuses the BTC secp256k1 key (re-encoded), but has two genuinely new pieces:

- **CashAddr** (`bitcoincash:q…`): hand-rolled bech32-style codec in
  `lib/crypto/cashaddr.ts` (+ signer copy). **Verified offline** against the
  canonical spec vector (`tests/cashaddr.test.ts`) — encoding is known-correct.
  The signer's `bchAddressToHash160` accepts CashAddr (with/without prefix) and
  falls back to legacy base58 P2PKH for destinations.
- **BIP143 signing**: BCH replaced the legacy sighash with a BIP143 preimage +
  `SIGHASH_FORKID` (0x41). `broadcastUTXO` now branches on a per-chain `sighash`
  strategy (`"legacy"` for BTC/LTC/DOGE, `"bip143"` for BCH via `bip143Sighashes`).
  The serialized tx format is otherwise identical. **This sighash path is NOT
  verified in-repo** (no signed-tx vector) — the key smoke-test risk.
- **Explorer**: Blockchair provider (`blockchairProvider`) for UTXO / fee /
  broadcast; app deposit detection + balance via Blockchair's address dashboard.
- **Pre-staged**: `MIN_WITHDRAWAL.BCH`, `NETWORK_LABEL.BITCOINCASH`.

**⚠️ BCH go-live — signer redeploy + smoke test AND:**
1. `BLOCKCHAIR_KEY` env (app + signer); optional `BCH_API` override. Confirm the
   exact address format Blockchair expects (prefix vs prefixless CashAddr).
2. Fund the BCH hot wallet (index-0 key, CashAddr-encoded).
3. **Verify the BIP143 signature on a real tiny BCH tx** (this is the part that
   could not be checked offline) + the Blockchair deposit/fee/broadcast shapes.
4. One-line flip: BCH → `enabled: true, soon: false`,
   `VALID_CRYPTO_DEPOSIT_NETWORKS.BCH = ["BITCOINCASH"]`, add the withdraw asset +
   `VALID_CRYPTO_WITHDRAW_NETWORKS.BCH`, update the two option tests.

**Not yet wired (still `soon`):** SOL (ed25519 + new lib), XRP (binary codec +
destination-tag redesign) — both need a new dependency, out of this stack's scope.

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
