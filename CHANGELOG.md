# Changelog

All notable changes to Neemiz are documented here. From v1.0.0 onward this file
is maintained automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/).

## [1.9.1](https://github.com/888Greys/Neemiz/compare/v1.9.0...v1.9.1) (2026-07-11)


### Performance

* shared Deriv tick feed for bet and settle paths ([c09e835](https://github.com/888Greys/Neemiz/commit/c09e835a56e10a1c82fedad7b94b1c272af0168a))
* shared Deriv tick feed for bet and settle paths ([6393c82](https://github.com/888Greys/Neemiz/commit/6393c82ce59fd0bce386c1374de9e399a2748f3e))
* tick-driven binary settle + Realtime push ([6195757](https://github.com/888Greys/Neemiz/commit/61957579090bd8bb2cfddef4d01254f065eeaa4f))
* tick-driven binary settle + Realtime push ([334cc2e](https://github.com/888Greys/Neemiz/commit/334cc2ea52bb4fd9973188f584b9196d276154fa))

## [1.9.0](https://github.com/888Greys/Neemiz/compare/v1.8.0...v1.9.0) (2026-07-10)


### Features

* **admin:** add new console preview ([19c2126](https://github.com/888Greys/Neemiz/commit/19c2126c1548f58db2dbc8c88cecf34c93c6be35))
* **admin:** manage promo codes — create, pause, totals, redemptions ([f3b31c0](https://github.com/888Greys/Neemiz/commit/f3b31c09310f28b8cf30b7d0ec5c1c085ef706ad))
* **admin:** paginate and filter promo codes and redemptions ([ab97548](https://github.com/888Greys/Neemiz/commit/ab97548f11bbb4fcfcf5a57540352183935dd84f))
* **admin:** promo list pagination and filters ([03d9b0a](https://github.com/888Greys/Neemiz/commit/03d9b0a5b1aeb97fea0e9b9129276a03c18c91c6))
* **admin:** promo management page ([a8604c7](https://github.com/888Greys/Neemiz/commit/a8604c7d7a6d751b2635cba817271195a4c0e1c4))
* **alerts:** route admin alerts to Telegram instead of email ([8dd4d0a](https://github.com/888Greys/Neemiz/commit/8dd4d0afda560e24204a1a52d21a42484b4cecab))
* **auth:** cap accounts per device + Tor block ([f043fd9](https://github.com/888Greys/Neemiz/commit/f043fd912359df541ed6d59a29804fc754b14f6b))
* **auth:** cap accounts per device and block Tor signups ([52aa46d](https://github.com/888Greys/Neemiz/commit/52aa46dc3f5090fc6b27bc47e7f7d81ab497a595))
* **binary:** conditional (entry-digit-aware) pricing to safely re-enable Over/Under ([e392e44](https://github.com/888Greys/Neemiz/commit/e392e44f09f186b010602de2e847fb3776b4c61c))
* **bonus:** wagering cycle — turnover requirement, cashout cap, expiry (bonus item 4) ([#232](https://github.com/888Greys/Neemiz/issues/232)) ([1661d9a](https://github.com/888Greys/Neemiz/commit/1661d9a7ceecb94fe97312f3819581e8d049e859))
* **crypto:** Bitcoin deposits + withdrawals ([#234](https://github.com/888Greys/Neemiz/issues/234)) ([13376a4](https://github.com/888Greys/Neemiz/commit/13376a4585b55dd6f7420803b91c83ad7ad0a096))
* **crypto:** clamp phantom ledgers to current on-chain balances ([e5c4345](https://github.com/888Greys/Neemiz/commit/e5c43455e03a2d18b8cc60c090067486ff786e31))
* **crypto:** flip native TRX live (deposit + withdraw) ([c03c8f8](https://github.com/888Greys/Neemiz/commit/c03c8f8e573624f070e11ad017bf0cedae6bd426))
* **crypto:** native TRX withdrawal in signer + TRX listing prep (Phase 2) ([4cc1bb5](https://github.com/888Greys/Neemiz/commit/4cc1bb55c9a14b13d32f9a355afc6990663efe0d))
* **crypto:** schedule safe on-chain ledger reconcile ([634999e](https://github.com/888Greys/Neemiz/commit/634999e6b786e45202686e73f667a540ff085f3a))
* **email:** Bybit-style Nezeem transactional templates ([4a49852](https://github.com/888Greys/Neemiz/commit/4a49852750c351b50cbc6cfa1dbdb3fc53465f3c))
* **email:** Bybit-style Nezeem transactional templates ([e658037](https://github.com/888Greys/Neemiz/commit/e6580377118602d7e0caa3f3c7c3d232fe527d45))
* **forex:** mobile redesign — Markets nav, chart-first ticket, errors and margin ([c4c092a](https://github.com/888Greys/Neemiz/commit/c4c092ab39f40ab639cbfb3111f22e5bcad0593a))
* **forex:** mobile redesign (Markets nav + chart-first ticket) ([12bc876](https://github.com/888Greys/Neemiz/commit/12bc876afaa4a64524b103bcb73f3a0a1ba23c59))
* **nav:** finish shell architecture — flat Sports/P2P links and compact header ([8eb3129](https://github.com/888Greys/Neemiz/commit/8eb312972a4a5910d27dac7e00166842211902e8))
* **p2p:** add P2P browse tab next to Menu in bottom nav ([391cacd](https://github.com/888Greys/Neemiz/commit/391cacdb872741d656bce7014370ac38f12fdc97))
* **p2p:** all world payment methods when creating an ad ([d3cf82e](https://github.com/888Greys/Neemiz/commit/d3cf82eb93593d2f9d90e359db1832401c3c6190))
* **p2p:** bottom nav Menu, Orders, Ads, Profile ([501e5cf](https://github.com/888Greys/Neemiz/commit/501e5cfb4e234605314b3084f9b71d542f43ec9e))
* **p2p:** Bybit-style ads/profile UX and flatter shell nav ([9982aff](https://github.com/888Greys/Neemiz/commit/9982aff4bf5241c94948f9de272e1569e938b772))
* **p2p:** Bybit-style market chrome and add KIP100/SILAS50 promos ([da20c15](https://github.com/888Greys/Neemiz/commit/da20c15d68efa2b33ea98bcedeeb584bc0f9aa5d))
* **p2p:** create-ad payment picker lists all world methods ([763f33c](https://github.com/888Greys/Neemiz/commit/763f33c0ee4aab283ccdbe2ba7ecc462f5eac19f))
* **payments:** international methods catalogue with brand logos ([d50b909](https://github.com/888Greys/Neemiz/commit/d50b9097470399e60dda3c0b9ed2f51d9832aced))
* **promo:** per-device redemption cap + recon threshold to cut alert noise ([b48ddef](https://github.com/888Greys/Neemiz/commit/b48ddef653d8f0b5cdc0ae34a3ee6c827fe97376))
* **ui:** currency placement + P2P market polish ([fbf81a5](https://github.com/888Greys/Neemiz/commit/fbf81a541d858b684458344ade3af9b86960cee8))
* **ui:** currency placement, P2P intro, Sell default, DiceBear avatars ([9338af1](https://github.com/888Greys/Neemiz/commit/9338af1db977d08af56f1ee1583f580480e3455e))
* **ui:** full-page market pickers and merchant center polish ([1d8a263](https://github.com/888Greys/Neemiz/commit/1d8a263cf295ab66b6d13590b6f6838850261342))
* **wallet,auth:** send step-up + Max, email OTP 2FA, profile entry ([f9432d6](https://github.com/888Greys/Neemiz/commit/f9432d6b5237f05655f9e961a4e10d43b700ebb1))
* **wallet,auth:** send step-up + Max, email OTP 2FA, profile entry ([ce39b6d](https://github.com/888Greys/Neemiz/commit/ce39b6dad054f566d51b034fe2e38989251594db))
* **wallet:** add display-currency picker on overview ([04ac1f3](https://github.com/888Greys/Neemiz/commit/04ac1f3c735f044c6e9b2e352489f413a31c980a))
* **wallet:** auto-select deposit country from IP geo ([3e1c0bd](https://github.com/888Greys/Neemiz/commit/3e1c0bd24a36689097fd2149fee4ae1654567019))
* **wallet:** combine crypto into USDT total on home ([5225f16](https://github.com/888Greys/Neemiz/commit/5225f16ba6caaee737d420fb093ba3eb6b2a0bf1))
* **wallet:** crypto withdraw asset picker as Nezeem bottom sheet with balances ([1513553](https://github.com/888Greys/Neemiz/commit/151355332f0ca787e09a3a9251037dd2bc1669d1))
* **wallet:** crypto withdraw coin sheet with balances ([b7035d4](https://github.com/888Greys/Neemiz/commit/b7035d4da5ce950373762f4d14c90885106b9c86))
* **wallet:** currency switcher on overview ([6c9ee44](https://github.com/888Greys/Neemiz/commit/6c9ee448ff77a0de83190480d8176fd27e46069c))
* **wallet:** list self-paying native cryptos as "coming soon" ([5374af1](https://github.com/888Greys/Neemiz/commit/5374af1a33da3422e179324e45337fd803df17c8))
* **wallet:** show combined crypto balance in USDT on home (Bybit-style) ([375ed64](https://github.com/888Greys/Neemiz/commit/375ed644626415b302e3e352e66d7022cf26b849))
* **wallet:** single Crypto deposit flow with logos and clearer errors ([0c181fc](https://github.com/888Greys/Neemiz/commit/0c181fc08cfe79fa5458a64093fe9496895020a5))


### Bug Fixes

* **auth:** default to 1 account per device ([8028ea3](https://github.com/888Greys/Neemiz/commit/8028ea373864a24a35747f47bbfe30e54898f307))
* **aviator,p2p:** speed cashout path and split Market/Fixed price UI ([5a36ea6](https://github.com/888Greys/Neemiz/commit/5a36ea6319f1a83999a0043b45cf7a262050c2d6))
* **aviator:** dim sunburst and align surfaces to wallet [#151518](https://github.com/888Greys/Neemiz/issues/151518) ([6e8bf50](https://github.com/888Greys/Neemiz/commit/6e8bf50d1dd9938d98fa7e8a0d653a663ad0c5b2))
* **aviator:** finish wallet-tone bet panel chips ([7ce68a6](https://github.com/888Greys/Neemiz/commit/7ce68a6248d45f01789d55b3f6b3059c411a72e0))
* **aviator:** lock mobile play surface with dual bet panels and players sheet ([5f0124d](https://github.com/888Greys/Neemiz/commit/5f0124dcdf1c0b0fb29da4d341be441a9d2cfdde))
* **aviator:** mobile layout polish ([97e5d7a](https://github.com/888Greys/Neemiz/commit/97e5d7a89c18a1018e7805097501a30f66d4d435))
* **aviator:** quieter sun + wallet surface colors ([c20d918](https://github.com/888Greys/Neemiz/commit/c20d918e4334e18add6fb874c4658ecef4ea10c7))
* **binary:** close R_50 digit Over/Under microstructure exploit + auto-trade kill-switch bypass ([810d913](https://github.com/888Greys/Neemiz/commit/810d9130ddc3521a9bfb4cce0aac986512d28f8b))
* **binary:** let live families place bets instead of 503 ([1a3c4a9](https://github.com/888Greys/Neemiz/commit/1a3c4a9e006bc0c56a361dc9904b319917a6890d))
* **binary:** settle digit contracts on deterministic exit tick ([1e61408](https://github.com/888Greys/Neemiz/commit/1e61408f0d3fba87d4af51972e57fa7e5b140605))
* **binary:** settle digit contracts on deterministic exit tick ([1d9183e](https://github.com/888Greys/Neemiz/commit/1d9183eed49d1ee55b5b01a974b13dbc771dcd37))
* **binary:** tighten live edge gaps from RTP autopsy ([3ccea0b](https://github.com/888Greys/Neemiz/commit/3ccea0b53d21487fa577715e0ebf6ffe88834410))
* **ci:** resolve sports-match-row cols typing and Odds API fetch cache options ([5538340](https://github.com/888Greys/Neemiz/commit/55383406ba50733ea9b48590fa05af1182bfb5e6))
* **ci:** update admin/new smoke test for AdminV2Cockpit ([3ce6b38](https://github.com/888Greys/Neemiz/commit/3ce6b389afacf7639b0efbfca671ef6ec4c98e64))
* **crypto:** BTC deposit notify + explorer fallback ([fdc0b3f](https://github.com/888Greys/Neemiz/commit/fdc0b3f08a4123d81c3f960343845556319c514c))
* **crypto:** BTC deposit notify + explorer fallback ([622dd77](https://github.com/888Greys/Neemiz/commit/622dd77599aca9c314e45dfd278f1ad29fd229a5))
* **crypto:** preserve negative deltas in on-chain reconcile ([73f67f3](https://github.com/888Greys/Neemiz/commit/73f67f3f678686213098ee0c66a0f4b3ff1c5172))
* **crypto:** require step-up + send email on crypto withdrawals ([0447452](https://github.com/888Greys/Neemiz/commit/044745281c92e814587311864ea4795122ee86b8))
* **crypto:** require step-up + send email on crypto withdrawals ([26e7e9a](https://github.com/888Greys/Neemiz/commit/26e7e9a37525cea0a272dee80dfe75b78dbe3e1f))
* **nav:** keep sports My Bets in section nav; expand Polymarket and Aviator tabs ([d8eca70](https://github.com/888Greys/Neemiz/commit/d8eca70ed7d9bb49a3958d040f33c8ddf727020c))
* **nav:** restore cool header wallet chip ([6a9c783](https://github.com/888Greys/Neemiz/commit/6a9c7833ba0e1da1570af06329fdd2829b7c9d81))
* **nav:** restore cool header wallet chip on mobile ([d522283](https://github.com/888Greys/Neemiz/commit/d522283a9c56e8b1f576b03559afe6e233e578af))
* **nav:** section bottom navs stay consistent on My Bets ([37994dc](https://github.com/888Greys/Neemiz/commit/37994dc6c2d77ee3918c53305fedc879bbb85133))
* **nav:** trim Explore to main products and drop wallet currency chip ([156880f](https://github.com/888Greys/Neemiz/commit/156880f6b2d6fc984b5a7b34810ae9ad65e02808))
* **p2p:** business avatars + real account photos ([51f3596](https://github.com/888Greys/Neemiz/commit/51f359625eb312982c06a17fb807cce4e24d7c85))
* **p2p:** business Personas avatars + Google/email profile photos ([cd4bbd5](https://github.com/888Greys/Neemiz/commit/cd4bbd5e6990054d837eef4c446e1d162da5c316))
* **p2p:** cleaner Payment Methods selection check ([d082e7a](https://github.com/888Greys/Neemiz/commit/d082e7a3707d8ff9138d3dc0b87e487b3d1383e4))
* **p2p:** full-page coin picker and world-country fiat list on ads ([315390b](https://github.com/888Greys/Neemiz/commit/315390b00de7318a38b42975a5faeebdb706a344))
* **p2p:** quieter escrow amount overflow hint on create ad ([86c29df](https://github.com/888Greys/Neemiz/commit/86c29df6bfc5edb5c200e9dbe5c4d8506125b110))
* **p2p:** read ads tab from URL without useSearchParams ([e92c76a](https://github.com/888Greys/Neemiz/commit/e92c76a97d2a60cd74b5e759f77d7c5581252b6f))
* **p2p:** replace blue payment-method checkbox with white check ([264a30b](https://github.com/888Greys/Neemiz/commit/264a30bd3211bac5c5b6736fbc09dfaccabff41a))
* **p2p:** strip orders empty-state marketing fluff ([4657725](https://github.com/888Greys/Neemiz/commit/4657725cef91a0c05f5860d1abc2bc8937a2f565))
* **p2p:** use MerchantAvatar in merchant center header ([0a9c77a](https://github.com/888Greys/Neemiz/commit/0a9c77a8911e67ab497fa0a7696f7d2821c40dfb))
* **p2p:** white check on order payment method pick ([a4c81bb](https://github.com/888Greys/Neemiz/commit/a4c81bb007edeb173d1ac8f0a51513b61a45ab19))
* **promo:** clear device-already-claimed notice ([dfa975b](https://github.com/888Greys/Neemiz/commit/dfa975bb42550a7c53fa6f6af547f534699e1070))
* **promo:** hard-block wallet transfers for anyone who redeemed a promo ([1abc765](https://github.com/888Greys/Neemiz/commit/1abc765f6106aabc8ec357e5d827f0036569178c))
* **promo:** lock promo credits from transfer/withdraw and list redeemers ([1741018](https://github.com/888Greys/Neemiz/commit/17410185cdbe93a9e46c424bd84a2dab7aeeda24))
* **promo:** set KIP100 and SILAS50 both to KSh 50 ([ead75ea](https://github.com/888Greys/Neemiz/commit/ead75eafa303b665f5402556c8e145c007891fac))
* **promo:** show clear error when device already claimed a promo ([220dd8b](https://github.com/888Greys/Neemiz/commit/220dd8bce349168d91238af4ce1ef88d6c3d25bc))
* **sports:** map list odds to cached market names so bets place ([c137bba](https://github.com/888Greys/Neemiz/commit/c137bbadfb8f9df652858d09958e367a3636ef16))
* **test:** stub promoRedemption + senderRow in wallet-transfer test ([a57d76f](https://github.com/888Greys/Neemiz/commit/a57d76f932449e7f1593e1643199ed93606f2c29))
* **ui:** icon-only header wallet and bottom-sheet search pickers ([742af77](https://github.com/888Greys/Neemiz/commit/742af77900702820f5b1a493904e5b85dd375ad0))
* **ui:** icon-only wallet header and bottom-sheet pickers ([0ddc92b](https://github.com/888Greys/Neemiz/commit/0ddc92b68259a7991f453779a5087419a22038a1))
* **ui:** lock Lucky Spin viewport; align P2P and Polymarket to wallet surfaces ([9bbeab7](https://github.com/888Greys/Neemiz/commit/9bbeab7da7dce0e1b484f6ab1b1d5c098a20f7e8))
* **ui:** Lucky Spin no-scroll + P2P/Polymarket wallet surfaces ([3f54a7b](https://github.com/888Greys/Neemiz/commit/3f54a7bb26fc0b0bcfb7561019f7797b80b345ff))
* **wallet:** raise admin transfer daily cap to 200k and align tests ([4f614bd](https://github.com/888Greys/Neemiz/commit/4f614bd72de9e8566060e00f5f4cd721dc64388e))
* **wallet:** scrollable compact world country picker ([4ece604](https://github.com/888Greys/Neemiz/commit/4ece604952cc564fdd6a663bb8f5320bf153e80a))
* **wallet:** sticky Continue on payment method step ([37e5d9e](https://github.com/888Greys/Neemiz/commit/37e5d9eed2556c43e7cd8bf7cacc6c6fb48d0cf0))

## [1.8.0](https://github.com/888Greys/Neemiz/compare/v1.7.0...v1.8.0) (2026-07-08)


### Features

* **admin:** add new console preview ([#231](https://github.com/888Greys/Neemiz/issues/231)) ([b2713ab](https://github.com/888Greys/Neemiz/commit/b2713abd5d519f403366e5e0744b4054e3d8658a))
* **admin:** prioritize today's operations overview ([#82](https://github.com/888Greys/Neemiz/issues/82)) ([60a253b](https://github.com/888Greys/Neemiz/commit/60a253bf9658171af66f012266a3d1528ca295aa))
* **auth:** disable 1-hour idle auto-logout ([487d8e0](https://github.com/888Greys/Neemiz/commit/487d8e0b8ea31e7924c98dbfaae199a3cbf92467))
* **auth:** phone OTP verification at registration via Twilio Verify ([#136](https://github.com/888Greys/Neemiz/issues/136)) ([dfd8e75](https://github.com/888Greys/Neemiz/commit/dfd8e75ff98ba4e95dc69e64d40d23ae36347b99))
* **binary:** constrain barrier contracts to a fair band (no rigged 50x lottery tickets) ([#214](https://github.com/888Greys/Neemiz/issues/214)) ([9b9458d](https://github.com/888Greys/Neemiz/commit/9b9458d5b6e1a4628e50d9b269b1052352dcbd8b))
* **binary:** data-driven per-symbol house edge ([e2329ed](https://github.com/888Greys/Neemiz/commit/e2329ede4824027616737a9091418fe571b23f00))
* **binary:** data-driven per-symbol house edge for directional ([db9982c](https://github.com/888Greys/Neemiz/commit/db9982c49d72ddcc41c44edb30f03f3fa2d2fe38))
* **binary:** exploit-proof pricing engine (nonparametric, proven RTP ≤ 1) ([1e39f0a](https://github.com/888Greys/Neemiz/commit/1e39f0af511ca8114d29eacedc4cc1532e1ac451))
* **binary:** expose directional fairness verification ([b7301a2](https://github.com/888Greys/Neemiz/commit/b7301a2b881b31f4cd527fe18f82eef12b06b6fd))
* **binary:** expose directional fairness verification ([b95df4b](https://github.com/888Greys/Neemiz/commit/b95df4b1deb70bbbe56eb245bb84a51c2ded1892))
* **binary:** foundation for exploit-proof pricing (settlement kernel + fairness gate) ([f904fb2](https://github.com/888Greys/Neemiz/commit/f904fb2081ff9b28fda5e00e9f8201da26a74d82))
* **binary:** provably-fair directional (commit-reveal + signed quotes) + verifier + dev doc ([4889159](https://github.com/888Greys/Neemiz/commit/4889159eec7acfa88c2d7e651c0a5ba1248324af))
* **binary:** provably-fair directional + verifier + developer doc ([e520574](https://github.com/888Greys/Neemiz/commit/e520574dc160f15170984d73403e694dc1c8719f))
* **binary:** rebuild Digits category on Monte Carlo pricing engine ([8290936](https://github.com/888Greys/Neemiz/commit/82909366eb4cda584b7bab979d4ed6745f265206))
* **binary:** rebuild Digits category on Monte Carlo pricing engine ([0ef0ec4](https://github.com/888Greys/Neemiz/commit/0ef0ec41c5829ebfcdde3cc1ce50c274a77388c0))
* **binary:** runtime RTP guard — auto-halt a contract kind that bleeds ([e5db271](https://github.com/888Greys/Neemiz/commit/e5db271bbe46e29ba685256c5b686727b195f636))
* **binary:** take binary-options suite offline for pricing rebuild ([28ad6be](https://github.com/888Greys/Neemiz/commit/28ad6becde8eb7bcccebfdeeb6b27b9c089cc697))
* **binary:** take entire binary-options suite offline for pricing rebuild ([adc4214](https://github.com/888Greys/Neemiz/commit/adc42146bce210b3f0ca08fdb66bf47d09da7575))
* **binary:** wire directional route to engine pricing (steps 4–5, off by default) ([27ce01c](https://github.com/888Greys/Neemiz/commit/27ce01cffade8762fb772ffb7a57d30a8acd6d1a))
* **deposit:** pre-generate crypto deposit address + QR (Binance-style, no spinner) ([#224](https://github.com/888Greys/Neemiz/issues/224)) ([67d271b](https://github.com/888Greys/Neemiz/commit/67d271b17f3fd9051a65a8b660be9f843f5cdcac))
* **deposits:** two-stage crypto deposit notifications (detected + credited) ([#221](https://github.com/888Greys/Neemiz/issues/221)) ([dfdd787](https://github.com/888Greys/Neemiz/commit/dfdd78737a4e0421a63117703226a7ce20338e82))
* **p2p:** disable P2P for goodhope + one-payout-per-number applies to admins ([87f4795](https://github.com/888Greys/Neemiz/commit/87f47953b303390a71026e4ee096b35c6f2c02e1))
* **p2p:** emphasize trade trust over margins ([#81](https://github.com/888Greys/Neemiz/issues/81)) ([8a434b5](https://github.com/888Greys/Neemiz/commit/8a434b5e4a2a36025a1d6bdb4575a58a38e2754f))
* **p2p:** per-user P2P block + apply one-payout-per-number rule to admins ([65f7bc6](https://github.com/888Greys/Neemiz/commit/65f7bc6cc6e670905b2b5f2c6356a78133f826b8))
* **passkey:** use one passkey for both sign-in and withdrawals ([#229](https://github.com/888Greys/Neemiz/issues/229)) ([be1d741](https://github.com/888Greys/Neemiz/commit/be1d741cb58622ca137bb77f1a227df08d153265))
* **risk:** mule hold-for-review + admin transfer cap ([c2d2bf5](https://github.com/888Greys/Neemiz/commit/c2d2bf53ddf8fd7bcd13e42782ab46813cbef3b6))
* **risk:** mule-flag hold-for-review + admin transfer cap; simplify transfer limits ([fa39f6a](https://github.com/888Greys/Neemiz/commit/fa39f6a9baf5a5bab33611868fb10a339c7d26e5))
* **risk:** Telegram alerts for RTP guard breach + periodic health digest ([#213](https://github.com/888Greys/Neemiz/issues/213)) ([e171f34](https://github.com/888Greys/Neemiz/commit/e171f349fc7c0603d6aea5f88b873792c8af1e7d))
* **transfer:** admin can send to a recipient only ONCE, ever ([#228](https://github.com/888Greys/Neemiz/issues/228)) ([6697423](https://github.com/888Greys/Neemiz/commit/66974230de718c5d666c8ea8ec9bf18acdd63d8f))
* **wallet+forex:** funding wallet, real-icon single-select deposit flow, Discover coming-soon ([#215](https://github.com/888Greys/Neemiz/issues/215)) ([6435fae](https://github.com/888Greys/Neemiz/commit/6435fae4bb570cffd6f4ab4653f3692f4de0796c))
* **wallet:** bonus balance + admin daily transfer cap ([#225](https://github.com/888Greys/Neemiz/issues/225)) ([ad3f106](https://github.com/888Greys/Neemiz/commit/ad3f106ff6a295068b3a8036209d47850a4b0822))
* **wallet:** cap Pesapal card deposits at KSh 50 (test mode) ([#188](https://github.com/888Greys/Neemiz/issues/188)) ([20d58e1](https://github.com/888Greys/Neemiz/commit/20d58e155d290a228c1924971dd5e979d08d5768))
* **wallet:** card & international deposits via Pesapal ([#187](https://github.com/888Greys/Neemiz/issues/187)) ([fbbab8d](https://github.com/888Greys/Neemiz/commit/fbbab8dabade549430f097468632ef6fe6451472))
* **wallet:** crypto deposit minimums to 1; remove testing withdrawal-fee note ([#220](https://github.com/888Greys/Neemiz/issues/220)) ([1a13a71](https://github.com/888Greys/Neemiz/commit/1a13a715c0e672ff576e29a72fbc5153b291c236))
* **wallet:** enforce max KSh 50 per transfer and once-per-day limit for admins ([18a4e3e](https://github.com/888Greys/Neemiz/commit/18a4e3eb422ff9c481994c85a6ae13f34026c27a))
* **wallet:** enforce max KSh 50 per transfer and once-per-day limit for admins ([25f0f83](https://github.com/888Greys/Neemiz/commit/25f0f8344c384d80b6e901611524c7b937978ac4))
* **wallet:** format once-per-day admin limit error as a beautiful info alert ([cbf8339](https://github.com/888Greys/Neemiz/commit/cbf8339044f2ad55aeba0d650040a162eee7d2f5))
* **wallet:** SMS-gated withdrawals bound to one number + reliable Pesapal crediting ([#190](https://github.com/888Greys/Neemiz/issues/190)) ([e01e22a](https://github.com/888Greys/Neemiz/commit/e01e22ae2594de60d118abd6b494d59e8a2d5bb5))
* wire live families UI gating to allowlist for directional binary rebuild ([355e42e](https://github.com/888Greys/Neemiz/commit/355e42ed6d123d04632514fb1947cdee0b1248f1))
* **withdraw:** bind & lock the M-Pesa number WITHOUT requiring Twilio ([1a38798](https://github.com/888Greys/Neemiz/commit/1a38798a8f93ca516d10be0e164b187538c63bdd))
* **withdraw:** bind & lock the withdrawal number without Twilio ([c9ff34a](https://github.com/888Greys/Neemiz/commit/c9ff34a006d267b4f587078d2ab92502de818c39))
* **withdraw:** lock the withdrawal M-Pesa number once set ([3cc8b77](https://github.com/888Greys/Neemiz/commit/3cc8b775aed98ad74a7debd789c4041d35472d4d))
* **withdraw:** lock the withdrawal number once set ([f2ec0fa](https://github.com/888Greys/Neemiz/commit/f2ec0fa20f9b3c5f37b0d4d8da18dcd2c9573a38))
* **withdraw:** remove once-per-number rule (daily limit + locked number cover it) ([5cb13a9](https://github.com/888Greys/Neemiz/commit/5cb13a9c776122e6cc5fba2cc2f15b77654bd263))
* **withdraw:** remove the once-per-number rule (daily limit + locked number cover it) ([b3974ad](https://github.com/888Greys/Neemiz/commit/b3974ad6858ffc55e291819fcf1cb3b7da8a7524))
* **withdraw:** server-side step-up + whole-KES payout fix ([#230](https://github.com/888Greys/Neemiz/issues/230)) ([a5d1ac8](https://github.com/888Greys/Neemiz/commit/a5d1ac8040ea9500aea4f04920a12b5ac39b1b6b))


### Bug Fixes

* **auth:** stop oversized/stale cookies breaking GoTrue calls ([#227](https://github.com/888Greys/Neemiz/issues/227)) ([79f0be1](https://github.com/888Greys/Neemiz/commit/79f0be12b8fec60a0cbe42c216be4ceb31c5c6fb))
* **binary:** adjust edge floors and max win prob caps for high-probability digits contracts (Differs, Under 9, Over 0) ([15978dd](https://github.com/888Greys/Neemiz/commit/15978dd138685e13a4b02fea2e1876e8f5b97ad3))
* **binary:** fresh live entry spot + lower RTP alert threshold ([9ba64c9](https://github.com/888Greys/Neemiz/commit/9ba64c9f449cccd3f43bb83821b0220f936dea54))
* **binary:** fresh live entry spot for directional + lower RTP alert threshold ([350d799](https://github.com/888Greys/Neemiz/commit/350d799a5fd6f15c0c93b135a1850ff95fb00f4b))
* **binary:** stabilize digit button pricing and bounds ([1083ba2](https://github.com/888Greys/Neemiz/commit/1083ba25484ad53411c345c25e7123ffd563a51a))
* **crypto-withdraw:** clean JSON error instead of "Unexpected token '&lt;'" ([#222](https://github.com/888Greys/Neemiz/issues/222)) ([3fbcdb8](https://github.com/888Greys/Neemiz/commit/3fbcdb843b958a0e8582664c335f035b777d4ea1))
* **icons:** map credit_card + science (Card deposit showed a "?") ([#189](https://github.com/888Greys/Neemiz/issues/189)) ([d1e9d98](https://github.com/888Greys/Neemiz/commit/d1e9d98af894989f9c7d52223203a36294f1cff3))
* **icons:** replace question-mark icons on Discover (unmapped Material names) ([#217](https://github.com/888Greys/Neemiz/issues/217)) ([9c9a7fd](https://github.com/888Greys/Neemiz/commit/9c9a7fdb8a2a01e7ca464d77e2a8cb0c0e8ce841))
* **mobile-nav:** map keyboard_arrow_up, shrink close X & Support tile ([#193](https://github.com/888Greys/Neemiz/issues/193)) ([5326f6c](https://github.com/888Greys/Neemiz/commit/5326f6cd97fa8a8026b016ce985b678061167fb5))
* **nav:** add Polymarket to the mobile drawer menu ([#192](https://github.com/888Greys/Neemiz/issues/192)) ([bf6c850](https://github.com/888Greys/Neemiz/commit/bf6c850f7e59794a2d0f5ed06adef2906fef37aa))
* **pesapal:** redirect return to public base URL, not internal host ([#191](https://github.com/888Greys/Neemiz/issues/191)) ([2d7d8c6](https://github.com/888Greys/Neemiz/commit/2d7d8c60be2afec5e2a63200002ff4969c6f3780))
* **suspend:** reassuring under-review copy instead of harsh 'suspended' ([#194](https://github.com/888Greys/Neemiz/issues/194)) ([eb40dd2](https://github.com/888Greys/Neemiz/commit/eb40dd21fb67b396947fb9ba812378c6b8ef71a9))
* **wallet:** lock the withdraw number field in the UI once bound (no Twilio needed) ([5896c4f](https://github.com/888Greys/Neemiz/commit/5896c4f7fa3edfc23574960c9309afacac420780))
* **wallet:** lock withdraw number field in UI once bound (no Twilio) ([5f991be](https://github.com/888Greys/Neemiz/commit/5f991beeb7e71af67b7583326d38328acff09fee))
* **wallet:** open the wallet overview (home), not Deposit, from the wallet icon ([#223](https://github.com/888Greys/Neemiz/issues/223)) ([3e0d38e](https://github.com/888Greys/Neemiz/commit/3e0d38ec35b587b3571138439681aa0884688ca6))


### Security

* **admin:** alert the owner the moment an is_admin flag flips ([8529d8a](https://github.com/888Greys/Neemiz/commit/8529d8af4e281265a599e937035b90536bcd5d37))
* **admin:** enforce owner allowlist on every admin route (requireOwnerAdmin) ([f43b7bf](https://github.com/888Greys/Neemiz/commit/f43b7bf912924b5ab43d5f071a107df6803aa1e9))

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
