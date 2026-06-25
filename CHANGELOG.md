# Changelog

All notable changes to Neemiz are documented here. From v1.0.0 onward this file
is maintained automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/).

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
