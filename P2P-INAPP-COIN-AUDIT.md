# P2P In-App Coin Audit — Issues & Fixes

**Date:** 2026-07-16
**Scope:** In-app local coins (KES + per-country coins TZS/UGX/NGN/… pegged 1:1 to their fiat) across the full P2P lifecycle: ad creation → order → escrow → release / cancel / expire / dispute → fees/ledger.
**Method:** Code trace + 4 parallel deep-audit passes. Findings below are verified against code (file:line cited). The atomic DB guards mean most issues are **misvaluation / over-committed ads / stuck funds / mis-reported P&L**, not outright double-spend — except Finding 1, which is real fund loss.

> **Root theme:** wallet-backed local coins were bolted onto the KES 1%/1% model without porting two disciplines the real-crypto path already has: (a) consistent use of `isWalletBackedCoin` on *every* lifecycle branch, and (b) `bookCryptoFee`-style revenue booking. Plus the "KES committed across all of a merchant's sell ads" is computed three different, inconsistent ways.

---

## ✅ ALREADY FIXED IN THIS SESSION

### Finding 1 — HIGH (FUND LOSS): Lazy page-view expiry didn't refund non-KES local coins — **FIXED**
- **File:** `app/api/p2p/orders/[id]/route.ts:79`
- **Bug:** The auto-expire branch triggered when a user *opens* an expired order page gated the refund on `isKesCoin(order.crypto)` instead of `isWalletBackedCoin(...)` — unlike the cron sweep (`app/api/cron/expire-p2p-orders/route.ts:79`) and the list route (`app/api/p2p/orders/route.ts:58`), which both use `isWalletBackedCoin`.
- **Impact for TZS/UGX/NGN/etc.:**
  - **SELL ad (merchant = giver):** neither branch ran → merchant's escrowed `amount + 1%` stranded in `locked` **forever**. (e.g. SELL 1000 TZS → 1010 locked → 1010 lost.)
  - **BUY ad (taker = giver):** fell into `else if (BUY)` → refunded only `amount`, leaving the `1%` stuck.
  - Race: a user merely viewing the expired order beats the correct 2-min cron and triggers the buggy path.
- **Fix applied:** replaced the branch with the same `isWalletBackedCoin` + `unlockWalletCoin(tx, giverUserId, order.crypto, kesLockAmount(...))` + `recordWalletCoinMovement` logic the cron uses. Typechecks clean.
- **Still TODO (for Gemini):** add a regression test that expires a non-KES local-coin SELL + BUY order via the lazy path and asserts `locked` returns to 0 and the giver's `available` is made whole. There is currently **no test coverage** of local-coin escrow at all.

---

## 🔴 NOT YET FIXED — need decisions / larger changes

### Finding 2 — CRITICAL: Missing FX rate silently treated as 1:1 KES (no guard on backing/valuation)
- **Files:** `lib/currency-config.ts:244-251` (`convertToKes` / `convertFromKes` return the amount **unchanged** when the rate is absent), consumed unguarded at:
  - `lib/p2p/ad-backing.ts:105` (`assertLocalCoinSellBacking`) and `:195` (`deactivateUnbackedLocalCoinSellAds`)
  - `lib/p2p/fx.ts:66-68` (`convertToKES` uses `?? 1`) → order release fee basis `app/api/p2p/orders/[id]/release/route.ts:60`, dispute payout `app/api/admin/p2p/disputes/[id]/route.ts:198`, merchant "listed value in KES" `components/p2p-merchant-client.tsx:2954`
- **Why it's dangerous:** `FALLBACK_KES_PER_UNIT` (`lib/p2p/fx.ts:10-21`) has only **10 currencies**, but `LOCAL_COINS` is built from **145 active world currencies** (`lib/p2p/local-coins.ts:73-94`). When a rate is missing (provider down → only 10 survive; or exotic codes the feed never returns: **KPW, ERN, SSP, SYP, CUP, ZWL, VES, STN, MRU, SDG, SLE, IRR**):
  - Coin worth **< 1 KES** (e.g. UGX 0.034) → requirement **overstated ~29×** → solvent merchant wrongly rejected; `deactivateUnbackedLocalCoinSellAds` mass-deactivates every non-core coin ad platform-wide.
  - Coin worth **> 1 KES** (e.g. GBP 164, KWD ~370) → requirement **understated** → merchant can create a **massively under-backed** sell ad (real leak risk for high-value codes with no fallback).
- **Fix direction:** replace every `?? 1` / silent-identity fallback with an explicit **refuse** (throw `NO_FX_RATE` / show "rate unavailable") on money paths; and/or restrict the active-coin set to codes with a guaranteed rate. Files to touch: `lib/currency-config.ts`, `lib/p2p/fx.ts`, `lib/p2p/ad-backing.ts`, `lib/admin/real-money.ts:64,76`, `app/api/p2p/orders/[id]/release/route.ts`, `app/api/admin/p2p/disputes/[id]/route.ts`, `components/p2p-merchant-client.tsx`.

### Finding 3 — HIGH: The 2% fee on wallet-backed (KES + local) coin releases is never booked as revenue
- **Files:** `app/api/p2p/orders/[id]/release/route.ts:82-103` (wallet-backed branch calls only `releaseWalletCoin` + `recordWalletCoinMovement`, **no `bookCryptoFee`**; `feeKesPerCrypto` is forced to `0` at line 58). Revenue calcs filter only on `provider:"p2p_fee"` (`lib/admin/metrics.ts:456-474`, `app/api/admin/money/route.ts:58-60`, `app/api/admin/profits/route.ts:120-128`).
- **Impact:** On a 100,000 KES-coin trade the platform economically keeps 2,000 KES (giver −101,000, receiver +99,000) but **GGR/profit reports show 0**. All KES-coin and local-coin fee revenue is systematically under-reported.
- **Fix direction:** in the wallet-backed release branch, write a `p2p_fee` transaction (and, if configured, credit the `P2P_FEE_MERCHANT_ID` house account) for the `2%` spread, mirroring `bookCryptoFee`.

### Finding 4 — HIGH: Ledger doesn't conserve for wallet-backed coins (2% destroyed with no matching entry)
- **Files:** `lib/p2p/crypto-balance.ts:268-287` (`releaseWalletCoin`), `171-180` (`releaseKesCoinBalance`), `290-318` (`recordWalletCoinMovement`).
- **Impact:** Giver `locked −(amount+1%)`, receiver `+(amount−1%)`; the 2% difference is removed from circulation with no house credit and no fee row. Sum of coin transaction rows nets to **−2% owned by no one** → breaks the `ledger-guard` backing invariant that the real-crypto path maintains via `bookCryptoFee`. (Same fix as Finding 3 closes this.)

### Finding 5 — HIGH (POLICY): Admin-granted local coins are unbacked yet sellable for real cash
- **Files:** `app/api/admin/p2p/grant-coin/route.ts:77-92`, backing check `lib/p2p/ad-backing.ts:101-108`.
- **Behavior:** `grant-coin` credits `UserCryptoBalance.available` for a local coin with **no offsetting KES debit or liability entry**. The SELL backing check only reserves KES for the *FX shortfall* (`need − haveCoin`), so **coin the merchant already holds counts as fully backed and reserves nothing**. A merchant granted 10,000,000 NGN can sell it, buyers pay real fiat off-platform (M-Pesa), and the phantom token becomes real cash. The `/admin/p2p-backing` diagnostic even shows "Yes — headroom."
- **Note:** local-coins.ts documents these as a deliberate "marketing instrument," so this may be **by design** — but there is **no coin→KES liability reconciliation anywhere**. **Decision needed:** is granting unbacked sellable coin intended? If yes, track it as an explicit liability so P&L/backing reports are honest.

### Finding 6 — HIGH: Backing accounting is inconsistent across 3 places (over-committed ads)
Three views of "KES committed across a merchant's wallet-backed sell ads" that never agree — a merchant can advertise more local-coin liquidity than one KES wallet can convert. No theft (atomic debits), but orders **fail at fill time** on advertised liquidity.
- **6a** `assertKesSellBacking` (`lib/p2p/ad-backing.ts:22-39`) aggregates **only** `crypto:"KES"` ads → creating a KES sell ad ignores KES already needed to back the merchant's local-coin ads (while `assertLocalCoinSellBacking` *does* count KES ads — asymmetric).
- **6b** `assertLocalCoinSellBacking` (`:95-109`) subtracts the merchant's **full `haveCoin`** from every ad independently (never decremented in the loop) → two ads in the same coin double-count the same balance.
- **6c** Order-time `reservedKesForMerchant` (`lib/p2p/local-coin-convert.ts:129-135`) = only KES ads → funding a local-coin shortfall ignores KES committed to sibling local-coin ads.
- **Fix direction:** compute one shared "total KES committed across ALL active wallet-backed sell ads (KES + local, netting real coin holdings once)" and use it in all three sites.

### Finding 7 — LOW: `releaseWalletCoin` has no `locked >= amount` floor guard
- **File:** `lib/p2p/crypto-balance.ts:282-285` — decrements `locked` with no `gte` condition and no `count===0` check, so inconsistent state drives `locked` negative silently (contrast `settleCryptoEscrowRelease:416-423`). Add the guard.

### Finding 8 — LOW: Misleading create error reports coin figure for a KES shortfall
- **File:** `app/api/p2p/ads/route.ts:250-254` — "This sell ad needs {need} {crypto}" prints coin units when the real failing constraint is a **KES wallet** shortfall. **This is the exact message the owner hit** ("needs 1667889… TZS" at 1,000,000 KES balance). Report KES-required-vs-available instead (like `ads/mine/route.ts:143` and `p2p-merchant-client.tsx:2595` already do).

### Finding 9 — MEDIUM: Display vs charge FX snapshots can diverge
- **Files:** client display path `app/api/p2p/fx/route.ts:10` serves `s-maxage=3600, stale-while-revalidate=86400` (up to ~24h stale); server backing/funding calls `getFxRatesToKES()` with `revalidate:3600` — different cache entries. UI can show one rate while the server charges another. Read one shared snapshot for both.

---

## Items CHECKED and CLEAN (no action)
- Cancel route, cron expiry, list-GET expiry, release (double-release guarded), paid, dispute open, dispute resolve — all correctly use `isWalletBackedCoin` + `kesLockAmount`/`kesPayoutAmount`, status-guarded inside `$transaction`. Idempotent; no double-refund.
- No double-fee anywhere (lock `+1%` once, payout `−1%` once).
- `kesLockAmount` `toFixed(2)` precision on tens-of-millions TZS — safe.
- PATCH ad edit can't bypass backing (`availableAmount`/`totalAmount` not editable; re-runs backing on activation).
- Order-time promo / deposit / `NO_FX_RATE` gates enforced.
- `fundLocalCoinShortfallFromKes` rounds KES **up**, credits exact shortfall → house never loses on FX dust (dust is uncaptured but not a loss).
- Provider rate sanitization (`fx.ts:47` rejects 0/negative/NaN) — correct.

---

## Suggested priority for Gemini
1. **Finding 2** (FX identity fallback) — highest real-leak + availability risk; make money paths refuse on missing rate.
2. **Findings 3+4** (fee booking + ledger conservation) — one change closes both; needed for honest P&L.
3. **Finding 6** (unified backing accounting) — fixes over-committed ads and the owner's confusion.
4. **Finding 5** (grant-coin liability) — needs a product decision first.
5. **Finding 8** (error message) — quick UX win, directly what the owner saw.
6. **Findings 7, 9** — small hardening.
7. Add local-coin escrow **test coverage** (none today).
