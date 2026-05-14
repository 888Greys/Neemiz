import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { MobileHeroCarousel } from "@/components/mobile-hero-carousel";
import { HeroSection } from "@/components/hero-section";
import { liveEvents } from "@/lib/mock-data";

const tempAssets = {
  bonusMobile: "https://v3.bundlecdn.com/b02632/plain/bonus/bonus-banner.1/main_bonus_360-v2.png",
  bonusDesktop: "https://v3.bundlecdn.com/b02632/plain/bonus/bonus-banner.1/main_bonus_768-v2.png",
  gameWeekMobile: "https://v3.bundlecdn.com/b02632/plain/casino/game-of-the-week.1/mobile.png",
  freebet: "https://v3.bundlecdn.com/b02632/plain/betting/brand-freebet.png",
  randomGame: "https://v3.bundlecdn.com/b02632/plain/casino/random-game.1/bg-right-mobile.png",
  jackpot: "https://v3.bundlecdn.com/b02632/plain/casino/jackpot.1/start.png",
  poker: "https://v3.bundlecdn.com/b02632/plain/casino/poker/poker-cards.png",
};


const products = [
  {
    href: "/sports",
    icon: "sports_soccer",
    title: "Sports Betting",
    desc: "Live odds on 30+ sports with in-play markets.",
    cta: "Bet now",
    glow: "rgba(139,92,246,.45)",
    bg: "from-violet-600/20 via-violet-900/10 to-[#0d0e12]",
    border: "border-violet-500/30 hover:border-violet-400/60",
    iconColor: "text-violet-300",
    iconBg: "bg-violet-500/15",
    badge: null,
  },
  {
    href: "/aviator",
    icon: "rocket_launch",
    title: "Aviator",
    desc: "Provably fair crash game. Cash out in time.",
    cta: "Play now",
    glow: "rgba(249,115,22,.45)",
    bg: "from-orange-600/20 via-orange-900/10 to-[#0d0e12]",
    border: "border-orange-500/30 hover:border-orange-400/60",
    iconColor: "text-orange-300",
    iconBg: "bg-orange-500/15",
    badge: "HOT",
  },
  {
    href: "/predictions",
    icon: "online_prediction",
    title: "Polymarket",
    desc: "Trade YES/NO on real-world events.",
    cta: "Explore",
    glow: "rgba(236,72,153,.45)",
    bg: "from-pink-600/20 via-pink-900/10 to-[#0d0e12]",
    border: "border-pink-500/30 hover:border-pink-400/60",
    iconColor: "text-pink-300",
    iconBg: "bg-pink-500/15",
    badge: null,
  },
  {
    href: "/p2p",
    icon: "swap_horiz",
    title: "P2P Trading",
    desc: "Buy & sell with verified merchants. Escrow-protected.",
    cta: "Trade",
    glow: "rgba(16,185,129,.45)",
    bg: "from-emerald-600/20 via-emerald-900/10 to-[#0d0e12]",
    border: "border-emerald-500/30 hover:border-emerald-400/60",
    iconColor: "text-emerald-300",
    iconBg: "bg-emerald-500/15",
    badge: null,
  },
  {
    href: "/binary",
    icon: "candlestick_chart",
    title: "Binary & Forex",
    desc: "Up or down. Fixed risk, fixed reward on currency pairs.",
    cta: "Trade",
    glow: "rgba(59,130,246,.45)",
    bg: "from-blue-600/20 via-blue-900/10 to-[#0d0e12]",
    border: "border-blue-500/30 hover:border-blue-400/60",
    iconColor: "text-blue-300",
    iconBg: "bg-blue-500/15",
    badge: null,
  },
  {
    href: "/wallet",
    icon: "account_balance_wallet",
    title: "Smart Wallet",
    desc: "Multi-currency. Deposit, withdraw, transfer instantly.",
    cta: "Open",
    glow: "rgba(245,158,11,.45)",
    bg: "from-amber-600/20 via-amber-900/10 to-[#0d0e12]",
    border: "border-amber-500/30 hover:border-amber-400/60",
    iconColor: "text-amber-300",
    iconBg: "bg-amber-500/15",
    badge: null,
  },
];

const gameCards = [
  { title: "Aviator", icon: "rocket_launch", color: "from-red-500 to-red-900", image: tempAssets.gameWeekMobile, href: "/aviator" },
  { title: "Mines", icon: "grid_view", color: "from-sky-500 to-blue-900", image: tempAssets.randomGame, href: "/aviator" },
  { title: "Lucky Jet", icon: "flight_takeoff", color: "from-violet-400 to-purple-900", image: tempAssets.jackpot, href: "/aviator" },
  { title: "Dice", icon: "casino", color: "from-blue-300 to-blue-900", image: tempAssets.poker, href: "/aviator" },
  { title: "Coinflip", icon: "paid", color: "from-amber-300 to-orange-800", image: tempAssets.freebet, href: "/aviator" },
  { title: "Penalty", icon: "sports_soccer", color: "from-green-400 to-green-900", image: tempAssets.bonusMobile, href: "/sports" },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <MobileDashboard />

      <div className="hidden md:block">
        <HeroSection />

        <div className="mx-auto w-full max-w-[1600px] px-6 pb-10">
          <ProductShowcase />
          <GamesSection />
          <LiveSportsSection />
        </div>
      </div>
    </AppShell>
  );
}


/* ── Product Showcase ─────────────────────────────────── */

function ProductShowcase() {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-slate-500">What we offer</p>
          <h2 className="mt-1 text-2xl font-black text-white">All products</h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Link
            key={p.title}
            href={p.href}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${p.bg} ${p.border} p-5 transition-all duration-200`}
          >
            {/* glow on hover */}
            <div
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ boxShadow: `inset 0 0 40px 0 ${p.glow}` }}
            />

            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${p.iconBg}`}>
                  <Icon name={p.icon} fill className={`text-[26px] ${p.iconColor}`} />
                </span>
                {p.badge && (
                  <span className="rounded-full bg-[#ff1979] px-2.5 py-0.5 text-[10px] font-black text-white">
                    {p.badge}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-black text-white">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-5 text-slate-400">{p.desc}</p>

              <div className="mt-5 flex items-center gap-1.5 text-sm font-black text-slate-300 transition-colors group-hover:text-white">
                {p.cta}
                <Icon name="arrow_forward" className="text-[16px] transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Games ────────────────────────────────────────────── */

function GamesSection() {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black text-white">
          <span className="text-orange-400">Casino</span> games
        </h2>
        <Link href="/aviator" className="rounded-xl bg-[#1e2028] px-4 py-2 text-sm font-black text-slate-300 transition hover:bg-[#26272e] hover:text-white">
          All games
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {gameCards.map((game) => (
          <Link
            key={game.title}
            href={game.href}
            className={`group flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br ${game.color} p-3 transition`}
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.52)), url(${game.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <Icon name={game.icon} className="mb-auto text-[32px] text-white/85 transition group-hover:scale-110 md:text-[40px]" />
            <h3 className="text-base font-black uppercase leading-none md:text-2xl">{game.title}</h3>
            <p className="mt-1 text-[9px] font-bold uppercase text-white/60">Nezeem</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Live Sports ──────────────────────────────────────── */

function LiveSportsSection() {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black text-white">
          <span className="flex items-center gap-1.5 rounded-lg bg-[#ff1979] px-2 py-1 text-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
          Sports
        </h2>
        <Link href="/sports" className="rounded-xl bg-[#1e2028] px-4 py-2 text-sm font-black text-slate-300 transition hover:bg-[#26272e] hover:text-white">
          View all
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {liveEvents.map((event) => (
          <Link
            key={`${event.league}-${event.home}`}
            href="/sports"
            className="group rounded-2xl bg-[#f2f3f6] p-4 text-black transition hover:bg-white"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#ff4b14] p-1 text-white">
                  <Icon name="local_fire_department" fill className="text-[15px]" />
                </span>
                <div>
                  <div className="text-sm font-black">{event.league}</div>
                  <div className="text-[10px] text-black/55">{event.time}</div>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-[#ff1979]/12 px-2 py-0.5 text-[9px] font-black text-[#ff1979]">
                <span className="h-1 w-1 animate-pulse rounded-full bg-[#ff1979]" />
                LIVE
              </span>
            </div>
            <div className="mb-4 space-y-1">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{event.home}</span>
                <span className="font-black">{event.score.split(" - ")[0]}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{event.away}</span>
                <span className="font-black">{event.score.split(" - ")[1]}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[["1", event.odds[0]], ["X", event.odds[1]], ["2", event.odds[2]]].map(([label, value]) =>
                value ? (
                  <button
                    key={`${event.home}-${label}`}
                    className="rounded-xl bg-[#e8eaf0] px-2 py-2.5 text-sm font-black transition hover:bg-[#087cff] hover:text-white"
                    type="button"
                  >
                    <span className="mr-1 text-[10px] opacity-50">{label}</span>
                    {value}
                  </button>
                ) : null
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Mobile ───────────────────────────────────────────── */

function MobileDashboard() {
  return (
    <div className="space-y-4 px-2 py-3 md:hidden">
      <MobileHeroCarousel
        slides={[
          { title: "Bet, Trade\n& Win Big", image: tempAssets.bonusMobile, cta: "Get started" },
          { title: "Play Aviator\nCash out\nbefore it flies", image: tempAssets.gameWeekMobile, cta: "Play now" },
          { title: "Trade YES/NO\nPrediction\nMarkets", image: tempAssets.freebet, cta: "Explore" },
        ]}
      />

      {/* Product grid */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-black">Products</h2>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">6 available</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {products.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className={`group min-h-[80px] rounded-xl border ${p.border.split(" ")[0]} bg-gradient-to-br ${p.bg} p-2.5 transition active:scale-95`}
            >
              <span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${p.iconBg}`}>
                <Icon name={p.icon} fill className={`text-[16px] ${p.iconColor}`} />
              </span>
              <div className="text-[11px] font-black leading-tight">{p.title}</div>
              <div className={`mt-1 flex items-center gap-0.5 text-[9px] font-black ${p.iconColor}`}>
                {p.cta}
                <Icon name="arrow_forward" className="text-[10px]" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Aviator featured */}
      <Link
        href="/aviator"
        className="flex min-h-[88px] items-center justify-between overflow-hidden rounded-xl bg-cover bg-center px-4"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(29,12,8,.9), rgba(29,12,8,.45)), url(${tempAssets.gameWeekMobile})` }}
      >
        <div>
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff1979]" />
            <span className="text-[9px] font-black uppercase tracking-wider text-[#ff1979]">Live now</span>
          </div>
          <h2 className="text-lg font-black">Aviator</h2>
          <p className="text-[10px] text-white/75">Cash out before it flies away</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Icon name="rocket_launch" fill className="text-[44px] text-orange-400" />
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black">Play now</span>
        </div>
      </Link>

      <MobileGameSection title="Casino games" icon="casino" href="/aviator" games={[
        ["Mines", "grid_view", "from-sky-500 to-blue-900", tempAssets.randomGame],
        ["Lucky Jet", "rocket_launch", "from-violet-400 to-purple-900", tempAssets.jackpot],
        ["Dice", "casino", "from-blue-300 to-blue-900", tempAssets.poker],
      ]} />

      {/* Live sports */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-black">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff1979]" /> Live Sports
          </h2>
          <Link href="/sports" className="flex items-center gap-1 rounded-xl bg-[#242529] px-3 py-2 text-xs font-black">
            View all <Icon name="chevron_right" className="text-[15px]" />
          </Link>
        </div>
        <div className="space-y-2">
          {liveEvents.slice(0, 2).map((event) => (
            <Link key={`${event.league}-${event.home}`} href="/sports" className="flex items-center justify-between rounded-xl bg-[#f2f3f6] px-3 py-2.5 text-black">
              <div>
                <div className="text-[10px] font-bold text-black/55">{event.league} · {event.time}</div>
                <div className="text-xs font-black">{event.home} vs {event.away}</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-lg bg-white px-2 py-1.5 text-xs font-black shadow-sm">{event.odds[0]}</span>
                <span className="rounded-lg bg-white px-2 py-1.5 text-xs font-black shadow-sm">{event.odds[1]}</span>
                <span className="rounded-lg bg-white px-2 py-1.5 text-xs font-black shadow-sm">{event.odds[2] ?? event.markets}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MobileGameSection({ games, icon, title, href }: { games: string[][]; icon: string; title: string; href: string }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black">
          <Icon name={icon} fill className="text-[18px]" /> {title}
        </h2>
        <Link href={href} className="flex items-center gap-1 rounded-xl bg-[#242529] px-3 py-2 text-xs font-black">
          All <Icon name="chevron_right" className="text-[17px]" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {games.map(([name, gameIcon, color, image]) => (
          <Link
            key={name}
            href={href}
            className={`flex aspect-[.72] flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br ${color} p-2`}
            style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.5)), url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <Icon name={gameIcon} className="mb-auto text-[32px] text-white/85" />
            <h3 className="text-lg font-black uppercase leading-none">{name}</h3>
            <p className="mt-1 text-[7px] font-bold uppercase text-white/60">Nezeem</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
