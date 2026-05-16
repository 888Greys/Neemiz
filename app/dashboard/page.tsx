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
          <NezeemGamesSection />
          <CrashGamesSection />
          <MinesSection />
          <ChickenGamesSection />
          <PlinkoSection />
        </div>
      </div>
    </AppShell>
  );
}


/* ── Shared section header ────────────────────────────── */

function SectionHeader({ icon, title, href }: { icon: string; title: string; href: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xl font-black text-white">
        <Icon name={icon} fill className="text-[22px] text-amber-400" />
        {title}
      </h2>
      <div className="flex items-center gap-2">
        <Link href={href} className="flex items-center gap-1 rounded-xl bg-[#1e2028] px-4 py-2 text-sm font-black text-slate-300 transition hover:bg-[#26272e] hover:text-white">
          All games
          <Icon name="chevron_right" className="text-[16px]" />
        </Link>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e2028] text-slate-400 transition hover:bg-[#26272e] hover:text-white">
          <Icon name="chevron_left" className="text-[20px]" />
        </button>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e2028] text-slate-400 transition hover:bg-[#26272e] hover:text-white">
          <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>
    </div>
  );
}

function GameCard({ title, provider, image, color, href }: { title: string; provider: string; image: string; color: string; href: string }) {
  return (
    <Link
      href={href}
      className="group relative flex-shrink-0 w-[160px] overflow-hidden rounded-2xl transition hover:scale-[1.03]"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.8) 100%), url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        aspectRatio: "3/4",
      }}
    >
      {title && (
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-black uppercase leading-tight text-white">{title}</h3>
          {provider && <p className="mt-0.5 text-[10px] font-bold uppercase text-white/50">{provider}</p>}
        </div>
      )}
    </Link>
  );
}

/* ── CDN helpers ──────────────────────────────────────── */

const CDN = "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev";

function cdnGames(category: string, count: number, ext: "avif" | "webp" = "avif") {
  return Array.from({ length: count }, (_, i) => ({
    title: "", provider: "", color: "", href: "/aviator",
    image: `${CDN}/games/${category}/${i + 1}.${ext}`,
  }));
}

/* ── Nezeem games ─────────────────────────────────────── */

function NezeemGamesSection() {
  const games = cdnGames("nezeem", 60);
  return (
    <section className="mt-10">
      <SectionHeader icon="videogame_asset" title="Nezeem games" href="/aviator" />
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {games.map((g) => <GameCard key={g.image} {...g} />)}
      </div>
    </section>
  );
}

/* ── Crash games ──────────────────────────────────────── */

function CrashGamesSection() {
  const games = cdnGames("crash", 157);
  return (
    <section className="mt-10">
      <SectionHeader icon="rocket_launch" title="Crash games" href="/aviator" />
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {games.map((g) => <GameCard key={g.image} {...g} />)}
      </div>
    </section>
  );
}

/* ── Mines ────────────────────────────────────────────── */

function MinesSection() {
  const games = cdnGames("mines", 46);
  return (
    <section className="mt-10">
      <SectionHeader icon="grid_view" title="Mines" href="/aviator" />
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {games.map((g) => <GameCard key={g.image} {...g} />)}
      </div>
    </section>
  );
}

/* ── Chicken Games ────────────────────────────────────── */

function ChickenGamesSection() {
  // Uses fast-games images offset by 30 so cards differ from Nezeem row
  const games = Array.from({ length: 30 }, (_, i) => ({
    title: "", provider: "", color: "", href: "/aviator",
    image: `${CDN}/games/nezeem/${i + 31}.avif`,
  }));
  return (
    <section className="mt-10">
      <SectionHeader icon="egg" title="Chicken Games" href="/aviator" />
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {games.map((g) => <GameCard key={g.image} {...g} />)}
      </div>
    </section>
  );
}

/* ── Plinko ───────────────────────────────────────────── */

function PlinkoSection() {
  const games = cdnGames("plinko", 60);
  return (
    <section className="mt-10">
      <SectionHeader icon="casino" title="Plinko" href="/aviator" />
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {games.map((g) => <GameCard key={g.image} {...g} />)}
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
