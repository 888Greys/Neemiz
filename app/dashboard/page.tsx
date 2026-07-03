"use client";

import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { MobileHeroCarousel } from "@/components/mobile-hero-carousel";
import { HeroSection } from "@/components/hero-section";
import { GameRow } from "@/components/game-row";
import { TrendingMatchCarousel } from "@/components/trending-match-carousel";
import { useAuthModal } from "@/lib/auth-modal-context";
import { toast } from "@/lib/toast";

const AVIATOR_BANNER = "https://v3.bundlecdn.com/b02632/plain/casino/game-of-the-week.1/mobile.png";


export default function DashboardPage() {
  return (
    <AppShell hideSidebar={false}>
      {/* Mobile hero + products */}
      <div className="md:hidden">
        <MobileDashboard />
      </div>

      {/* Desktop hero */}
      <div className="hidden md:block">
        <HeroSection />
      </div>

      {/* Game rows — shared across all screen sizes */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pb-4 md:pb-10 md:px-6">
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
      games={cdnGames("nezeem", 24)}
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
      games={cdnGames("crash", 24)}
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
      games={cdnGames("mines", 24)}
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
      games={cdnGames("nezeem", 24, 31)}
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
      games={cdnGames("plinko", 24)}
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
  { href: "/sports",  action: null,     icon: "sports_soccer",          label: "Sports",  color: "bg-violet-500/20 text-violet-300" },
  { href: "/aviator", action: null,     icon: "rocket_launch",          label: "Aviator", color: "bg-orange-500/20 text-orange-300" },
  { href: null,       action: "casino", icon: "casino",                 label: "Casino",  color: "bg-blue-500/20 text-blue-300" },
  { href: "/p2p",     action: null,     icon: "swap_horiz",             label: "P2P",     color: "bg-emerald-500/20 text-emerald-300" },
  { href: "/binary",  action: null,     icon: "candlestick_chart",      label: "Binary",  color: "bg-sky-500/20 text-sky-300" },
  { href: null,       action: "wallet", icon: "account_balance_wallet", label: "Wallet",  color: "bg-amber-500/20 text-amber-300" },
];

function MobileDashboard() {
  const { openWallet } = useAuthModal();

  return (
    <div className="md:hidden">
      {/* ── Hero ── */}
      <MobileHeroCarousel slides={BG_IMAGES} />

      {/* ── Quick nav ── */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-4">
        {QUICK_NAV.map((item) => {
          // Shared tile styling — includes a focus-visible ring so keyboard and
          // switch-control users can see which shortcut is focused.
          const tile =
            "group flex shrink-0 flex-col items-center gap-1.5 rounded-2xl outline-none " +
            "focus-visible:ring-2 focus-visible:ring-primary-fixed/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
          const inner = (
            <>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color} ring-1 ring-white/10 transition-transform duration-fast group-hover:scale-105 group-active:scale-95`}>
                <Icon name={item.icon} fill className="text-[22px]" />
              </span>
              <span className="text-[10px] font-black text-white/60">{item.label}</span>
            </>
          );
          if (item.action === "wallet") {
            return (
              <button key={item.label} type="button" onClick={openWallet} aria-label={item.label} className={tile}>
                {inner}
              </button>
            );
          }
          if (item.action === "casino") {
            return (
              <button key={item.label} type="button" onClick={() => toast.info("Coming soon", "Casino lobby launching soon! 🎰")} aria-label={item.label} className={tile}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={item.label} href={item.href!} prefetch={false} aria-label={item.label} className={tile}>
              {inner}
            </Link>
          );
        })}
      </div>

      {/* ── Aviator banner ── */}
      <div className="px-4">
        <Link
          href="/aviator"
          prefetch={false}
          className="flex min-h-[190px] items-end overflow-hidden rounded-3xl bg-cover bg-center p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ backgroundImage: `linear-gradient(135deg, rgba(20,8,4,.95) 0%, rgba(20,8,4,.6) 60%, rgba(20,8,4,.2) 100%), url(${AVIATOR_BANNER})` }}
        >
          <div className="flex w-full items-end justify-between">
            <div>
              <div className="mb-2.5 flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent-casino motion-reduce:animate-none" />
                <span className="text-[10px] font-black uppercase tracking-widest text-accent-casino">Live now</span>
              </div>
              <h2 className="text-[32px] font-black leading-none">Aviator</h2>
              <p className="mt-1.5 text-[12px] text-white/60">Cash out before it flies away</p>
              <span className="mt-4 inline-block rounded-2xl bg-accent-casino px-5 py-2 text-[12px] font-black text-white shadow-lg shadow-accent-casino/30">
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
