# Changelog

All notable changes to Neemiz are documented here. From v1.0.0 onward this file
is maintained automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/).

## [1.3.0](https://github.com/888Greys/Neemiz/compare/v1.2.0...v1.3.0) (2026-06-29)


### Features

* **admin:** add pending approvals counter badge and inspect user shortcut to approval queue ([de484fd](https://github.com/888Greys/Neemiz/commit/de484fd332d7b567a0e7c8a7c8786cfdbc7d375a))
* **admin:** add withdrawals history view alongside approvals queue ([#117](https://github.com/888Greys/Neemiz/issues/117)) ([04b771d](https://github.com/888Greys/Neemiz/commit/04b771dce10801c1bdc7b790dd1a9c612fb3054d))
* **admin:** paginate withdrawals history ([#118](https://github.com/888Greys/Neemiz/issues/118)) ([c1e5b93](https://github.com/888Greys/Neemiz/commit/c1e5b931c1b686bb262c671eaf0d918767622e3d))
* **p2p:** self-serve merchant signup with timed auto-approval (30–40 min) ([#111](https://github.com/888Greys/Neemiz/issues/111)) ([cc5bfa0](https://github.com/888Greys/Neemiz/commit/cc5bfa08552fd59449919f51be9ec4d5d1a04c5f))
* **security:** daily ledger reconciliation tripwire + admin alert ([0807019](https://github.com/888Greys/Neemiz/commit/0807019dda90a017ab4bbaabf699d8ba401b0222))
* **security:** daily ledger reconciliation tripwire + admin alert ([#114](https://github.com/888Greys/Neemiz/issues/114)) ([aa5eddb](https://github.com/888Greys/Neemiz/commit/aa5eddb1b0627602ba0607684db9a7e0c5365993))
* **security:** exempt admin users from daily caps, transaction limits, and velocity killswitches ([06940ca](https://github.com/888Greys/Neemiz/commit/06940cac587c3e143f6905428a2453eece0b6787))
* **security:** implement admin audit logs and bypass phone number linkage check for admin withdrawals ([e4635bb](https://github.com/888Greys/Neemiz/commit/e4635bb07139d35a2d27d9b465d377e9a82dc7ca))
* **security:** rate limiting, centralized admin gate, CSP, constant-time IPN ([#115](https://github.com/888Greys/Neemiz/issues/115)) ([8c1ea7d](https://github.com/888Greys/Neemiz/commit/8c1ea7d233d4581810128b8cd9924ed7cdcf1636))
* **security:** tie destination phone numbers exclusively to single accounts and remove consecutive withdrawal velocity holds ([3fb7878](https://github.com/888Greys/Neemiz/commit/3fb78788813a0aa4026b8c9fabd7fdcf4703fdf9))
* **wallet:** display shared rolling 24h cash-out limit on the Send tab ([b385930](https://github.com/888Greys/Neemiz/commit/b3859304b2cf5ad60b3e478db9b17545b22f8e0c))
* **withdrawals:** anti-mule guards — per-number velocity alert+hold, disable transfers, instant kill switch ([#112](https://github.com/888Greys/Neemiz/issues/112)) ([a96e74b](https://github.com/888Greys/Neemiz/commit/a96e74b8d14b68802019a074cd162fa4731d4f0e))
* **withdrawals:** auto-disable all payouts on strong collector-number signal ([#113](https://github.com/888Greys/Neemiz/issues/113)) ([804e475](https://github.com/888Greys/Neemiz/commit/804e4755715bcb7207753fdb0a0361d7c198b742))


### Bug Fixes

* **admin:** Aviator analytics read the dead bets table — repoint to ledger ([abaf103](https://github.com/888Greys/Neemiz/commit/abaf103b1fb43b1feeac5dda3c242708fee093f7))
* **admin:** read Aviator analytics from the ledger, not the dead bets table ([848c548](https://github.com/888Greys/Neemiz/commit/848c5488605f099ed975e53babd61ae07fe03cc2))
* **ci:** suffix staging docker tag with -staging to prevent overwriting production builds on same commit SHA ([72dbe7c](https://github.com/888Greys/Neemiz/commit/72dbe7c9c3755cc345b660db51b7af2c6019935a))
* **security:** exempt admins from kill switch on crypto withdrawals ([#116](https://github.com/888Greys/Neemiz/issues/116)) ([35c5fa9](https://github.com/888Greys/Neemiz/commit/35c5fa9ca97339819144e5f2e156f825d2abdc4a))
* **withdrawals:** close double-spend race + ship incident kill switch and owner allowlist ([#108](https://github.com/888Greys/Neemiz/issues/108)) ([e0e58a9](https://github.com/888Greys/Neemiz/commit/e0e58a95ecc0ecfc78d92a1b8ffd0969576928cf))
* **withdrawals:** rolling 24h cash-out cap + close daily-cap race ([#110](https://github.com/888Greys/Neemiz/issues/110)) ([ffb889c](https://github.com/888Greys/Neemiz/commit/ffb889cad9399ec2cb179042331e1fb777ada0d7))


### Reverts

* **security:** remove shared rolling daily limit check and UI progress bar from user-to-user transfers ([25c4905](https://github.com/888Greys/Neemiz/commit/25c49051cb95c79d1a92b2d7d80911ba6fd67684))

## [1.2.0](https://github.com/888Greys/Neemiz/compare/v1.1.0...v1.2.0) (2026-06-25)


### Features

* **admin:** add Yesterday to the market-detail range filter ([b1be756](https://github.com/888Greys/Neemiz/commit/b1be75670d9b7a96cb3996e8423e66aaa5483ebd))
* **admin:** business-metric health alerting cron ([155cda4](https://github.com/888Greys/Neemiz/commit/155cda4f7c50505257b1c397c0a24ca7b578446c))
* **admin:** cockpit landing + per-market P&L detail ([27a0717](https://github.com/888Greys/Neemiz/commit/27a0717ebbd6a2a0eb3e9a30385bf7fe52c58536))
* **admin:** metrics + per-market detail data layer (lib/admin) ([4b2c8f4](https://github.com/888Greys/Neemiz/commit/4b2c8f41ca2287de058b8dc1cafa89df86b546cd))
* **admin:** money flows + players sections ([5317cfe](https://github.com/888Greys/Neemiz/commit/5317cfefba1e4daef1e819175d48b6b931b0df87))
* **admin:** Nairobi-day boundaries, calendar day-picker, hourly Today, IA cleanup ([e36c8d9](https://github.com/888Greys/Neemiz/commit/e36c8d926574b8bbb74175373fbf3bd059559de8))
* **admin:** ops triage queue + risk & security feed ([d5d20d6](https://github.com/888Greys/Neemiz/commit/d5d20d6b6759a0d777df85f4bf2f2f3c1abaaf73))
* **admin:** wire the rebuilt admin navigation (shell) ([afb4b8c](https://github.com/888Greys/Neemiz/commit/afb4b8ca8702bbe9be717a0c7d62f27054dd576d))


### Bug Fixes

* **admin:** market chart follows range filter; remove blank gap on merged tabs ([b44e64c](https://github.com/888Greys/Neemiz/commit/b44e64cd7dd383208715c6b01dee1598d7da1d20))
* **admin:** market chart follows range filter; remove blank gap on merged tabs ([b3b676e](https://github.com/888Greys/Neemiz/commit/b3b676e3774066aa50ca9f47eea61c47bde5f46a))
* **deposits:** expire abandoned Lipa STK prompts in ~5m, not 30m ([0fdb80a](https://github.com/888Greys/Neemiz/commit/0fdb80a235d8b01bc2b060dad87c987a63e51719))
* **withdrawals:** reconcile silently skipped all non-queued stuck payouts ([ca8e0c7](https://github.com/888Greys/Neemiz/commit/ca8e0c755ada00bfff0ee507016e7668e5065877))
* **withdrawals:** reconcile silently skipped all non-queued stuck payouts (money bug) ([63f9de0](https://github.com/888Greys/Neemiz/commit/63f9de0218af0c5c262171e15f3c60f78e82b2ea))

## [1.1.0](https://github.com/888Greys/Neemiz/compare/v1.0.0...v1.1.0) (2026-06-24)


### Features

* **ops:** off-site DB backup script + tested restore runbook ([9f7b56b](https://github.com/888Greys/Neemiz/commit/9f7b56b4ad6edd9b3008f75b6da036a52071bd47))

## 1.0.0 (2026-06-24)

First tagged production release — the baseline from which versioning begins.
Captures the current live platform (~2,500 users):

* Forex & binary trading surfaces (Deriv-style mobile UI), P2P marketplace,
  M-Pesa + crypto wallet, and server-authoritative bet settlement.
* Security hardening: off-box withdrawal signer with independent spend caps and
  a fail-closed kill switch, on-chain drainer auto-halt, seed-leak guards
  (pre-commit hook + gitleaks rule), and a full git-history secret scrub.
