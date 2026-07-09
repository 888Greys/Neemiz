"use client";

import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { MobileHeroCarousel } from "@/components/mobile-hero-carousel";
import { HeroSection } from "@/components/hero-section";
import { TrendingMatchCarousel } from "@/components/trending-match-carousel";
import { useAuthModal } from "@/lib/auth-modal-context";

const AVIATOR_BANNER =
  "https://v3.bundlecdn.com/b02632/plain/casino/game-of-the-week.1/mobile.png";

const BG_IMAGES = [
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg1.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg2.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg3.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg4.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg5.avif",
  "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg6.avif",
];

export default function DashboardPage() {
  return (
    <AppShell hideSidebar={false}>
      <div className="md:hidden">
        <MobileDashboard />
      </div>

      <div className="hidden md:block">
        <HeroSection />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 pb-8 md:px-6 md:pb-14">
        <div className="hidden md:block md:pt-8">
          <LivePulseBar />
        </div>
        <FeaturedArena />
        <ProductMosaic />
        <div className="mt-6 md:mt-10">
          <TrendingMatchCarousel />
        </div>
        <TradeRail />
      </div>
    </AppShell>
  );
}

/* ── Shared: live pulse ───────────────────────────────── */

function LivePulseBar() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-gradient-to-r from-white/[0.04] via-violet-500/[0.06] to-amber-500/[0.04] px-4 py-3">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/70">
        Live now
      </p>
      <span className="hidden h-3 w-px bg-white/10 sm:block" />
      <p className="text-[13px] font-semibold text-white/45">
        Sports · Aviator · Binary · Forex · Predictions · P2P — all open
      </p>
    </div>
  );
}

/* ── Featured arena: Aviator + Sports ─────────────────── */

function FeaturedArena() {
  return (
    <section className="mt-5 grid gap-3 md:mt-0 md:grid-cols-5 md:gap-4">
      <Link
        href="/aviator"
        prefetch={false}
        className="group relative min-h-[210px] overflow-hidden rounded-[28px] md:col-span-3 md:min-h-[280px]"
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
          style={{
            backgroundImage: `linear-gradient(125deg, rgba(18,6,2,.96) 0%, rgba(40,12,4,.72) 45%, rgba(12,8,4,.35) 100%), url(${AVIATOR_BANNER})`,
          }}
        />
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl transition group-hover:bg-orange-400/30" />
        <div className="relative flex h-full flex-col justify-between p-5 md:p-7">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff1979] motion-reduce:animate-none" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff1979]">
              Crash · Live
            </span>
          </div>
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[40px] font-black leading-none tracking-tight text-white md:text-5xl">
                  Aviator
                </h2>
                <p className="mt-2 max-w-[240px] text-[13px] font-medium text-white/55">
                  Ride the multiplier. Cash out before it flies away.
                </p>
              </div>
              <Icon
                name="rocket_launch"
                fill
                className="text-[72px] text-orange-400/70 drop-shadow-lg transition duration-500 group-hover:-translate-y-2 group-hover:translate-x-1 md:text-[96px]"
              />
            </div>
            <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#ff1979] px-5 py-2.5 text-[12px] font-black text-white shadow-lg shadow-[#ff1979]/30 transition group-hover:bg-[#ff3a8d]">
              Play now
              <Icon name="arrow_forward" className="text-[16px]" />
            </span>
          </div>
        </div>
      </Link>

      <Link
        href="/sports"
        prefetch={false}
        className="group relative min-h-[190px] overflow-hidden rounded-[28px] bg-[#12131a] ring-1 ring-white/[0.07] md:col-span-2 md:min-h-[280px]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(8,124,255,0.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-5 md:p-7">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/20">
              <Icon name="sports_soccer" fill className="text-[22px]" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300/80">
              Sportsbook
            </p>
            <h2 className="mt-2 text-[28px] font-black leading-none text-white md:text-[34px]">
              Live odds.
              <br />
              Real matches.
            </h2>
            <p className="mt-3 text-[13px] font-medium leading-5 text-white/45">
              Football, basketball, and in-play markets — bet before the whistle.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 text-[12px] font-black text-white/80 transition group-hover:text-white">
            Open sportsbook
            <Icon name="chevron_right" className="text-[16px] transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </section>
  );
}

/* ── Product mosaic ───────────────────────────────────── */

const PRODUCTS = [
  {
    href: "/binary",
    icon: "candlestick_chart",
    label: "Binary",
    blurb: "Digit contracts & live charts",
    accent: "from-sky-500/25 to-cyan-500/5",
    iconColor: "text-sky-300",
    ring: "ring-sky-400/15",
    chip: "Trade",
  },
  {
    href: "/forex",
    icon: "currency_exchange",
    label: "Forex",
    blurb: "Pairs, candles, order ticket",
    accent: "from-teal-500/25 to-emerald-500/5",
    iconColor: "text-teal-300",
    ring: "ring-teal-400/15",
    chip: "FX",
  },
  {
    href: "/predictions",
    icon: "online_prediction",
    label: "Predictions",
    blurb: "Yes / No markets, live probs",
    accent: "from-fuchsia-500/25 to-violet-500/5",
    iconColor: "text-fuchsia-300",
    ring: "ring-fuchsia-400/15",
    chip: "Markets",
  },
  {
    href: "/p2p",
    icon: "swap_horiz",
    label: "P2P",
    blurb: "Buy & sell with escrow",
    accent: "from-emerald-500/25 to-lime-500/5",
    iconColor: "text-emerald-300",
    ring: "ring-emerald-400/15",
    chip: "Trade",
  },
] as const;

function ProductMosaic() {
  return (
    <section className="mt-6 md:mt-8">
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-base font-black text-white md:text-xl">Explore the platform</h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/40">
            Everything below is live — tap in and go.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {PRODUCTS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            prefetch={false}
            className={`group relative overflow-hidden rounded-[24px] bg-gradient-to-br ${p.accent} p-4 ring-1 ${p.ring} transition hover:-translate-y-0.5 hover:bg-white/[0.03] active:scale-[0.98] md:p-5`}
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/[0.04] blur-2xl transition group-hover:bg-white/[0.07]" />
            <div className="relative">
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-black/25 ${p.iconColor} ring-1 ring-white/10`}
                >
                  <Icon name={p.icon} fill className="text-[22px]" />
                </span>
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/45">
                  {p.chip}
                </span>
              </div>
              <h3 className="mt-4 text-[17px] font-black text-white md:text-lg">{p.label}</h3>
              <p className="mt-1 text-[11px] font-medium leading-4 text-white/45 md:text-[12px] md:leading-5">
                {p.blurb}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-white/55 transition group-hover:text-white">
                Open
                <Icon name="arrow_forward" className="text-[14px] transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Trade rail: wallet + my bets ─────────────────────── */

function TradeRail() {
  const { openWallet } = useAuthModal();

  return (
    <section className="mt-6 grid gap-3 md:mt-10 md:grid-cols-2">
      <button
        type="button"
        onClick={openWallet}
        className="group flex items-center gap-4 overflow-hidden rounded-[24px] bg-gradient-to-r from-amber-500/15 via-[#16171d] to-[#16171d] p-4 text-left ring-1 ring-amber-400/15 transition hover:ring-amber-400/30 md:p-5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/20">
          <Icon name="account_balance_wallet" fill className="text-[24px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-black text-white">Smart Wallet</h3>
          <p className="mt-0.5 text-[12px] font-medium text-white/45">
            Deposit, withdraw, send — M-Pesa & crypto
          </p>
        </div>
        <Icon name="chevron_right" className="text-[20px] text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
      </button>

      <Link
        href="/my-bets"
        prefetch={false}
        className="group flex items-center gap-4 overflow-hidden rounded-[24px] bg-gradient-to-r from-blue-500/15 via-[#16171d] to-[#16171d] p-4 ring-1 ring-blue-400/15 transition hover:ring-blue-400/30 md:p-5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/20">
          <Icon name="receipt_long" fill className="text-[24px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-black text-white">My bets</h3>
          <p className="mt-0.5 text-[12px] font-medium text-white/45">
            Sports, binary, forex & predictions in one place
          </p>
        </div>
        <Icon name="chevron_right" className="text-[20px] text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/60" />
      </Link>
    </section>
  );
}

/* ── Mobile top ───────────────────────────────────────── */

const QUICK_NAV = [
  { href: "/sports", action: null as null | "wallet", icon: "sports_soccer", label: "Sports", color: "bg-violet-500/20 text-violet-300" },
  { href: "/aviator", action: null, icon: "rocket_launch", label: "Aviator", color: "bg-orange-500/20 text-orange-300" },
  { href: "/binary", action: null, icon: "candlestick_chart", label: "Binary", color: "bg-sky-500/20 text-sky-300" },
  { href: "/predictions", action: null, icon: "online_prediction", label: "Predict", color: "bg-fuchsia-500/20 text-fuchsia-300" },
  { href: "/p2p", action: null, icon: "swap_horiz", label: "P2P", color: "bg-emerald-500/20 text-emerald-300" },
  { href: "/forex", action: null, icon: "currency_exchange", label: "Forex", color: "bg-teal-500/20 text-teal-300" },
  { href: null, action: "wallet" as const, icon: "account_balance_wallet", label: "Wallet", color: "bg-amber-500/20 text-amber-300" },
];

function MobileDashboard() {
  const { openWallet } = useAuthModal();

  return (
    <div className="md:hidden">
      <MobileHeroCarousel slides={BG_IMAGES} />

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-4">
        {QUICK_NAV.map((item) => {
          const tile =
            "group flex shrink-0 flex-col items-center gap-1.5 rounded-2xl outline-none " +
            "focus-visible:ring-2 focus-visible:ring-primary-fixed/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
          const inner = (
            <>
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color} ring-1 ring-white/10 transition-transform duration-fast group-hover:scale-105 group-active:scale-95`}
              >
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
          return (
            <Link key={item.label} href={item.href!} prefetch={false} aria-label={item.label} className={tile}>
              {inner}
            </Link>
          );
        })}
      </div>

      <div className="px-4 pb-1">
        <LivePulseBar />
      </div>
    </div>
  );
}
