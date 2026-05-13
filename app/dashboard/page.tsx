import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { MobileHeroCarousel } from "@/components/mobile-hero-carousel";

const tempAssets = {
  bonusMobile: "https://v3.bundlecdn.com/b02632/plain/bonus/bonus-banner.1/main_bonus_360-v2.png",
  bonusDesktop: "https://v3.bundlecdn.com/b02632/plain/bonus/bonus-banner.1/main_bonus_768-v2.png",
  gameWeekMobile: "https://v3.bundlecdn.com/b02632/plain/casino/game-of-the-week.1/mobile.png",
  gameWeekDesktop: "https://v3.bundlecdn.com/b02632/plain/casino/game-of-the-week.1/desktop.png",
  freebet: "https://v3.bundlecdn.com/b02632/plain/betting/brand-freebet.png",
  randomGame: "https://v3.bundlecdn.com/b02632/plain/casino/random-game.1/bg-right-mobile.png",
  jackpot: "https://v3.bundlecdn.com/b02632/plain/casino/jackpot.1/start.png",
  poker: "https://v3.bundlecdn.com/b02632/plain/casino/poker/poker-cards.png",
};

const gameCards = [
  { title: "Mines", icon: "grid_view", color: "from-sky-500 to-blue-900", image: tempAssets.randomGame },
  { title: "Lucky Jet", icon: "rocket_launch", color: "from-violet-400 to-purple-900", image: tempAssets.jackpot },
  { title: "Dice", icon: "casino", color: "from-blue-300 to-blue-900", image: tempAssets.poker },
  { title: "Coinflip", icon: "paid", color: "from-amber-300 to-orange-800", image: tempAssets.freebet },
  { title: "Penalty", icon: "sports_soccer", color: "from-green-400 to-green-900", image: tempAssets.gameWeekMobile },
  { title: "Aviator", icon: "flight_takeoff", color: "from-cyan-400 to-blue-800", image: tempAssets.bonusMobile },
];

const sports = [
  ["Croatia Cup", "GNK Dinamo Zagreb", "HNK Rijeka", "19:00", "1.44", "4.10", "6.60"],
  ["Spain LaLiga", "Villarreal", "Sevilla", "20:00", "1.96", "3.52", "4.00"],
  ["DreamLeague", "Pvision", "Tundra", "Break", "1.15", "4.83", "+89"],
  ["DreamLeague", "BB", "REKONIX", "Map 2", "1.02", "10.99", "+55"],
];

const lobbyChips = [
  ["Lobby", "apps"],
  ["Nezeem games", "sports_score"],
  ["Quick games", "bolt"],
  ["Popular", "star"],
  ["New", "new_releases"],
  ["Only on Nezeem", "looks_one"],
  ["Slots", "casino"],
  ["Bonus buy", "redeem"],
];

const appCategories = [
  {
    icon: "sports_soccer",
    title: "Sports Betting",
    desc: "Live odds on 30+ sports. In-play markets updated in real time.",
    tone: "from-[#2a1b55]/85 to-[#11131c]",
    border: "border-violet-500/35",
    iconBg: "bg-violet-500/18 text-violet-200",
  },
  {
    icon: "rocket_launch",
    title: "Aviator",
    desc: "Provably fair crash game. Cash out before the plane flies away.",
    tone: "from-[#2a1d12]/85 to-[#11131c]",
    border: "border-orange-500/35",
    iconBg: "bg-orange-500/18 text-orange-200",
  },
  {
    icon: "online_prediction",
    title: "Predictions",
    desc: "Polymarket-style markets. Trade YES/NO on real-world events.",
    tone: "from-[#261321]/85 to-[#11131c]",
    border: "border-pink-500/35",
    iconBg: "bg-pink-500/18 text-pink-200",
  },
  {
    icon: "handshake",
    title: "P2P Trading",
    desc: "Buy and sell with real merchants. Escrow-protected every trade.",
    tone: "from-[#102921]/85 to-[#11131c]",
    border: "border-emerald-500/35",
    iconBg: "bg-emerald-500/18 text-emerald-200",
  },
  {
    icon: "show_chart",
    title: "Binary & Forex",
    desc: "Up or down. Trade currency pairs with fixed risk, fixed reward.",
    tone: "from-[#101f34]/85 to-[#11131c]",
    border: "border-blue-500/35",
    iconBg: "bg-blue-500/18 text-blue-200",
  },
  {
    icon: "account_balance_wallet",
    title: "Smart Wallet",
    desc: "Multi-currency wallet. Deposit, withdraw, and transfer instantly.",
    tone: "from-[#2c2410]/85 to-[#11131c]",
    border: "border-amber-500/35",
    iconBg: "bg-amber-500/18 text-amber-200",
  },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <MobileDashboard />

      <div className="mx-auto hidden w-full max-w-[1600px] px-3 py-3 md:block md:px-6 md:py-8">
        <div className="mb-4 flex gap-0 overflow-x-auto no-scrollbar md:mb-10">
          {[
            ["Lobby", "/dashboard"],
            ["Live Casino", "/aviator"],
            ["Quick games", "/binary"],
          ].map(([tab, href], index) => (
            <Link
              key={tab}
              href={href}
              className={`shrink-0 px-5 py-3 text-sm font-black md:px-6 md:text-base ${
                index === 0
                  ? "rounded-2xl bg-[#087cff] text-white"
                  : index === 1
                    ? "border-r border-white/10 bg-[#27282c] text-slate-100"
                    : "rounded-r-2xl bg-[#27282c] text-slate-100"
              }`}
            >
              {tab}
            </Link>
          ))}
        </div>

        <section className="grid gap-3 md:gap-5 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <div
            className="relative min-h-[210px] overflow-hidden rounded-2xl border border-outline-variant bg-cover bg-center p-4 md:min-h-[300px] md:rounded-[28px] md:p-9"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(5,8,14,.72), rgba(5,8,14,.18)), url(${tempAssets.bonusDesktop})` }}
          >
            <div className="relative z-10 max-w-xl">
              <div className="mb-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary md:mb-4 md:px-3 md:text-xs">
                Nezeem lobby
              </div>
              <h1 className="text-3xl font-black uppercase leading-none tracking-tight md:text-7xl">
                Crypto
                <br />
                Casino #1
              </h1>
              <p className="mt-3 max-w-md text-xs leading-5 text-on-surface-variant md:mt-5 md:text-lg md:leading-7">
                Casino, sports, fast games, P2P and prediction markets arranged in one compact wallet experience.
              </p>
              <button className="mt-5 rounded-xl bg-white px-5 py-2 text-sm font-black text-black md:mt-8 md:rounded-2xl md:px-8 md:py-3 md:text-lg">Play</button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:gap-5 xl:grid-cols-1">
            <article
              className="overflow-hidden rounded-2xl bg-cover bg-center p-4 md:rounded-[28px] md:p-6"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(57,99,255,.55), rgba(29,70,255,.42)), url(${tempAssets.gameWeekDesktop})` }}
            >
              <h2 className="text-xl font-black md:text-3xl">Best game of the week</h2>
              <div className="mt-4 flex h-24 items-end justify-center rounded-2xl border border-white/40 bg-white/15 md:mt-8 md:h-36 md:rounded-3xl">
                <Icon name="emoji_events" className="mb-5 text-4xl text-white/85 md:mb-7 md:text-6xl" />
              </div>
              <button className="mt-3 w-full rounded-xl bg-white py-2 text-sm font-black text-black md:mt-5 md:py-3 md:text-lg">Play</button>
            </article>

            <article
              className="rounded-2xl bg-cover bg-center p-4 md:rounded-[28px] md:p-6"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(98,117,138,.88), rgba(98,117,138,.42)), url(${tempAssets.freebet})` }}
            >
              <h3 className="text-xl font-black md:text-2xl">Bonuses</h3>
              <p className="mt-9 flex items-center gap-2 text-sm text-white/90 md:mt-16 md:text-base">
                <span className="h-2 w-2 rounded-full bg-white" /> 1 available bonus
              </p>
            </article>
          </div>
        </section>

        <section className="mt-5 grid gap-3 xl:grid-cols-[1fr_400px]">
          <label className="relative block">
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[25px] text-slate-400" />
            <input
              className="h-14 w-full rounded-2xl border border-transparent bg-[#242529] pl-12 pr-4 text-base font-medium text-white outline-none transition placeholder:text-slate-400 focus:border-[#087cff]"
              placeholder="Search"
            />
          </label>
          <button className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#242529] text-base font-black text-slate-100 transition hover:bg-[#303137]" type="button">
            <Icon name="tune" className="text-[22px]" />
            Providers
          </button>
        </section>

        <section className="mt-6 flex gap-2 overflow-x-auto no-scrollbar">
          {lobbyChips.map(([label, icon], index) => (
            <button
              key={label}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition md:text-base ${
                index === 0 ? "bg-[#087cff] text-white" : "bg-[#242529] text-slate-100 hover:bg-[#303137]"
              }`}
              type="button"
            >
              <Icon name={icon} fill className="text-[22px]" />
              {label}
            </button>
          ))}
          <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#242529] text-white transition hover:bg-[#303137]" type="button">
            <Icon name="chevron_right" className="text-[26px]" />
          </button>
        </section>

        <AppCategorySection />

        <section className="mt-6 md:mt-8">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <h2 className="flex items-center gap-2 text-lg font-black md:gap-3 md:text-2xl">
              <span className="text-primary">Nezeem</span> games
            </h2>
            <button className="rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold md:rounded-2xl md:px-5 md:py-2.5 md:text-base">All games</button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
            {gameCards.map((game) => (
              <article
                key={game.title}
                className={`flex aspect-square flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br ${game.color} p-3 shadow-[inset_0_-40px_60px_rgba(0,0,0,.28)] sm:aspect-[4/5] md:rounded-2xl md:p-4 md:shadow-[inset_0_-50px_70px_rgba(0,0,0,.28)]`}
                style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.45)), url(${game.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <Icon name={game.icon} className="mb-auto text-3xl text-white/85 md:text-5xl" />
                <h3 className="text-lg font-black uppercase leading-none md:text-3xl">{game.title}</h3>
                <p className="mt-1.5 text-[9px] font-bold uppercase text-white/70 md:mt-2 md:text-[10px]">Nezeem games</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7 md:mt-10">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <h2 className="flex items-center gap-2 text-lg font-black md:text-2xl">
              <span className="rounded-lg bg-[#ff1979] p-1 md:p-1.5">
                <Icon name="sensors" className="text-[16px] md:text-[20px]" />
              </span>
              Top Sports
            </h2>
            <button className="rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold md:rounded-2xl md:px-5 md:py-2.5 md:text-base">View all</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4 2xl:grid-cols-4">
            {sports.map(([league, home, away, time, one, draw, two]) => (
              <article key={`${league}-${home}`} className="rounded-xl bg-[#f2f3f6] p-3 text-black md:rounded-2xl md:p-5">
                <div className="mb-3 flex items-center gap-2 md:mb-4">
                  <span className="rounded-full bg-[#ff4b14] p-1 text-white">
                    <Icon name="local_fire_department" fill className="text-[16px] md:text-[18px]" />
                  </span>
                  <div>
                    <div className="text-sm font-black md:text-lg">{league}</div>
                    <div className="text-xs text-black/65 md:text-sm">Soccer</div>
                  </div>
                </div>
                <div className="mb-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-bold text-black/70 md:mb-4 md:px-3 md:text-sm">{time}</div>
                <div className="mb-4 space-y-1 text-sm font-semibold md:mb-5 md:text-lg">
                  <div>{home}</div>
                  <div>{away}</div>
                </div>
                <div className="text-xs text-black/60 md:text-sm">Full time result</div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[["1", one], ["X", draw], ["2", two], ["", "+99"]].map(([label, value]) => (
                    <button key={`${home}-${label}-${value}`} className="rounded-lg bg-[#e8eaf0] px-1.5 py-2 text-sm font-black md:px-2 md:py-3 md:text-base">
                      <span className="mr-1 text-xs text-black/50 md:mr-2 md:text-sm">{label}</span>
                      {value}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MobileDashboard() {
  return (
    <div className="md:hidden">
      <div className="space-y-4 px-2 py-3">
        <MobileHeroCarousel
          slides={[
            { title: "Welcome Bonus\nup to 600%\nand 500 FS", image: tempAssets.bonusMobile, cta: "Claim bonus" },
            { title: "Free bets\nfor betting\nand sports", image: tempAssets.gameWeekMobile, cta: "Play now" },
            { title: "Bonus gifts\nfor early\nplayers", image: tempAssets.freebet, cta: "Open gifts" },
          ]}
        />

        <section className="grid grid-cols-[1.35fr_.85fr] gap-2">
          <article
            className="relative min-h-[72px] overflow-hidden rounded-xl bg-cover bg-center p-3"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(102,87,69,.92), rgba(102,87,69,.35)), url(${tempAssets.freebet})` }}
          >
            <h2 className="text-sm font-black">Free money</h2>
            <p className="mt-1 max-w-[100px] text-[10px] leading-3 text-white/90">Giving away prizes & other rewards</p>
          </article>
          <article
            className="relative min-h-[72px] overflow-hidden rounded-xl bg-cover bg-center p-3"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(97,118,141,.88), rgba(97,118,141,.30)), url(${tempAssets.gameWeekMobile})` }}
          >
            <h2 className="text-sm font-black">Bonuses</h2>
          </article>
        </section>

        <MobileGameSection
          title="Nezeem games"
          icon="sports_score"
          games={[
            ["Mines", "grid_view", "from-sky-500 to-blue-900", tempAssets.randomGame],
            ["Lucky Jet", "rocket_launch", "from-violet-400 to-purple-900", tempAssets.jackpot],
            ["Dice", "casino", "from-blue-300 to-blue-900", tempAssets.poker],
          ]}
        />

        <MobileAppCategories />

        <MobileGameSection
          title="All games"
          icon="apps"
          games={[
            ["Aviator", "flight_takeoff", "from-red-500 to-red-900", tempAssets.gameWeekMobile],
            ["Jeta", "flight", "from-yellow-300 to-yellow-700", tempAssets.jackpot],
            ["Coin Volcano", "local_fire_department", "from-orange-400 to-red-900", tempAssets.bonusMobile],
          ]}
        />

        <MobileGameSection
          title="Quick games"
          icon="bolt"
          games={[
            ["Rocket", "rocket_launch", "from-red-500 to-red-900", tempAssets.freebet],
            ["Penalty", "sports_soccer", "from-green-400 to-green-900", tempAssets.gameWeekMobile],
            ["Cross Fire", "extension", "from-slate-300 to-blue-700", tempAssets.randomGame],
          ]}
        />
      </div>
    </div>
  );
}

function AppCategorySection() {
  return (
    <section className="mt-7 md:mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Nezeem markets</p>
          <h2 className="mt-1 text-2xl font-black">Product categories</h2>
        </div>
        <Link href="/wallet" className="hidden rounded-2xl bg-surface-container-high px-5 py-2.5 text-sm font-black text-slate-100 transition hover:bg-[#303137] lg:inline-flex">
          Open wallet
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {appCategories.map((category) => (
          <article
            key={category.title}
            className={`min-h-[178px] cursor-default rounded-2xl border ${category.border} bg-gradient-to-br ${category.tone} p-5`}
          >
            <span className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${category.iconBg}`}>
              <Icon name={category.icon} fill className="text-[28px]" />
            </span>
            <h3 className="text-xl font-black">{category.title}</h3>
            <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-400">{category.desc}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-primary">
              Coming soon
              <Icon name="arrow_forward" className="text-[18px]" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobileAppCategories() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Icon name="widgets" fill className="text-[18px] text-primary" />
          Categories
        </h2>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Coming soon</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {appCategories.map((category) => (
          <article
            key={category.title}
            className={`min-h-[118px] rounded-xl border ${category.border} bg-gradient-to-br ${category.tone} p-3`}
          >
            <span className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${category.iconBg}`}>
              <Icon name={category.icon} fill className="text-[19px]" />
            </span>
            <h3 className="text-[13px] font-black leading-tight">{category.title}</h3>
            <p className="mt-1.5 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-400">{category.desc}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-primary">
              Coming soon
              <Icon name="arrow_forward" className="text-[13px]" />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobileGameSection({ games, icon, title }: { games: string[][]; icon: string; title: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Icon name={icon} fill className="text-[18px]" />
          {title}
        </h2>
        <button className="flex items-center gap-1 rounded-xl bg-[#242529] px-3 py-2 text-xs font-black" type="button">
          All games
          <Icon name="chevron_right" className="text-[17px]" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {games.map(([title, icon, color, image]) => (
          <article
            key={title}
            className={`flex aspect-[.72] flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br ${color} bg-cover bg-center p-2 shadow-[inset_0_-38px_55px_rgba(0,0,0,.25)]`}
            style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.48)), url(${image})` }}
          >
            <Icon name={icon} className="mb-auto text-[34px] text-white/85" />
            <h3 className="text-xl font-black uppercase leading-none">{title}</h3>
            <p className="mt-1 text-[7px] font-bold uppercase text-white/70">Nezeem games</p>
          </article>
        ))}
      </div>
    </section>
  );
}
