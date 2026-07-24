# Changelog

All notable changes to Neemiz are documented here. From v1.0.0 onward this file
is maintained automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/).

## [1.11.0](https://github.com/888Greys/Neemiz/compare/v1.10.0...v1.11.0) (2026-07-24)


### Features

* add nezeem binary admin panel with money/trade metrics ([f953791](https://github.com/888Greys/Neemiz/commit/f953791dc6416f9b01f7e00f93dbb9b465a39710))
* **admin:** add MoneyBinary metrics and yesterday period filter to Binary brands panel ([3095a32](https://github.com/888Greys/Neemiz/commit/3095a329061ccdacdb2e9969529fa503b0392661))
* **admin:** add MoneyBinary metrics and yesterday period filter to Binary brands panel ([1dbecb3](https://github.com/888Greys/Neemiz/commit/1dbecb315f3b4b2eba04594baf0b0b72e29962bf))
* **binary & wallet:** expand binary tick history to 350 ticks & expand live EVM crypto deposit/withdraw rails ([499d583](https://github.com/888Greys/Neemiz/commit/499d583f10c76c0b4fac897157be06d5837d6667))
* **binary:** add QuickBinary sister brand support ([5b90d66](https://github.com/888Greys/Neemiz/commit/5b90d666977570e1dd6249cd1f4688b31304755a))
* **binary:** increase tick history to 1 hour (3,600 ticks) ([e0ac6d1](https://github.com/888Greys/Neemiz/commit/e0ac6d127a91d010391d1c418bf82d18adbfb1ae))
* **binarymarket:** per-brand trader theme, fix logo split ([326ec73](https://github.com/888Greys/Neemiz/commit/326ec73c35f0196f11e6ea8ffc05c79b7a5aacb3))
* **binarymarket:** rename quickbinaryke → binarymarket, add unique landing page ([e8a5ec4](https://github.com/888Greys/Neemiz/commit/e8a5ec4bfe5a19f25d03bc3bee06d3b1b495c381))
* **binary:** shared Deriv relay to reduce WebSocket connections ([2eda2c3](https://github.com/888Greys/Neemiz/commit/2eda2c3a8a0c4bd0abba65ebd649bf929b3a04d1))
* **crypto:** Etherscan-free native EVM deposits (balance-diff backstop) ([31381b0](https://github.com/888Greys/Neemiz/commit/31381b01f9dc38d4a76d7b66785eff33ec7ed715))
* **moneybinary:** light grey terminal theme matching landing page ([b1d27c8](https://github.com/888Greys/Neemiz/commit/b1d27c8bd5fc06d2dbad73ba013326010c1d20c0))
* per-brand in-app themes — MoneyBinary + BinaryMarket auth/trader ([835f648](https://github.com/888Greys/Neemiz/commit/835f648bba32cdafa2c099ab5bb78b07bf2933a9))
* **quickbinary:** swap domain from quickbinaryke.com to binarymarket.org ([d59568a](https://github.com/888Greys/Neemiz/commit/d59568aa4d345aee1edf6b1449f9eed4ecd1bd84))
* **retail:** implement Retail/Physical Shop Aviator system (TV spectator view, cashier POS terminal, thermal receipts, & cash payout ledger) ([c64b4a6](https://github.com/888Greys/Neemiz/commit/c64b4a6ed1e5086ddd6953d0d01667c955cc781f))
* **sister:** add AlphaOptionsKE binary brand (purple + gold) ([6b62019](https://github.com/888Greys/Neemiz/commit/6b62019bce31682e238b011f64d7bcf78d4b4aaf))
* **wallet:** bump first deposit bonus from 25% to 50% ([6e373e7](https://github.com/888Greys/Neemiz/commit/6e373e72cc2aa6f952dbe313c802b43ccc507e65))
* **wallet:** limit non-admin users to one transfer ever ([afeb57d](https://github.com/888Greys/Neemiz/commit/afeb57dd5ffb6adc9f8eb7808e296196612f9ae1))


### Bug Fixes

* align deposit minimum to KSh 50, harden deploy for SSH drops ([732d899](https://github.com/888Greys/Neemiz/commit/732d899d4e7d3429f0c2802b703211f69d794f56))
* **alphaoptionske:** brand theme, admin metrics, and favicon ([af88c03](https://github.com/888Greys/Neemiz/commit/af88c034faf8dfcf21d80d1ce7cb14bd710604ee))
* **alphaoptionske:** escape apostrophe in landing copy ([845e998](https://github.com/888Greys/Neemiz/commit/845e998dc0f4d7ddafb364a47d0c5d4f66f8cd1f))
* **aviator:** auto-bet always cashes out at the configured multiplier ([406fa9f](https://github.com/888Greys/Neemiz/commit/406fa9f2866db60ad7120ec2f9ba0e0c865e9f46))
* **binary:** allow directional/leveraged/accumulator APIs on sister brands ([757301b](https://github.com/888Greys/Neemiz/commit/757301b8b5fb11c5cb8d9de08014cb29bc8d862e))
* **binary:** expose auto-trader on mobile ([c678939](https://github.com/888Greys/Neemiz/commit/c6789392c542b89b4a393d5cc6ad5ba0e04e4c3a))
* **binarymarket:** fix remaining CSS class and text references ([4cedcac](https://github.com/888Greys/Neemiz/commit/4cedcac8ee88e1e4c9249f68ced225640978ff9b))
* **binarymarket:** rename user-facing QuickBinary → BinaryMarket ([3b7cce7](https://github.com/888Greys/Neemiz/commit/3b7cce79f2748f8e79a7574bb4ff607d28ca00c9))
* **binary:** price Differs conditionally on entry digit ([3b3cfac](https://github.com/888Greys/Neemiz/commit/3b3cfac2f0bee08d951ae9e23ed9befb4090b2f1))
* **binary:** relay fallback instead of throw; lower calibration floor ([8a29096](https://github.com/888Greys/Neemiz/commit/8a29096e911c2fb78ebebe3449d1b945540348e1))
* **binary:** remove collapsed rail column on desktop, give chart full width ([e354925](https://github.com/888Greys/Neemiz/commit/e354925f4e5fbfea7473394f0e7bd878b64e839d))
* **binary:** remove min-height cap on chart for large screens ([9c7ddc8](https://github.com/888Greys/Neemiz/commit/9c7ddc89941655f1b1414ea7a6da23e9da4dfc47))
* **binary:** show toast for calm digit rejections instead of silent swallow ([d8be3ba](https://github.com/888Greys/Neemiz/commit/d8be3ba7d1b36e7c4834e098838e20b15406c2f6))
* **binary:** use Deriv public options feed for live chart ticks ([e220f32](https://github.com/888Greys/Neemiz/commit/e220f32ab28951c12a7ef227bfb7ef58601498ca))
* **crypto:** detect EVM token deposits via public RPC, not Etherscan ([28a6514](https://github.com/888Greys/Neemiz/commit/28a65149a50d7d41e446687be39bc201529af138))
* **crypto:** don't claw back Tron deposits on flaky TronGrid reads ([5680ab6](https://github.com/888Greys/Neemiz/commit/5680ab6f1de6c59c716195a4c5441cd3ef810cf8))
* **crypto:** reconcile must not claw back non-deposit balances ([7478eb8](https://github.com/888Greys/Neemiz/commit/7478eb824fdfa8209c45ec6f9e40528218edf47f))
* **db:** cache Prisma client on global in production too ([c6dd1de](https://github.com/888Greys/Neemiz/commit/c6dd1de40ce92508424ff93cd3495cd0710a6150))
* **favicon:** make Nezeem "n" heavier (fontWeight 900) ([c4816f2](https://github.com/888Greys/Neemiz/commit/c4816f2c6be4e9359b4dfb7b4f4b9867e4a49be7))
* **moneybinary:** dark grey terminal theme ([#1](https://github.com/888Greys/Neemiz/issues/1)a1d23) with green accent ([2c55f48](https://github.com/888Greys/Neemiz/commit/2c55f489e8d1fa538291f295b27da3772a2d70c6))
* **p2p:** harden escrow flow after fake mark-paid ring ([78a66cd](https://github.com/888Greys/Neemiz/commit/78a66cd23dc320b8aec70882d52f5b5481d36f03))
* **p2p:** loosen ring-detection db type to a structural interface (CI typecheck) ([58636ac](https://github.com/888Greys/Neemiz/commit/58636acb152050b0d96946a0994165569b67c376))
* **p2p:** method-syntax typo in RingDetectionDb interface ([9597519](https://github.com/888Greys/Neemiz/commit/9597519151446a3b428ccca9c075546e504e370f))
* **p2p:** use isWalletBackedCoin in expired-order handler for multi-currency support ([d5cdc85](https://github.com/888Greys/Neemiz/commit/d5cdc85526fff2414b67caa99eb143d26b82a6e5))
* **shop:** fix AviatorRoundState enum value in ticket place route ([6b0f087](https://github.com/888Greys/Neemiz/commit/6b0f087772e263f6a4d9801f2ea07018276e9e7f))
* sister crypto deposits (allow /api/crypto) + P2P payment-ref UX ([d927947](https://github.com/888Greys/Neemiz/commit/d92794721a3a6636790a2dfb8b8ff5ddf72f224e))
* **surface:** never treat nezeem.com hosts as the binary surface ([50f6133](https://github.com/888Greys/Neemiz/commit/50f613397987a77b456521a6eeddbccb35cdc59b))
* **wallet:** change min deposit from KSh 645 ($5) to KSh 200 ([09dd80c](https://github.com/888Greys/Neemiz/commit/09dd80cc50527df87a1373ecdbf90bce56a44b4c))
* **wallet:** lower min deposit to KSh 75, raise min withdrawal to KSh 200 ([66e3fc6](https://github.com/888Greys/Neemiz/commit/66e3fc6bc29766b4328237c23c04b37979b37a1b))
* **wallet:** lower minimum deposit to KSh 50 ([43f702a](https://github.com/888Greys/Neemiz/commit/43f702a61de6b350994a495222dff8778f2ed3c0))
* **wallet:** update minimum deposit to $5 (645 KES) ([b5efefc](https://github.com/888Greys/Neemiz/commit/b5efefcbb85c20de47446ff97ea0762610f92176))

## [1.10.0](https://github.com/888Greys/Neemiz/compare/v1.9.2...v1.10.0) (2026-07-20)


### Features

* **admin:** "Today" tab — deposits + withdrawals at a glance ([#320](https://github.com/888Greys/Neemiz/issues/320)) ([8ed18e4](https://github.com/888Greys/Neemiz/commit/8ed18e4ff3adbf40af02b130b421c1226d97091b))
* **admin/promo:** show promo users' deposit & withdrawal activity + code summary ([#309](https://github.com/888Greys/Neemiz/issues/309)) ([62b7136](https://github.com/888Greys/Neemiz/commit/62b71366d6769a5cd394a4624374f962f30ca686))
* **admin:** 7-day cashflow page — deposits vs withdrawals from the ledger ([17fb224](https://github.com/888Greys/Neemiz/commit/17fb224166a0568c8d2397efcc35454eee08e384))
* **admin:** add deposit addresses register page to new console ([16ac63c](https://github.com/888Greys/Neemiz/commit/16ac63cfaea072dece9e8531132ab585acc3ca09))
* **admin:** add House gaming revenue (GGR) hero to money cockpit ([917ba1c](https://github.com/888Greys/Neemiz/commit/917ba1c548d1684d839767033c908e01c2558c7b))
* **admin:** add P2P backing diagnostic page for local-coin sell ads ([8422812](https://github.com/888Greys/Neemiz/commit/84228123e7a6cfed484aca8cb82b95d9ba9bfdae))
* **admin:** add system-wide crypto balances diagnostic page and endpoint ([2b4b2b8](https://github.com/888Greys/Neemiz/commit/2b4b2b86fb5f0ea6118d1f3e3129fab8307a9df2))
* **admin:** date-range filter on Players overview ([f1d4a27](https://github.com/888Greys/Neemiz/commit/f1d4a27b0fee49e3e7a33c9c879fe0f6ee0f1f4e))
* **admin:** email one-time code as 2FA login fallback ([0e62e69](https://github.com/888Greys/Neemiz/commit/0e62e696136f1b87052ce9285ce6a964e3591ddd))
* **admin:** expose KES Coin in the grant coin admin dropdown ([401b7d9](https://github.com/888Greys/Neemiz/commit/401b7d9847962dd08c53c0f7a006d006d5fd8332))
* **admin:** fold Action Queue into Ops Overview ([6a6d473](https://github.com/888Greys/Neemiz/commit/6a6d4735b456e6449bd314d8426e2d39d9af4bb1))
* **admin:** fold crypto treasury into Money → Treasury tab ([8dafd70](https://github.com/888Greys/Neemiz/commit/8dafd707c4c67f7af5bf7f9a914eedfea6516c46))
* **admin:** fold deposit-address register into Money → Treasury ([38b3923](https://github.com/888Greys/Neemiz/commit/38b39231cb7f0c0ab8ff1844befa84e8415d842b))
* **admin:** grant in-app local coins from the P2P console ([d980956](https://github.com/888Greys/Neemiz/commit/d9809568e2f1d703c83dba727965badc8c8152cb))
* **admin:** lean 5-page IA + Liability page ([50fd007](https://github.com/888Greys/Neemiz/commit/50fd0072e4e0df38744f64fae41e094c2e913a33))
* **admin:** lifetime deposits-by-provider + in/out totals on Lipa audit ([02e28e9](https://github.com/888Greys/Neemiz/commit/02e28e924a7823bcbd51430518223c138c6b36dd))
* **admin:** Lipa deposit recovery tool (Ops → Lipa recovery) ([65af3f6](https://github.com/888Greys/Neemiz/commit/65af3f67523de702e78127fbaa5fbd731a888e0e))
* **admin:** money cockpit — real cash truth at a glance ([2fb73dc](https://github.com/888Greys/Neemiz/commit/2fb73dcf7781ac392c1f27a4aad64edc01c87567))
* **admin:** move crypto balances view into the new console ([fb3caaa](https://github.com/888Greys/Neemiz/commit/fb3caaa3105e3fbab34d0738e69d384de89012d0))
* **admin:** owner-admin grant-coin endpoint for in-app local coins ([06538be](https://github.com/888Greys/Neemiz/commit/06538be9922f691c1bc6ba593be6ea28c4ce6b0c))
* **admin:** per-market GGR breakdown on Money, linking to market detail ([42d42ab](https://github.com/888Greys/Neemiz/commit/42d42ab21344ffc865c0bfecf96a0574e803eade))
* **admin:** rebuild Money page — global date filter + money-route tabs ([8a2a744](https://github.com/888Greys/Neemiz/commit/8a2a74463ba16ab9abd5829069d49b50e5556d42))
* **admin:** redesign player audit with activity charts ([db0b458](https://github.com/888Greys/Neemiz/commit/db0b4587a90f051e556513a99f56b46d772aa4c5))
* **admin:** retire old money + lipa-audit pages; land console on Money ([be1f29e](https://github.com/888Greys/Neemiz/commit/be1f29e730aa8a937dfc9c34c508c19b83e85ed6))
* **admin:** support KES in admin grant-coin API route ([02b5707](https://github.com/888Greys/Neemiz/commit/02b57077ffa4b81d84750d481117d75e3e5c4e93))
* **admin:** surface Lipa webhook auth status; document real signing scheme ([34c578a](https://github.com/888Greys/Neemiz/commit/34c578a1c712144572f88dff6a9c2f6394f8a53d))
* **admin:** toggle per-user P2P access from the console ([933077b](https://github.com/888Greys/Neemiz/commit/933077be627e24a64976e10571b182a9c58f0ea7))
* **admin:** unified Ops hub — overview, withdrawals, P2P, broadcast tabs ([1748e5b](https://github.com/888Greys/Neemiz/commit/1748e5bfd4870d30949e711ae8d58a73aa510a16))
* **auth:** Google sign-ups get a 'verified' confirmation + hard phone gate ([#312](https://github.com/888Greys/Neemiz/issues/312)) ([3407c70](https://github.com/888Greys/Neemiz/commit/3407c70d93592137618ffb97ecff489d0288600f))
* **aviator+ui:** plane/bets polish, dark-pill toasts, instant trade feedback ([#306](https://github.com/888Greys/Neemiz/issues/306)) ([5c0a120](https://github.com/888Greys/Neemiz/commit/5c0a120af8f8b9d07baac256db9ccfb735b06303))
* **aviator:** pause background music when the tab/app is backgrounded ([#314](https://github.com/888Greys/Neemiz/issues/314)) ([c9f2ba8](https://github.com/888Greys/Neemiz/commit/c9f2ba8dbb2db6547915fdf1eb392e8d147dd989))
* **aviator:** remove the big win-celebration overlay on cashout ([#307](https://github.com/888Greys/Neemiz/issues/307)) ([e082923](https://github.com/888Greys/Neemiz/commit/e082923abba98df8a186709fe7f93df3aeb98e5d))
* **aviator:** Spribe-style compact bet cards + forex-matching bottom nav ([5036077](https://github.com/888Greys/Neemiz/commit/5036077223001caf3b08214d91715441bc7eb569))
* **aviator:** Spribe-style mobile UI + fix stale live-match badge ([#304](https://github.com/888Greys/Neemiz/issues/304)) ([c9a8154](https://github.com/888Greys/Neemiz/commit/c9a81540b52c1ef993499b90a8b437c2c67090a2))
* **binary-ke:** add Olymp-style marketing landing at / ([ed718c1](https://github.com/888Greys/Neemiz/commit/ed718c1361138a1f164d94b17b170f587ee8651d))
* **binary-ke:** lime brand mark, copy panel, and auto allowlist ([2a5f5ff](https://github.com/888Greys/Neemiz/commit/2a5f5ff973e3b1758f1a311393c6ba5a41b3dbbb))
* **binary-ke:** lime theme for mobile sidebar and Payments sheet ([a7d5a30](https://github.com/888Greys/Neemiz/commit/a7d5a30572a531ac1480d74b34ceaf6c7dd42038))
* **binary-ke:** lime/yellow trading chrome on binary surface ([64317c8](https://github.com/888Greys/Neemiz/commit/64317c85097f91b55b8c3f6e772420ae2e1cc9de))
* **binary,forex:** play in USD with a $1 minimum stake ([621b6d9](https://github.com/888Greys/Neemiz/commit/621b6d9441380cfa13f033ed16bf5a7e9d9a69b0))
* **binary:** add MoneyBinary sister brand support ([f4b1db8](https://github.com/888Greys/Neemiz/commit/f4b1db8bc34a0f3450f7263d3202a1ee50192a30))
* **binary:** add opt-in copy trading MVP ([7792d8a](https://github.com/888Greys/Neemiz/commit/7792d8a10f89e0790560475c65e103ec2094c5c2))
* **binary:** BinaryKE wordmark, top trade nav, surface favicons ([5698336](https://github.com/888Greys/Neemiz/commit/569833686f5899d9d6076b2ab6208be1aec27f08))
* **binary:** Nezeem ops page, dual Lipa webhook, brand-safe auth/mail ([356e3af](https://github.com/888Greys/Neemiz/commit/356e3af2bd71892f803724264a4890b7d129fc6a))
* **binary:** opt-in copy trading MVP ([e47267e](https://github.com/888Greys/Neemiz/commit/e47267e60c8f22012c91993bb5b4f240cffaebf6))
* **binary:** PRODUCT_SURFACE for binaryoptionske.com ([8395fbd](https://github.com/888Greys/Neemiz/commit/8395fbd519856b1677c4faa2b5d4ced8f8ccf3c0))
* **binary:** re-enable engine-priced contract families ([451f5f1](https://github.com/888Greys/Neemiz/commit/451f5f14b7a5d6f0637caa1e8d07f207a2d2d521))
* **binary:** remove suite-wide maintenance gate ([0347264](https://github.com/888Greys/Neemiz/commit/03472642e812cca8e784d2cd7ce71b63a8bf404b))
* **bonus:** 50% play-only first-deposit bonus ([#318](https://github.com/888Greys/Neemiz/issues/318)) ([501b081](https://github.com/888Greys/Neemiz/commit/501b08110dedc12dddc8bdb0aa52314fb1bcdfaf))
* **charts:** shared live chart engine for Forex + Binary (parity) ([#325](https://github.com/888Greys/Neemiz/issues/325)) ([4c49392](https://github.com/888Greys/Neemiz/commit/4c493924eb69198b72a0933ebab357a47f128cfd))
* **deposits:** throttle repeated M-Pesa STK pushes to stop prompt spam ([#317](https://github.com/888Greys/Neemiz/issues/317)) ([8b68f18](https://github.com/888Greys/Neemiz/commit/8b68f18fed5a87a03a82e4d3d77697923f75f3f0))
* **email:** dynamic email branding for BinaryOptionsKE and Nezeem ([a2cf18e](https://github.com/888Greys/Neemiz/commit/a2cf18e7dc51be3823064d0b3cca5ee00e451782))
* **forex:** chart-type picker + cleaner default zoom ([#322](https://github.com/888Greys/Neemiz/issues/322)) ([0cc833c](https://github.com/888Greys/Neemiz/commit/0cc833ceae593b38c2f2ca12bb6e3a6230fbc936))
* **forex:** immersive FX-Pro mobile trade surface ([0f67da4](https://github.com/888Greys/Neemiz/commit/0f67da4dcd94133fce7df26901f3b6557c62d8cf))
* **forex:** immersive FX-Pro mobile trade surface ([63cbdf8](https://github.com/888Greys/Neemiz/commit/63cbdf860d2680560d90a45efc854c726e45264a))
* **forex:** use the main wallet for margin and P/L ([52f2130](https://github.com/888Greys/Neemiz/commit/52f2130dbcac2ccc412e46e2dc6c9874b3207785))
* **game-feel:** instant taps, haptics, and win/lose sound for the games ([#311](https://github.com/888Greys/Neemiz/issues/311)) ([5129d95](https://github.com/888Greys/Neemiz/commit/5129d951e1fe5eb831b178ed6569a3bb2fe10a2a))
* **games:** split Aviator music/sound toggles + redesign Lucky Spin + instant spin ([#313](https://github.com/888Greys/Neemiz/issues/313)) ([458d595](https://github.com/888Greys/Neemiz/commit/458d595eab5ec711f9a168dfa1bdce7282bc2a7b))
* **header:** floating frosted top bar, balance chip, sleeker menu wallet ([81f4c45](https://github.com/888Greys/Neemiz/commit/81f4c4547e96875d669469f27baaea317a3eed17))
* **header:** hide balance by default ([1dabe11](https://github.com/888Greys/Neemiz/commit/1dabe118190ba4a1bf69e75d0f7303e482d15bba))
* make aviator immersive, redesign P2P payment methods picker, and add official M-Pesa logo ([bb7223c](https://github.com/888Greys/Neemiz/commit/bb7223c9f4a0cd6a7f0a071638031b394489eb18))
* make binary page immersive on mobile and add mobile back control ([d7bce0f](https://github.com/888Greys/Neemiz/commit/d7bce0ffd5b4ace63f8e50491d4662f2e82d4770))
* **moneybinary:** ExpertOption-style white/green landing page ([0fe8514](https://github.com/888Greys/Neemiz/commit/0fe8514958ef133d15f6358dc1c2d4d9ab03de01))
* **nav:** drop wallet button, add language selector, NoOnes-style search ([65cbff1](https://github.com/888Greys/Neemiz/commit/65cbff1a8b63b3a212b3382f90a2796541cbde13))
* **nav:** full-screen searchable mobile menu; hamburger-only top bar ([1ffd8a7](https://github.com/888Greys/Neemiz/commit/1ffd8a774083556d61f9866b20f10e72b17ff56f))
* **nav:** mark non-English languages as Coming soon ([3909674](https://github.com/888Greys/Neemiz/commit/39096745902f356ef17f46f526f8a369bedd12e7))
* **p2p, wallet, nav:** readable errors, saved-first payment picker, held-coin filter, floating mobile nav & wallet history split ([3dd80f8](https://github.com/888Greys/Neemiz/commit/3dd80f802829d271cdabee23b7c10c1a9af79f6e))
* **p2p:** Actions bottom sheet + in-chat primary action ([e12e071](https://github.com/888Greys/Neemiz/commit/e12e0717b205bb0c1afa2694a4548e8f84d9534f))
* **p2p:** activate all in-app local coins as tradeable assets ([8701875](https://github.com/888Greys/Neemiz/commit/870187589fd0a004cc246adadf9f8dd8d8ea4dcb))
* **p2p:** add ALL option to P2P fiat currency filter ([f4344f1](https://github.com/888Greys/Neemiz/commit/f4344f1fe1ca632fd7368b48196715bda266f507))
* **p2p:** add database migration to automatically migrate escrow on deploy ([335a5f6](https://github.com/888Greys/Neemiz/commit/335a5f64616d6e9e51eb235b7f6ce3f9436a0a05))
* **p2p:** add escrow migration script for existing active ads ([1d48956](https://github.com/888Greys/Neemiz/commit/1d489560e4afd49c4aa2f3f2954b35c30e689c0f))
* **p2p:** add-payment starts with country pick, no M-Pesa default ([#321](https://github.com/888Greys/Neemiz/issues/321)) ([ee5d7d9](https://github.com/888Greys/Neemiz/commit/ee5d7d9f91dce3c3b9d7adf9c4697a8997f3bbe4))
* **p2p:** chat-dominant mobile order view (Noones-style) ([d8da115](https://github.com/888Greys/Neemiz/commit/d8da115d2c1d36b2e0f313f2a144d0214c3db6cb))
* **p2p:** copy button on chat messages, browse ads after cancel ([381388c](https://github.com/888Greys/Neemiz/commit/381388cc11fc322d66d47022c9c5b5bf4f9b1ee2))
* **p2p:** counterparty allowlist for restricted accounts ([04b2514](https://github.com/888Greys/Neemiz/commit/04b2514f120ee6b2259eb60c595453427da11a34))
* **p2p:** country-first payment-method picker + per-country coin registry ([#319](https://github.com/888Greys/Neemiz/issues/319)) ([3376893](https://github.com/888Greys/Neemiz/commit/33768932ffd5739b006f2d9db26207f435727313))
* **p2p:** default P2P page currency selection to ALL on visit ([1dcdce2](https://github.com/888Greys/Neemiz/commit/1dcdce2cd01306664317cb87042f9c43fc85ab1a))
* **p2p:** derive in-app coins for every registered country ([c852c4e](https://github.com/888Greys/Neemiz/commit/c852c4e2020e8e1c7d3e89c6952c2644d3af513c))
* **p2p:** desktop profile top-right + comment on order feedback ([082a31d](https://github.com/888Greys/Neemiz/commit/082a31d71472dad9fd4f14732b882e9058a644b1))
* **p2p:** expiry system messages (about-to-expire + expired) ([53a8358](https://github.com/888Greys/Neemiz/commit/53a8358f179702b7cffcd04538bd91d5724396fa))
* **p2p:** full global payment-method catalogue (all countries) ([#328](https://github.com/888Greys/Neemiz/issues/328)) ([7d1b0bc](https://github.com/888Greys/Neemiz/commit/7d1b0bce5f7b82120a226439ad25be8bb78ff7c6))
* **p2p:** fund local-coin sell ads from KES via FX ([b79f00f](https://github.com/888Greys/Neemiz/commit/b79f00feb84cb3a266da87d7a94a99ff11a1356c))
* **p2p:** implement just-in-time escrow with shared balance pool for all asset types ([122f313](https://github.com/888Greys/Neemiz/commit/122f31397d53229df4bc875592d436b75e58490d))
* **p2p:** in-app coins sell straight from wallet, like KES Coin ([e06e2c0](https://github.com/888Greys/Neemiz/commit/e06e2c0626cb0f6d9efd3d2f073358d68c57b291))
* **p2p:** make payment methods optional when creating an ad ([#327](https://github.com/888Greys/Neemiz/issues/327)) ([afc6451](https://github.com/888Greys/Neemiz/commit/afc64512a69a767522a1f11e7f7344e2cff0e5e5))
* **p2p:** Noones-style cancel screen (reason dropdown + confirm) ([5ff4a41](https://github.com/888Greys/Neemiz/commit/5ff4a41521fda7b868d89098755d0a23db7069f3))
* **p2p:** Noones-style inline payment-method picker on Post ad ([#316](https://github.com/888Greys/Neemiz/issues/316)) ([f0bfde7](https://github.com/888Greys/Neemiz/commit/f0bfde7d95051fbc431456619d484c3b82dbff7c))
* **p2p:** one wallet — lock on-chain sells from user balance ([c9850ce](https://github.com/888Greys/Neemiz/commit/c9850cee909c2a22675b9bf54a5561fbc020506e))
* **p2p:** render order events as "System message" blocks ([92d5924](https://github.com/888Greys/Neemiz/commit/92d5924b73b6fc5181980fc4e31f27b0c10c4158))
* **p2p:** show ad margin % and unlock non-KES market pricing ([f1a682c](https://github.com/888Greys/Neemiz/commit/f1a682cd08126c4d12755610eb6e03916650d478))
* **p2p:** unread message counter on order chat buttons ([6def1a7](https://github.com/888Greys/Neemiz/commit/6def1a7e0a1af8fe56271068ce29ee445ea11f13))
* **p2p:** use browse Payment Methods sheet on create-ad ([3f45161](https://github.com/888Greys/Neemiz/commit/3f451617c59356ad16e1da6c059100379d12e94e))
* **promo:** zero out NEZEEM400/KIP100/SILAS50 grants, keep them trackable ([#308](https://github.com/888Greys/Neemiz/issues/308)) ([127cc0d](https://github.com/888Greys/Neemiz/commit/127cc0de8186b24ba204593bc33e39d23af19f18))
* **sports:** email wins/voids, kickoff conflict filter, prune dead slips ([7dc10fa](https://github.com/888Greys/Neemiz/commit/7dc10fa2d026c093795a4a56e95e745bdad7d43c))
* **wallet:** admins can deposit from KSh 1 (cheap live testing) ([c3ed7d7](https://github.com/888Greys/Neemiz/commit/c3ed7d73d02eca655620eda077f29733aff447bb))
* **wallet:** admins can withdraw from KSh 1 for live testing ([da33d2b](https://github.com/888Greys/Neemiz/commit/da33d2b0f3ebadf0464659fb5ca50a872f43d6c5))
* **wallet:** raise min deposit to KSh 200 and hide card payments ([28af69c](https://github.com/888Greys/Neemiz/commit/28af69ce9ed5a1c22431432a1142cac3f189808f))
* **wallet:** set first-deposit bonus to 25% with KSh 200 min ([93c3450](https://github.com/888Greys/Neemiz/commit/93c3450f6d73a68be9a7f2cdaa91a9073c93bc77))


### Bug Fixes

* **admin:** declutter today's money with filters and pagination ([a9aa0d6](https://github.com/888Greys/Neemiz/commit/a9aa0d65ab992589db760fe7094766db5c039638))
* **admin:** drop Binary architecture blurb; label four sister sites ([6535aa1](https://github.com/888Greys/Neemiz/commit/6535aa1c96c1aafb55039618d1c9cc879ab6f46b))
* **admin:** import isActiveLocalCoin from local-coins in grant-coin route ([7d492aa](https://github.com/888Greys/Neemiz/commit/7d492aaf1261bc3be70c250c4835ed5edf6dd363))
* **admin:** match verifyAdminToken signature on binary-ke API ([5e70324](https://github.com/888Greys/Neemiz/commit/5e70324fd841c3cfda02c729bba8087727ac3501))
* **admin:** reflect Lipa Haraka and crypto deposits/withdrawals in money KPIs ([6465d08](https://github.com/888Greys/Neemiz/commit/6465d087b911927b8b98a85c4293cd6a8ef18ba1))
* **admin:** sports settlement backlog alert ignores future-dated bets ([#315](https://github.com/888Greys/Neemiz/issues/315)) ([ac54bbe](https://github.com/888Greys/Neemiz/commit/ac54bbe97c76dfc16e29574e5ca09893a289df57))
* **auth:** keep Binary OAuth on binaryoptionske.com after Google ([c7d73bd](https://github.com/888Greys/Neemiz/commit/c7d73bdeaa151b743dcb5d832cc9f598de24b980))
* **auth:** let admins bypass per-device account cap ([b736f50](https://github.com/888Greys/Neemiz/commit/b736f5042dcf1006d377f088f113a473be265f00))
* **auth:** let admins bypass per-device account cap ([468fc26](https://github.com/888Greys/Neemiz/commit/468fc26a2942254d4095a4bf999f8dbb8ae6cd52))
* **binary-ke:** lime language picker in mobile drawer ([cf7ded2](https://github.com/888Greys/Neemiz/commit/cf7ded2bc965c1c4dbd1d36153071a64d060e7f0))
* **binary-ke:** remove B box prefix from BinaryKE logo ([e68d3a4](https://github.com/888Greys/Neemiz/commit/e68d3a41ac6109bdc52effe147614cca62e77c43))
* **binary-ke:** restore Nezeem HTTP redirect at / ([cf194d1](https://github.com/888Greys/Neemiz/commit/cf194d1cf708640f09ed223710ded55343fe6746))
* **binary-ke:** serve landing at / from runtime surface env ([cd6d048](https://github.com/888Greys/Neemiz/commit/cd6d048a9098f94374ba6d331932ea1bf3bfed8e))
* **binary-ke:** serve Olymp-style auth pages for landing CTAs ([cefac95](https://github.com/888Greys/Neemiz/commit/cefac95aea4915fe854da27fa2b38f9f663c62a4))
* **binary-ke:** stop next.config from skipping the / landing ([779e748](https://github.com/888Greys/Neemiz/commit/779e7483b52a7f377afadfa49e3cc14d27e4a7ec))
* **binary:** accept $1 stakes when FX ceil/round disagree ([489aa98](https://github.com/888Greys/Neemiz/commit/489aa98af80024effb06c5d423e59cd893400951))
* **binary:** accept VANILLA in directional reject copy helper ([148ba62](https://github.com/888Greys/Neemiz/commit/148ba6252abe74205b9a867c22d00ccedf8b5933))
* **binary:** allow free typing in desktop stake fields ([1aa563d](https://github.com/888Greys/Neemiz/commit/1aa563d3c1c2bcbdb7bd7d374a82f1fded9d5864))
* **binary:** always show win/loss toasts like place and Aviator ([d5b5024](https://github.com/888Greys/Neemiz/commit/d5b50240d4313ae791b019eb7ac94ef9ddae37d1))
* **binary:** calm barrier rejects and align UI min with server ([e859d31](https://github.com/888Greys/Neemiz/commit/e859d31bf4833a79b4fa67f8c135259df6575c8d))
* **binary:** calm Matches unavailability UX without widening gates ([fa947f6](https://github.com/888Greys/Neemiz/commit/fa947f664b438028663c27cb390843a0f108470e))
* **binary:** compact colored chips, polish copy sheet, gate copy by flag ([6d56168](https://github.com/888Greys/Neemiz/commit/6d561689ee94ddf398d663f2c37ee92eb1d8aeec))
* **binary:** compact colored chips, polish copy sheet, gate copy by flag ([c0d235f](https://github.com/888Greys/Neemiz/commit/c0d235f0857717b4450250fec33aec19d7177029))
* **binary:** disable Matches Buy when quote gate rejects ([5c64c1b](https://github.com/888Greys/Neemiz/commit/5c64c1bec8b9b7ae424acf864a55fdd370e63d29))
* **binary:** draft-type trade number fields like stake ([158a0e1](https://github.com/888Greys/Neemiz/commit/158a0e1e8e7cd641f8d5b8e78415396019034074))
* **binary:** drop unused closedDisplayStatus import ([257746b](https://github.com/888Greys/Neemiz/commit/257746b4073448b1c6722f4493f7e71a6ed978e4))
* **binary:** fill viewport across breakpoints; tighter chart gap ([9e02725](https://github.com/888Greys/Neemiz/commit/9e0272507d5b3bf137e0a126199380922cd2489f))
* **binary:** hide Matches side in UI (removed via kill switch) ([#326](https://github.com/888Greys/Neemiz/issues/326)) ([66643fe](https://github.com/888Greys/Neemiz/commit/66643fe24d3bc4dd6c700cce6436e44e8eb4acdd))
* **binary:** house-safe pricing for Matches/OU/HL/Vanilla/Acca and reopen ([6c3e4ec](https://github.com/888Greys/Neemiz/commit/6c3e4ecb3b5b3cc30a64750da93098a9bb4dd9f0))
* **binary:** keep play stake display in clean USD dollars ([f9bf797](https://github.com/888Greys/Neemiz/commit/f9bf797711d273e5745e8323679f712afaa6b237))
* **binary:** lead Vanilla Call/Put CTAs with max payout ([a4043e3](https://github.com/888Greys/Neemiz/commit/a4043e3601e360665a635586ea69731aea813ba1))
* **binary:** map digit/HL reject copy by contract family ([168ebc8](https://github.com/888Greys/Neemiz/commit/168ebc84ec9a07b2f9df3b29267fbe1db9d04aa7))
* **binary:** quieter digit gates and clearer mobile chrome ([75addd7](https://github.com/888Greys/Neemiz/commit/75addd785a978c0a960186c550b7409a83a8a9b9))
* **binary:** quieter digit gates and clearer mobile chrome ([01e335d](https://github.com/888Greys/Neemiz/commit/01e335d2bdb3d311b2cab25fcf0868da3e4749a8))
* **binary:** restore closedDisplayStatus import for partial settles ([e581d26](https://github.com/888Greys/Neemiz/commit/e581d26e568ab2a3280a0b2add7d2bb4d6bc539e))
* **binary:** show live digit/directional Buy payouts from quote API ([f0bbbc9](https://github.com/888Greys/Neemiz/commit/f0bbbc97607b0449a6a4c6336b24360050a34115))
* **binary:** show PARTIAL for Vanilla ITM credits under stake ([9dce14d](https://github.com/888Greys/Neemiz/commit/9dce14db9bf72f3f842ea4e43c8fd4c63032c9ac))
* **binary:** surface Markets and Positions in immersive top bar ([831c56b](https://github.com/888Greys/Neemiz/commit/831c56bf839f142b252cab4084bd1a628c3c769f))
* **binary:** surface Markets and Positions in immersive top bar ([f448ef2](https://github.com/888Greys/Neemiz/commit/f448ef20960bc66be5126bc3ec98ba6082df8916))
* **binary:** tighten Accumulator sigma prop typing for mobile panel ([db7bef1](https://github.com/888Greys/Neemiz/commit/db7bef18d2d6b00f310846d5e24350ff93574156))
* **binary:** top hamburger chrome; bounce Binary container separately ([da87184](https://github.com/888Greys/Neemiz/commit/da87184c9a328b149d7848c0778eddc0d3a0958f))
* **binary:** use server entry_digit in closed history ([98203d5](https://github.com/888Greys/Neemiz/commit/98203d5045b9a17369490c07ce6b40304d590ba9))
* **charts:** fill LiveTickChart plot on Binary and Forex ([3526bab](https://github.com/888Greys/Neemiz/commit/3526bab59f895bbbadb732500632ffd9b007401e))
* **charts:** hide dashed stub when full price line is shown ([230daf2](https://github.com/888Greys/Neemiz/commit/230daf29a89c24103b79f2e3003b79b0ae159a78))
* **ci:** bake self-hosted staging auth into GH Actions builds ([0dc2eaa](https://github.com/888Greys/Neemiz/commit/0dc2eaa2e5ec703ba16e4dc3c0c9098ee69a1e06))
* **ci:** unblock BinaryKE deploy typecheck and missing CSS ([ddf9154](https://github.com/888Greys/Neemiz/commit/ddf9154149f44918b0f6d2bc76b6a4be680672cf))
* **copy:** show admin leaders when COPY_SHOW_ADMIN_LEADERS is set ([27e6f08](https://github.com/888Greys/Neemiz/commit/27e6f08b03c6108467d26dd48cc1edffc99460f4))
* **copy:** show admin leaders when COPY_SHOW_ADMIN_LEADERS is set ([b3962a0](https://github.com/888Greys/Neemiz/commit/b3962a0601a20d269605378e53910c9b53c2655c))
* **copy:** show leader avatars and widen sample stats to 30d ([5ab49c3](https://github.com/888Greys/Neemiz/commit/5ab49c3d0a8c273073b02c545965e074ce185d2d))
* **favicon:** revert Nezeem to light-blue/white, give MoneyBinary own green mark ([30a4aea](https://github.com/888Greys/Neemiz/commit/30a4aea802974b5a0f22439eaba9d1dd8252e9ba))
* honor admin Off toggle for first-deposit bonus ([f87f716](https://github.com/888Greys/Neemiz/commit/f87f716ff3346658ebe6f6b85dfd7a39979d5e26))
* **lipa:** align STK/B2C client with Lipa Haraka API v2 docs ([4f11a1a](https://github.com/888Greys/Neemiz/commit/4f11a1a0b7b04de0a60990c66a33ea15497363dc))
* **lipa:** read CheckoutRequestID from provider nest ([066ebda](https://github.com/888Greys/Neemiz/commit/066ebdae836c4557daa8983fb7938496cc77fe5e))
* **lipa:** stop storing payment_id as CheckoutRequestID ([6a9ff9d](https://github.com/888Greys/Neemiz/commit/6a9ff9dcd83026447cb67eb3879c916189290f8c))
* **moneybinary:** add MoneyBinary DB to Lipa webhook dual-credit ([770f366](https://github.com/888Greys/Neemiz/commit/770f366a50b5bddcca2bf90c2dbc956813797980))
* **nav:** add Lucky Spin to the desktop top bar ([4b07908](https://github.com/888Greys/Neemiz/commit/4b079081cddb93f71a66b9b0e8b8476a2bffab40))
* **nav:** drop desktop rail and trim mobile P2P menu dupes ([6d4aa3e](https://github.com/888Greys/Neemiz/commit/6d4aa3ea430ae6b96423e7e67c20571e4f9a58c2))
* **p2p:** add epsilon tolerance to max limit guard to prevent floating point division error ([38ec638](https://github.com/888Greys/Neemiz/commit/38ec63852224e0a80a9fbd1abb1cbe906ff1fa36))
* **p2p:** allow editing/pausing ads that have no payment methods ([179b0ed](https://github.com/888Greys/Neemiz/commit/179b0ed7d8fb88cb9dba0bf8fe5235d4dce7e0d6))
* **p2p:** allow funding merchant escrow with in-app local coins ([e2f9a6c](https://github.com/888Greys/Neemiz/commit/e2f9a6c89ac64eeb665e56125bf29bb42dd25f1f))
* **p2p:** close promo deposit-to-withdraw gate bypass via KES Coin escrow ([#301](https://github.com/888Greys/Neemiz/issues/301)) ([de6a3fb](https://github.com/888Greys/Neemiz/commit/de6a3fb5d0341e9a9f43955b42a7983d4d0f5244))
* **p2p:** default coin filter to all assets without colliding with ALL Lek ([6f38c6a](https://github.com/888Greys/Neemiz/commit/6f38c6a866bb697e07635dc8b723672568d2e16b))
* **p2p:** defer local coin conversion to order placement and fix ad deletion KES refund bug ([bc7caf3](https://github.com/888Greys/Neemiz/commit/bc7caf3ecfacd327b23166882b38b90764bd1695))
* **p2p:** don't roll back local-coin settlement on missing FX rate ([462c526](https://github.com/888Greys/Neemiz/commit/462c526ce7420397173cb62a5a191051174c97a8))
* **p2p:** drop total amount field on create-offer ([1dae21b](https://github.com/888Greys/Neemiz/commit/1dae21b2d04fe62beefe15c20da016623cdf4ef7))
* **p2p:** enable wallet USDT in create-ad coin picker ([58f1ff1](https://github.com/888Greys/Neemiz/commit/58f1ff112807a8f21a7f0d42c08ab88568bb2405))
* **p2p:** FX outage resilience + exclude granted coin from backing ([cedb542](https://github.com/888Greys/Neemiz/commit/cedb542361f528b41e6bf29a8d43c92b1f2eb14f))
* **p2p:** harden ad creation when paymentMethods is omitted ([0b7b4c9](https://github.com/888Greys/Neemiz/commit/0b7b4c976f9443095cc4f93c914e164dbe12122f))
* **p2p:** lead coin pickers with on-chain crypto ([1d7e14d](https://github.com/888Greys/Neemiz/commit/1d7e14dc37e8837e2967922c9619e6ff8b993326))
* **p2p:** open payment methods sheet on create-ad step 2 ([d2b2006](https://github.com/888Greys/Neemiz/commit/d2b2006efbd5175603a7f17ae386f289cad5c50e))
* **p2p:** place margin beside Sell button on mobile offer cards ([65c0cfc](https://github.com/888Greys/Neemiz/commit/65c0cfc7dc5e1f759248e68b15c1d2f20436a3db))
* **p2p:** redesign escrow wallet page for desktop ([551809f](https://github.com/888Greys/Neemiz/commit/551809f962ad537d3975874304a3b0a31c0ea616))
* **p2p:** repair broken build — missing db import + wrong test network ([cf024c8](https://github.com/888Greys/Neemiz/commit/cf024c8b5d93a6f1cebe697c619dbb82d8db76cb))
* **p2p:** resolve escrow, backing, fee booking, and expiry issues from audit ([4056508](https://github.com/888Greys/Neemiz/commit/4056508534623f6e3c95e558333d6c4c49371c8d))
* **p2p:** right-align Sell/Buy button on mobile offer cards ([14b812d](https://github.com/888Greys/Neemiz/commit/14b812d4313827a464ddfb5f1f6f4da02295bad2))
* **p2p:** seed admin UG Coin by is_admin instead of email ([553738a](https://github.com/888Greys/Neemiz/commit/553738ac2321d033dd6c936349f995ae1ae9f78c))
* **p2p:** show offer margin % for all coins and legacy ads ([82918d8](https://github.com/888Greys/Neemiz/commit/82918d833d52c3c072173195f18ef2cddb7ebe05))
* **p2p:** shrink payment-window clock icon on offer rows ([87d0e64](https://github.com/888Greys/Neemiz/commit/87d0e6450a9dccf4e57dd0fcc596c11adc0dd313))
* **p2p:** size sell-ad max off free KES, not the whole wallet ([f4b831d](https://github.com/888Greys/Neemiz/commit/f4b831d6b46f548702d7fc74b9c82b9cdfc2b57e))
* **p2p:** stop double-unlock when deleting a paused sell ad ([c46d4c8](https://github.com/888Greys/Neemiz/commit/c46d4c8d343442085a41a7eeb136c9d2cd1deb13))
* **p2p:** unblock goodhope229 via data migration ([6cdf380](https://github.com/888Greys/Neemiz/commit/6cdf3808156a2ad92a8b598f7a12271c283ad77f))
* **p2p:** unlock orphaned sell-ad crypto locks on deploy ([49ac456](https://github.com/888Greys/Neemiz/commit/49ac456e3c1be20ec5882477dc7e207dcc2339be))
* **p2p:** widen My Ads and center create/coin pickers on desktop ([cfbe298](https://github.com/888Greys/Neemiz/commit/cfbe2984bb6c3135ccb6a567b6e4e35582219bd4))
* **p2p:** widen Profile to match market layout on desktop ([ce31188](https://github.com/888Greys/Neemiz/commit/ce31188661bca34ef9780ff69f2a894eb1a89352))
* **payments:** stop under-crediting Lipa Haraka deposits + add audit page ([4c8676d](https://github.com/888Greys/Neemiz/commit/4c8676df206b553702323f04e16d88d86676d71c))
* **prisma:** fix invalid reference to FROM-clause entry in p2p sell locks migration ([1d8212a](https://github.com/888Greys/Neemiz/commit/1d8212ab14813de5448ecf7872828ec7b7ff8d26))
* **sports:** mark fixture cache completed from scores feed ([98c76c3](https://github.com/888Greys/Neemiz/commit/98c76c3df0f13312adf1ac4ab095c0af79a92ace))
* **ui:** declutter desktop sidebar ([2277e08](https://github.com/888Greys/Neemiz/commit/2277e0830f6bb5d2f6004a9e00f4da7af5244f9f))
* **ui:** drop duplicate Aviator wallet and stacked win badge ([b18618e](https://github.com/888Greys/Neemiz/commit/b18618eedacd0ab5a7b295f770e54cb78dcff5a2))
* **ui:** remove header currency flag switcher ([cd01d7c](https://github.com/888Greys/Neemiz/commit/cd01d7cd630fa42259d3736297038df6bb209a27))
* **wallet:** auto-kill withdrawals after more than 2 cash-outs ([9946b17](https://github.com/888Greys/Neemiz/commit/9946b17b1b40c71806a2f13c702992582da6ba23))
* **wallet:** block unfunded accounts from sending transfers — trap mule credit ([#303](https://github.com/888Greys/Neemiz/issues/303)) ([27b1b7a](https://github.com/888Greys/Neemiz/commit/27b1b7ad547cea610ad81e9e664d2470742054dd))
* **wallet:** generalized deposit-to-withdraw gate — close transfer/admin-fanout mule vectors ([#302](https://github.com/888Greys/Neemiz/issues/302)) ([010b4ce](https://github.com/888Greys/Neemiz/commit/010b4ce82ea7ce416334e47be4e342856a1d447d))
* **wallet:** keep velocity kill on players only ([0d57c9d](https://github.com/888Greys/Neemiz/commit/0d57c9dcc08f9efcdfdef08b4d5b782baac7cbd6))
* **wallet:** let admins withdraw KES to any M-Pesa number ([98018a2](https://github.com/888Greys/Neemiz/commit/98018a27ae5257efa10b6e3760589197d1c1702f))
* **wallet:** lock admin withdrawals to one M-Pesa number ([19664e4](https://github.com/888Greys/Neemiz/commit/19664e4755c852e6d80ccb18673e6af5c896e34a))
* **wallet:** sync display currency across balance UIs ([fab79a7](https://github.com/888Greys/Neemiz/commit/fab79a781551702da9f3e43b1ea0385f4a2d70ce))


### Security

* remove hardcoded prod DB password from disruption script ([68a664f](https://github.com/888Greys/Neemiz/commit/68a664fe808831b5d26211f9854b79dd1c46263e))


### Refactors

* **admin:** focus 7-day cashflow on Lipa Haraka (real M-Pesa) only ([ca40c80](https://github.com/888Greys/Neemiz/commit/ca40c80be474c3b2360e6636739a6334ca187665))
* **admin:** route the legacy console to the redesigned one ([b2954d4](https://github.com/888Greys/Neemiz/commit/b2954d499d03cb4bd80bd5df0d8e7bf026c01b6e))


### Reverts

* **nav:** Menu back in bottom nav, brand logo back in top bar ([616d682](https://github.com/888Greys/Neemiz/commit/616d68290385a295b36de170bbc1f04384a4306b))

## [1.9.2](https://github.com/888Greys/Neemiz/compare/v1.9.1...v1.9.2) (2026-07-11)


### Bug Fixes

* **binary:** quarantine R_50 Under — mis-calibrated +EV leak ([f3d593c](https://github.com/888Greys/Neemiz/commit/f3d593c542e32e415c7638cf5c77125a1911ba87))
* **binary:** quarantine R_50 Under — mis-calibrated +EV leak ([e0e01b3](https://github.com/888Greys/Neemiz/commit/e0e01b3864fa821009d77542e6419485970c77b1))
* **promo:** deposit-to-withdraw gate to stop promo farming ([92212d9](https://github.com/888Greys/Neemiz/commit/92212d95cdc177c57597e2c974ba466d63dbdcfe))
* **promo:** deposit-to-withdraw gate to stop promo farming ([edcc5eb](https://github.com/888Greys/Neemiz/commit/edcc5eb810db67066bc553cd30611d5d4f6490e9))


### Performance

* lazy-load binary panels + optimistic bet placement ([0ec7ec3](https://github.com/888Greys/Neemiz/commit/0ec7ec38ad09141e444f80fb6c38d80210fba688))
* lazy-load binary panels + optimistic bet placement ([e9909ad](https://github.com/888Greys/Neemiz/commit/e9909adb6f9cb02b66d67473cd826fd6a36fe70a))
* Redis rate limits + capacity runbook for nez ([2f8a7a3](https://github.com/888Greys/Neemiz/commit/2f8a7a3bef014e335f8dcbe0edefc2c999bc6ee4))
* Redis rate limits + capacity runbook for nez ([a226039](https://github.com/888Greys/Neemiz/commit/a2260392712302907c65491d6b628b6d485873b8))

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
