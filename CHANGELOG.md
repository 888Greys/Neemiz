# Changelog

All notable changes to Neemiz are documented here. From v1.0.0 onward this file
is maintained automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/).

## [1.7.0](https://github.com/888Greys/Neemiz/compare/v1.6.0...v1.7.0) (2026-07-05)


### Features

* **mobile:** section-native bottom navs for sports, p2p, polymarket, aviator ([#184](https://github.com/888Greys/Neemiz/issues/184)) ([6591009](https://github.com/888Greys/Neemiz/commit/659100995a38233bec9fcd552e68faeaa751c70f))

## [1.6.0](https://github.com/888Greys/Neemiz/compare/v1.5.0...v1.6.0) (2026-07-05)


### Features

* **auth:** challenge passkey during login ([#179](https://github.com/888Greys/Neemiz/issues/179)) ([8a17cb8](https://github.com/888Greys/Neemiz/commit/8a17cb8b0a09cad19c534192f6f10f131c326b29))
* **auth:** passwordless passkey login ([#180](https://github.com/888Greys/Neemiz/issues/180)) ([6104d2f](https://github.com/888Greys/Neemiz/commit/6104d2ff9cde1b82a1a7f30c820b0935e7584fe2))


### Bug Fixes

* **auth+ui:** passkey duplicate-name enroll + currency dropdown in mobile drawer ([#174](https://github.com/888Greys/Neemiz/issues/174)) ([3e94338](https://github.com/888Greys/Neemiz/commit/3e943387f907adecef72739353f941b96a006d26))
* **auth:** don't show Link-Phone modal (or "Unauthorized") on a 401 session ([#171](https://github.com/888Greys/Neemiz/issues/171)) ([5fe5e7f](https://github.com/888Greys/Neemiz/commit/5fe5e7fce5496f323d1dfe715a9db55a2f6aeb23))
* **auth:** make sign-out actually log the user out ([#176](https://github.com/888Greys/Neemiz/issues/176)) ([af66d64](https://github.com/888Greys/Neemiz/commit/af66d648c135ace1589fc92226d6bcae79957af1))
* **auth:** make sign-out actually log the user out ([#178](https://github.com/888Greys/Neemiz/issues/178)) ([9b4cb49](https://github.com/888Greys/Neemiz/commit/9b4cb49e217a30476fd10d85f66a106648bd353b))
* **auth:** passkey enroll offers on-device (platform) authenticator ([#175](https://github.com/888Greys/Neemiz/issues/175)) ([8e2561d](https://github.com/888Greys/Neemiz/commit/8e2561daa4a13c98e0a08b7827021ea197a6c046))
* **auth:** passkeys via MFA WebAuthn API (self-hosted GoTrue has no /passkeys/*) ([#169](https://github.com/888Greys/Neemiz/issues/169)) ([cd63e6a](https://github.com/888Greys/Neemiz/commit/cd63e6ad8461c029d30c6a906dad2dec6fe17e92))
* **build:** sync package-lock.json for [@simplewebauthn](https://github.com/simplewebauthn) ([#181](https://github.com/888Greys/Neemiz/issues/181)) ([e2e06e0](https://github.com/888Greys/Neemiz/commit/e2e06e03a4f1d5a1f459230d5dbde091b027704f))
* **games:** disable exploitable bet types behind a per-type kill switch ([#182](https://github.com/888Greys/Neemiz/issues/182)) ([3dc7a0f](https://github.com/888Greys/Neemiz/commit/3dc7a0f4a6ec0ab43bee749cbfff81d81dbb1bd2))
* **incident:** plug P2P cash-out kill-switch gap, disable accumulator, fix forex double-close ([#183](https://github.com/888Greys/Neemiz/issues/183)) ([e2a1773](https://github.com/888Greys/Neemiz/commit/e2a1773f15d2156e2e21788a0a58d3277d2f870b))
* **p2p:** payment-method UX cleanup + 2FA manual-key copy button ([#172](https://github.com/888Greys/Neemiz/issues/172)) ([b466448](https://github.com/888Greys/Neemiz/commit/b466448f9bcdb50073f9bba3a0ad8f2096f5eb7c))
* **p2p:** real brand logos + per-method field labels + un-clip method picker ([#173](https://github.com/888Greys/Neemiz/issues/173)) ([a5ed698](https://github.com/888Greys/Neemiz/commit/a5ed6984491de9c5bdc1e24ef488c6ca0b53bc70))
* **withdraw:** remove low-float admin alert entirely ([#177](https://github.com/888Greys/Neemiz/issues/177)) ([e8e80c4](https://github.com/888Greys/Neemiz/commit/e8e80c4ae8d3c5eb4c82df2a58a1d1bc0a22249e))

## [1.5.0](https://github.com/888Greys/Neemiz/compare/v1.4.0...v1.5.0) (2026-07-04)


### Features

* **admin:** show email column in withdrawals history ([#145](https://github.com/888Greys/Neemiz/issues/145)) ([e76804e](https://github.com/888Greys/Neemiz/commit/e76804e6b5308a01bb4dee6cdb34a83c945a985b))
* **aviator:** finish it — two MP3 sounds, masked players, avatar-ready rows ([#155](https://github.com/888Greys/Neemiz/issues/155)) ([132f02d](https://github.com/888Greys/Neemiz/commit/132f02d679d9c9f132319abc1a7bbc28adf1d23f))
* **p2p:** collapse ad pricing to percentage-only (merchant picks their %) ([#156](https://github.com/888Greys/Neemiz/issues/156)) ([239754c](https://github.com/888Greys/Neemiz/commit/239754cde78b9474f0dab56ef56794ebfe68e3e8))
* **p2p:** searchable full-catalogue payment filter on browse ([#163](https://github.com/888Greys/Neemiz/issues/163)) ([9fbf2c1](https://github.com/888Greys/Neemiz/commit/9fbf2c111130262b823e9ed82897a672386a5cf1))
* **profile:** avatar upload via R2 (front-end) ([#161](https://github.com/888Greys/Neemiz/issues/161)) ([dde1756](https://github.com/888Greys/Neemiz/commit/dde17564c986b492063cd1dae1b0f9cd7845b1f4))
* **ui:** design-system spine — token-driven accessible primitives ([#148](https://github.com/888Greys/Neemiz/issues/148)) ([c7e72f4](https://github.com/888Greys/Neemiz/commit/c7e72f40ef644c43ad2c799b9b0a794610716c4d))
* **wallet:** cap transfers at KSh 50 and one M-Pesa payout per number ([#146](https://github.com/888Greys/Neemiz/issues/146)) ([0973785](https://github.com/888Greys/Neemiz/commit/09737851b79c4dde3ee1f172c0769e0098a78d54))


### Bug Fixes

* **aviator:** crash-only drruuu sound, faster anticlockwise sun, synced flight wave ([#157](https://github.com/888Greys/Neemiz/issues/157)) ([809769d](https://github.com/888Greys/Neemiz/commit/809769dba8c82e33e5e750ad0675b4d5feed8d26))
* **aviator:** plane flies off the top on crash, full-canvas curve, visible spinning sun ([#166](https://github.com/888Greys/Neemiz/issues/166)) ([82b8343](https://github.com/888Greys/Neemiz/commit/82b83433000dec9c9ada9996c5651bbc9db7d0d2))
* **aviator:** remove flight-curve wave, keep the clean Spribe-style arc ([#158](https://github.com/888Greys/Neemiz/issues/158)) ([9552ab1](https://github.com/888Greys/Neemiz/commit/9552ab1f02ff0b572a0d887804dbda7abfbd5518))
* **aviator:** remove the flew-away crash sound, keep background music only ([#160](https://github.com/888Greys/Neemiz/issues/160)) ([0231b68](https://github.com/888Greys/Neemiz/commit/0231b68dcbf37cb2d78c727baa0f18e212f01e94))
* **deploy:** add neemiz-binary-engine to package-lock.json ([#168](https://github.com/888Greys/Neemiz/issues/168)) ([7a9a49d](https://github.com/888Greys/Neemiz/commit/7a9a49d43b02cadc96a2404fcb9e94a63ccf2431))
* **directional:** kill guaranteed-win exploit on deep in-the-money barriers ([#143](https://github.com/888Greys/Neemiz/issues/143)) ([3074eba](https://github.com/888Greys/Neemiz/commit/3074eba4e7b0bb0dc66405e960340d7441ab4473))
* **directional:** reject non-positive barriers — closes negative-offset guaranteed-win exploit ([#151](https://github.com/888Greys/Neemiz/issues/151)) ([974c1d8](https://github.com/888Greys/Neemiz/commit/974c1d8d9820db82beb8a31844b0846a451245ec))
* **p2p:** payment methods now follow the selected fiat, not just KES ([#162](https://github.com/888Greys/Neemiz/issues/162)) ([c1a7312](https://github.com/888Greys/Neemiz/commit/c1a731202aea0e0bff22132285893a16d0714a1e))
* **settle:** safe time-boxed auto-void for dead PENDING sports bets ([#153](https://github.com/888Greys/Neemiz/issues/153)) ([91d581f](https://github.com/888Greys/Neemiz/commit/91d581fcb1324f2ef12b2be8aeca562b407f63ad))
* **ui:** replace all placeholder ? icons + real admin mobile drawer ([#154](https://github.com/888Greys/Neemiz/issues/154)) ([4cc5cd4](https://github.com/888Greys/Neemiz/commit/4cc5cd411ddf33229b015866be888fcc06f28a4d))
* **withdraw:** stop auto-crediting queued M-Pesa withdrawals; show maintenance instead ([#167](https://github.com/888Greys/Neemiz/issues/167)) ([8bb761d](https://github.com/888Greys/Neemiz/commit/8bb761d6b03ea18cce3a0ee9b4fab6ac90f0bc03))


### Refactors

* **binary:** extract digit/settlement/Deriv logic into neemiz-binary-engine ([#164](https://github.com/888Greys/Neemiz/issues/164)) ([c16f511](https://github.com/888Greys/Neemiz/commit/c16f511c4e5f5b8a6bb1c606a828fc0abdfa8b4e))
* **dashboard:** dead-code removal + tokenize colors + focus rings ([#149](https://github.com/888Greys/Neemiz/issues/149)) ([701cc44](https://github.com/888Greys/Neemiz/commit/701cc444d9f6b95ac54f512add7c419aa414744d))
* **wallet:** adopt Button primitive on live CTAs, delete dead modal ([#150](https://github.com/888Greys/Neemiz/issues/150)) ([85e25cd](https://github.com/888Greys/Neemiz/commit/85e25cd5e30e79d30ae11ee87220aad81e8a40d8))

## [1.4.0](https://github.com/888Greys/Neemiz/compare/v1.3.0...v1.4.0) (2026-07-01)


### Features

* **auth:** host GoTrue email-confirmation OTP template ([b332114](https://github.com/888Greys/Neemiz/commit/b332114afa203b30bf9d67415c4afa02cc60187c))
* build-version update prompt + password-reset OTP email template ([34b0208](https://github.com/888Greys/Neemiz/commit/34b020869679dbe5eda90dd652987543762929c7))
* **currency:** ~60 world currencies, searchable picker, mobile header switcher ([#123](https://github.com/888Greys/Neemiz/issues/123)) ([54b3ca6](https://github.com/888Greys/Neemiz/commit/54b3ca67b9c1967acc044f9af846cb640e9d8148))
* **currency:** forex + sports/wheel multi-currency ([#131](https://github.com/888Greys/Neemiz/issues/131)) ([c3b45a1](https://github.com/888Greys/Neemiz/commit/c3b45a162a73295fc0eeca73ca9e2f83688b5995))
* **currency:** multi-currency display layer (Phase 1) ([#122](https://github.com/888Greys/Neemiz/issues/122)) ([fb14c61](https://github.com/888Greys/Neemiz/commit/fb14c61206b0c6ad7ffc02419b5c83f41e5730a2))
* **currency:** transactional multi-currency in Aviator ([#128](https://github.com/888Greys/Neemiz/issues/128)) ([5e085ba](https://github.com/888Greys/Neemiz/commit/5e085ba62e43cebcaed8bce7102798f57bbd57fe))
* **currency:** transactional stake entry in binary panels ([c152f92](https://github.com/888Greys/Neemiz/commit/c152f92afcf7b97afcb00bdf4360e339d304a681))
* **currency:** transactional stakes in polymarket predictions ([6c8d686](https://github.com/888Greys/Neemiz/commit/6c8d686d272fb177e4a696c74b87191d2973c304))
* enforce mandatory phone number for registration and login prompt overlay ([388e993](https://github.com/888Greys/Neemiz/commit/388e9938c5c3e2dcf5ee420073ff229b0e4af842))
* polish phone prompt copy, display setting sync, and customize already registered error ([4505283](https://github.com/888Greys/Neemiz/commit/450528341d34ef2b5ae16c74a0475ea8ca0e00d4))
* **security:** add email-alias signal to signup tripwire ([#139](https://github.com/888Greys/Neemiz/issues/139)) ([bfdf064](https://github.com/888Greys/Neemiz/commit/bfdf064982dff7818ef5b3a7940847b512219370))
* **security:** ledger-backed balance guard on withdrawals ([#119](https://github.com/888Greys/Neemiz/issues/119)) ([155652c](https://github.com/888Greys/Neemiz/commit/155652cf45712b636ab46b2bf07018d72daf68a3))
* **security:** rate-limit crypto transfers + constant-time megapay token ([#121](https://github.com/888Greys/Neemiz/issues/121)) ([b43fc1e](https://github.com/888Greys/Neemiz/commit/b43fc1e4ff75a7a6f4b5c4ca394458042cc381cf))
* **security:** signup-velocity tripwire for bot account farming ([#138](https://github.com/888Greys/Neemiz/issues/138)) ([a01b9e1](https://github.com/888Greys/Neemiz/commit/a01b9e1316940b9979ee1183bd04e54ebb8b058d))
* **storage:** move avatar + P2P chat uploads to Cloudflare R2 ([#134](https://github.com/888Greys/Neemiz/issues/134)) ([7febf1d](https://github.com/888Greys/Neemiz/commit/7febf1d44c78c4bb41ed27a6ba6ddebb2fb5d819))


### Bug Fixes

* **auth:** log out stale pre-migration sessions instead of 401ing ([690e56c](https://github.com/888Greys/Neemiz/commit/690e56ccee4e0a6b72384ef5f29923c91d4c90b9))
* **currency:** sports bet-history + payout-preview formatting ([#133](https://github.com/888Greys/Neemiz/issues/133)) ([dfcc4fd](https://github.com/888Greys/Neemiz/commit/dfcc4fde3a9c0847c255dea51eb01062a4222b99))
* **deps:** sync package-lock.json with @aws-sdk/client-s3 ([#135](https://github.com/888Greys/Neemiz/issues/135)) ([7b52797](https://github.com/888Greys/Neemiz/commit/7b52797436406d742b5b6d0d33c764205ec75d56))
* update auth callback comment to reflect production URL ([1953da9](https://github.com/888Greys/Neemiz/commit/1953da90d32e5b552f434d6994143669116dca82))

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
