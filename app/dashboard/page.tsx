"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { TrendingMatchCarousel } from "@/components/trending-match-carousel";
import { useAuthModal } from "@/lib/auth-modal-context";
import { getTeamLogo } from "@/lib/team-logos";
import { useBetslip } from "@/lib/betslip-context";

export default function DashboardPage() {
  return (
    <AppShell hideSidebar={false}>
      <div className="md:hidden">
        <HeroSection compact />
      </div>

      <div className="hidden md:block">
        <HeroSection />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 pb-8 pt-5 md:px-6 md:pb-14 md:pt-8">
        <TrendingMatchCarousel />
        <div className="mt-6 md:mt-8">
          <LeagueStrip />
        </div>
        <div className="mt-6 md:mt-8">
          <FeaturedArena />
        </div>
        <div className="mt-6 md:mt-10">
          <TopPicks />
        </div>
        <ProductMosaic />
        <div className="mt-6 md:mt-10">
          <HowItFlows />
        </div>
        <TradeRail />
        <div className="mt-6 md:mt-10">
          <PromoStrip />
        </div>
      </div>
    </AppShell>
  );
}

/* ── Popular leagues (Fortuna-style quick nav) ────────── */

const LEAGUES = [
  { href: "/sports", flag: "un", label: "World Cup", sub: "FIFA 2026" },
  { href: "/sports", flag: "gb-eng", label: "EPL", sub: "England" },
  { href: "/sports", flag: "es", label: "La Liga", sub: "Spain" },
  { href: "/sports", flag: "de", label: "Bundesliga", sub: "Germany" },
  { href: "/sports", flag: "it", label: "Serie A", sub: "Italy" },
  { href: "/sports", flag: "fr", label: "Ligue 1", sub: "France" },
  { href: "/sports", flag: "eu", label: "UCL", sub: "Europe" },
  { href: "/sports", flag: "ke", label: "KPL", sub: "Kenya" },
] as const;

function LeagueStrip() {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-base font-black text-white md:text-xl">Popular leagues</h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/40">
            Jump straight into the markets people bet most
          </p>
        </div>
        <Link
          href="/sports"
          prefetch={false}
          className="mb-0.5 flex shrink-0 items-center gap-0.5 text-[12px] font-black text-white/45 transition hover:text-white"
        >
          All sports
          <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {LEAGUES.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            prefetch={false}
            className="group flex w-[88px] shrink-0 flex-col items-center gap-2 rounded-[22px] bg-white/[0.03] px-2 py-3.5 ring-1 ring-white/[0.07] transition hover:-translate-y-0.5 hover:bg-white/[0.06] hover:ring-white/15 active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-black/30 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/w80/${l.flag}.png`}
                alt=""
                className="h-7 w-7 object-contain"
              />
            </span>
            <span className="text-center">
              <span className="block text-[12px] font-black text-white">{l.label}</span>
              <span className="mt-0.5 block text-[10px] font-medium text-white/35">{l.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Featured arena: Binary + Sports ──────────────────── */

function FeaturedArena() {
  return (
    <section className="grid gap-3 md:grid-cols-5 md:gap-4">
      <Link
        href="/binary"
        prefetch={false}
        className="group relative min-h-[210px] overflow-hidden rounded-[28px] bg-[#0a1218] ring-1 ring-sky-400/15 md:col-span-3 md:min-h-[280px]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.32),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.14),transparent_50%)]" />
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl transition group-hover:bg-sky-400/30" />
        <div className="relative flex h-full flex-col justify-between p-5 md:p-7">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 motion-reduce:animate-none" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
              Trade · Digits
            </span>
          </div>
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-[40px] font-black leading-none tracking-tight text-white md:text-5xl">
                  Binary
                </h2>
                <p className="mt-2 max-w-[260px] text-[13px] font-medium text-white/55">
                  Digit contracts and live charts — call the next tick.
                </p>
              </div>
              <Icon
                name="candlestick_chart"
                fill
                className="text-[72px] text-sky-400/70 drop-shadow-lg transition duration-500 group-hover:-translate-y-2 group-hover:translate-x-1 md:text-[96px]"
              />
            </div>
            <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-2.5 text-[12px] font-black text-white shadow-lg shadow-sky-500/30 transition group-hover:bg-sky-400">
              Start trading
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

/* ── Top picks from real live / upcoming fixtures ─────── */

type LivePick = {
  id: string;
  league: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  market: string;
  label: string;
  value: string;
  tip: string;
  badge: string;
  href: string;
};

function TopPicks() {
  const { toggleBet, hasBet } = useBetslip();
  const [picks, setPicks] = useState<LivePick[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sports/live");
        if (!res.ok) return;
        const data: Array<{
          id: number;
          league: string;
          isLive: boolean;
          period: string;
          home: { name: string; logo?: string };
          away: { name: string; logo?: string };
          odds?: { label: string; value: string }[];
        }> = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        const next: LivePick[] = data.slice(0, 3).map((m) => {
          const odd = m.odds?.[0];
          return {
            id: `pick-${m.id}-${odd?.label ?? "open"}`,
            league: m.league,
            home: m.home.name,
            away: m.away.name,
            homeLogo: m.home.logo ?? getTeamLogo(m.home.name),
            awayLogo: m.away.logo ?? getTeamLogo(m.away.name),
            market: odd ? "Match result" : "Kickoff",
            label: odd?.label ?? "Open",
            value: odd?.value ?? m.period,
            tip: m.isLive ? `Live · ${m.period}` : `Starts ${m.period}`,
            badge: m.isLive ? "LIVE" : "UP NEXT",
            href: "/sports",
          };
        });
        setPicks(next);
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (picks.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-white md:text-xl">
            <Icon name="local_fire_department" fill className="text-[18px] text-orange-400" />
            Top picks
          </h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/40">
            Real fixtures from today — World Cup first when live
          </p>
        </div>
        <Link
          href="/sports"
          prefetch={false}
          className="mb-0.5 flex shrink-0 items-center gap-0.5 text-[12px] font-black text-white/45 transition hover:text-white"
        >
          More markets
          <Icon name="chevron_right" className="text-[14px]" />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {picks.map((p) => {
          const selected = hasBet(p.id);
          const canBet = p.label !== "Open" && /^\d/.test(p.value);
          return (
            <div
              key={p.id}
              className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4 ring-1 ring-white/[0.08]"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                    {p.league}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${
                      p.badge === "LIVE"
                        ? "bg-[#ff1979]/15 text-[#ff1979] ring-[#ff1979]/25"
                        : "bg-sky-500/15 text-sky-300 ring-sky-400/20"
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 ring-1 ring-white/10">
                    {p.homeLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.homeLogo} alt="" className="h-7 w-7 object-contain" />
                    ) : (
                      <Icon name="sports_soccer" className="text-[16px] text-white/30" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-white">
                      {p.home} <span className="text-white/30">vs</span> {p.away}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-white/40">
                      {p.market} · {p.tip}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 ring-1 ring-white/10">
                    {p.awayLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.awayLogo} alt="" className="h-7 w-7 object-contain" />
                    ) : (
                      <Icon name="sports_soccer" className="text-[16px] text-white/30" />
                    )}
                  </span>
                </div>

                {canBet ? (
                  <button
                    type="button"
                    onClick={() =>
                      toggleBet({
                        id: p.id,
                        matchName: `${p.home} vs ${p.away}`,
                        market: p.market,
                        label: p.label,
                        value: p.value,
                      })
                    }
                    className={`mt-4 flex w-full items-center justify-between rounded-2xl px-4 py-3 transition active:scale-[0.98] ${
                      selected
                        ? "bg-[#087cff]/25 ring-1 ring-[#087cff]/50"
                        : "bg-white/[0.06] ring-1 ring-white/[0.08] hover:bg-white/[0.1]"
                    }`}
                  >
                    <span className="text-[12px] font-bold text-white/50">
                      Selection <span className="text-white">{p.label}</span>
                    </span>
                    <span className={`text-lg font-black tabular-nums ${selected ? "text-[#6eb6ff]" : "text-white"}`}>
                      {p.value}
                    </span>
                  </button>
                ) : (
                  <Link
                    href={p.href}
                    prefetch={false}
                    className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1]"
                  >
                    <span className="text-[12px] font-bold text-white/50">{p.tip}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-black text-white">
                      Open sports
                      <Icon name="arrow_forward" className="text-[14px]" />
                    </span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Product mosaic ───────────────────────────────────── */

const PRODUCTS = [
  {
    href: "/aviator",
    icon: "rocket_launch",
    label: "Aviator",
    blurb: "Crash multipliers, cash out fast",
    accent: "from-orange-500/25 to-rose-500/5",
    iconColor: "text-orange-300",
    ring: "ring-orange-400/15",
    chip: "Crash",
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

/* ── How it flows ─────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    icon: "account_balance_wallet",
    title: "Fund wallet",
    blurb: "M-Pesa or crypto — balance ready in seconds.",
    color: "text-amber-300 bg-amber-500/15 ring-amber-400/20",
  },
  {
    n: "02",
    icon: "bolt",
    title: "Pick a market",
    blurb: "Sports, Aviator, Binary, Forex, Predictions, P2P.",
    color: "text-sky-300 bg-sky-500/15 ring-sky-400/20",
  },
  {
    n: "03",
    icon: "emoji_events",
    title: "Cash out",
    blurb: "Winnings land in the same Smart Wallet.",
    color: "text-emerald-300 bg-emerald-500/15 ring-emerald-400/20",
  },
] as const;

function HowItFlows() {
  return (
    <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#14161d] via-[#12141a] to-[#0e1015] p-5 ring-1 ring-white/[0.07] md:p-7">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white md:text-xl">From deposit to payout</h2>
          <p className="mt-0.5 text-[12px] font-medium text-white/40">
            One wallet across every product on Nezeem
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        {STEPS.map((s) => (
          <div key={s.n} className="relative rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
            <span className="absolute right-4 top-3 text-[28px] font-black leading-none text-white/[0.06]">
              {s.n}
            </span>
            <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${s.color}`}>
              <Icon name={s.icon} fill className="text-[22px]" />
            </span>
            <h3 className="text-[15px] font-black text-white">{s.title}</h3>
            <p className="mt-1 text-[12px] font-medium leading-5 text-white/45">{s.blurb}</p>
          </div>
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

/* ── Closing promo before footer ──────────────────────── */

function PromoStrip() {
  const { openWallet } = useAuthModal();

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#0f1117] ring-1 ring-white/[0.08]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(5,185,87,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(8,124,255,0.14),transparent_50%)]" />
      <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-7">
        <div className="max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">
            Ready when you are
          </p>
          <h2 className="mt-2 text-[26px] font-black leading-none tracking-tight text-white md:text-[34px]">
            One balance.
            <br />
            Every market.
          </h2>
          <p className="mt-3 text-[13px] font-medium text-white/50">
            Deposit once, then move between sports, crash, trade, and P2P without switching wallets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={openWallet}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#05b957] px-5 py-3 text-[13px] font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#06c960] active:scale-[0.98]"
          >
            Deposit now
            <Icon name="arrow_forward" className="text-[16px]" />
          </button>
          <Link
            href="/sports"
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-[13px] font-black text-white/85 backdrop-blur-sm transition hover:bg-white/10"
          >
            Browse sports
          </Link>
        </div>
      </div>
    </section>
  );
}
