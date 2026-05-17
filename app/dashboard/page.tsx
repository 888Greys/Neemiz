import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { MobileHeroCarousel } from "@/components/mobile-hero-carousel";
import { HeroSection } from "@/components/hero-section";
import { GameRow } from "@/components/game-row";
import { TrendingMatchCarousel } from "@/components/trending-match-carousel";

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
      {/* Mobile hero + products */}
      <div className="md:hidden">
        <MobileDashboard />
      </div>

      {/* Desktop hero */}
      <div className="hidden md:block">
        <HeroSection />
      </div>

      {/* Game rows — shared across all screen sizes */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pb-10 md:px-6">
        <NezeemGamesSection />
        <CrashGamesSection />
        <MinesSection />
        <ChickenGamesSection />
        <PlinkoSection />
      </div>
    </AppShell>
  );
}


/* SectionHeader and GameCard moved to components/game-row.tsx */

/* ── CDN helpers ──────────────────────────────────────── */

const CDN = "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev";

function cdnGames(source: string, count: number, start = 1) {
  return Array.from({ length: count }, (_, i) => ({
    image: `${CDN}/games/${source}/${start + i}.avif`,
    href: "/aviator",
  }));
}

/* ── Nezeem games ─────────────────────────────────────── */

function NezeemGamesSection() {
  return (
    <GameRow
      icon="videogame_asset"
      title="Nezeem games"
      allHref="/casino/nezeem"
      games={cdnGames("nezeem", 60)}
    />
  );
}

/* ── Crash games ──────────────────────────────────────── */

function CrashGamesSection() {
  return (
    <GameRow
      icon="rocket_launch"
      title="Crash games"
      allHref="/casino/crash"
      games={cdnGames("crash", 157)}
    />
  );
}

/* ── Mines ────────────────────────────────────────────── */

function MinesSection() {
  return (
    <GameRow
      icon="grid_view"
      title="Mines"
      allHref="/casino/mines"
      games={cdnGames("mines", 46)}
    />
  );
}

/* ── Chicken Games ────────────────────────────────────── */

function ChickenGamesSection() {
  return (
    <GameRow
      icon="egg"
      title="Chicken Games"
      allHref="/casino/chicken"
      games={cdnGames("nezeem", 30, 31)}
    />
  );
}

/* ── Plinko ───────────────────────────────────────────── */

function PlinkoSection() {
  return (
    <GameRow
      icon="casino"
      title="Plinko"
      allHref="/casino/plinko"
      games={cdnGames("plinko", 60)}
    />
  );
}


/* ── Mobile ───────────────────────────────────────────── */

const BG_IMAGES = [
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg1.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg2.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg3.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg4.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg5.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg6.avif",
];

const QUICK_NAV = [
  { href: "/sports",      icon: "sports_soccer",          label: "Sports",      color: "bg-violet-500/20 text-violet-300" },
  { href: "/aviator",     icon: "rocket_launch",          label: "Aviator",     color: "bg-orange-500/20 text-orange-300" },
  { href: "/dashboard",   icon: "casino",                 label: "Casino",      color: "bg-blue-500/20 text-blue-300" },
  { href: "/p2p",         icon: "swap_horiz",             label: "P2P",         color: "bg-emerald-500/20 text-emerald-300" },
  { href: "/binary",      icon: "candlestick_chart",      label: "Binary",      color: "bg-sky-500/20 text-sky-300" },
  { href: "/wallet",      icon: "account_balance_wallet", label: "Wallet",      color: "bg-amber-500/20 text-amber-300" },
];

function MobileDashboard() {
  return (
    <div className="md:hidden">
      {/* ── Hero ── */}
      <MobileHeroCarousel slides={BG_IMAGES} />

      {/* ── Quick nav ── */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-4">
        {QUICK_NAV.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color} ring-1 ring-white/10`}>
              <Icon name={item.icon} fill className="text-[22px]" />
            </span>
            <span className="text-[10px] font-black text-white/60">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Aviator banner ── */}
      <div className="px-4">
        <Link
          href="/aviator"
          className="flex min-h-[190px] items-end overflow-hidden rounded-3xl bg-cover bg-center p-5"
          style={{ backgroundImage: `linear-gradient(135deg, rgba(20,8,4,.95) 0%, rgba(20,8,4,.6) 60%, rgba(20,8,4,.2) 100%), url(${tempAssets.gameWeekMobile})` }}
        >
          <div className="flex w-full items-end justify-between">
            <div>
              <div className="mb-2.5 flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff1979]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#ff1979]">Live now</span>
              </div>
              <h2 className="text-[32px] font-black leading-none">Aviator</h2>
              <p className="mt-1.5 text-[12px] text-white/60">Cash out before it flies away</p>
              <span className="mt-4 inline-block rounded-2xl bg-[#ff1979] px-5 py-2 text-[12px] font-black text-white shadow-lg shadow-[#ff1979]/30">
                Play now →
              </span>
            </div>
            <Icon name="rocket_launch" fill className="text-[88px] text-orange-400/80 drop-shadow-lg" />
          </div>
        </Link>
      </div>

      {/* ── Trending matches ── */}
      <div className="mt-5">
        <TrendingMatchCarousel />
      </div>
    </div>
  );
}
