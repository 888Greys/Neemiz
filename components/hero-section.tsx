"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

/* ── Laurel wreath ────────────────────────────────────── */
function LaurelWreath({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="36" height="64" viewBox="0 0 36 64"
      fill="currentColor"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {/* 6 leaf pairs curving along an arc */}
      <ellipse cx="26" cy="7"  rx="9" ry="3.5" transform="rotate(-45 26 7)"  opacity="0.95" />
      <ellipse cx="17" cy="14" rx="9" ry="3.5" transform="rotate(-62 17 14)" opacity="0.88" />
      <ellipse cx="11" cy="24" rx="9" ry="3.5" transform="rotate(-82 11 24)" opacity="0.82" />
      <ellipse cx="11" cy="35" rx="9" ry="3.5" transform="rotate(-98 11 35)" opacity="0.82" />
      <ellipse cx="17" cy="46" rx="9" ry="3.5" transform="rotate(-115 17 46)" opacity="0.88" />
      <ellipse cx="26" cy="54" rx="9" ry="3.5" transform="rotate(-132 26 54)" opacity="0.95" />
      {/* Stem dot */}
      <circle cx="32" cy="31" r="2.5" opacity="0.5" />
    </svg>
  );
}

function LaurelBadge({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 text-amber-400">
      <LaurelWreath />
      <div className="text-center">
        <div className="text-xl font-black leading-none">{title}</div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-amber-400/65">{subtitle}</div>
      </div>
      <LaurelWreath flip />
    </div>
  );
}

/* ── Right panel data ─────────────────────────────────── */
const panelTabs = ["Live Sports", "Markets", "Trading"];

const liveMatches = [
  { home: "Arsenal", away: "Chelsea", score: "2 – 1", time: "62'", odds: "1.45", league: "Premier League", up: true },
  { home: "Barcelona", away: "Sevilla", score: "1 – 0", time: "72'", odds: "1.62", league: "La Liga", up: false },
  { home: "Man City", away: "Liverpool", score: "0 – 0", time: "34'", odds: "2.10", league: "Premier League", up: true },
  { home: "Juventus", away: "AC Milan", score: "0 – 0", time: "12'", odds: "2.60", league: "Serie A", up: true },
];

const marketData = [
  { title: "BTC hits $100k?", yes: 68, volume: "$4.2M", change: "+2.3%" },
  { title: "Arsenal win league?", yes: 37, volume: "$980K", change: "-1.2%" },
  { title: "US Election winner", yes: 45, volume: "$12.8M", change: "+0.8%" },
  { title: "Fed rate cut in Q3?", yes: 71, volume: "$2.1M", change: "+4.1%" },
];

const tradingPairs = [
  { pair: "EUR/USD", price: "1.08452", change: "+0.012%", up: true },
  { pair: "GBP/JPY", price: "189.234", change: "-0.034%", up: false },
  { pair: "BTC/USD", price: "81,294.91", change: "+2.80%", up: true },
  { pair: "XRP/USD", price: "1.47", change: "+3.98%", up: true },
];

const INTERVAL = 4500;

/* ── Hero Section ─────────────────────────────────────── */
export function HeroSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCycle = (tab: number) => {
    // clear existing
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);

    setProgress(0);
    const step = 100 / (INTERVAL / 50);
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + step, 100));
    }, 50);

    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveTab((t) => {
          const next = (t + 1) % panelTabs.length;
          return next;
        });
        setProgress(0);
        setVisible(true);
      }, 250);
    }, INTERVAL);
  };

  useEffect(() => {
    startCycle(0);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabClick = (i: number) => {
    setVisible(false);
    setTimeout(() => {
      setActiveTab(i);
      setVisible(true);
      startCycle(i);
    }, 150);
  };

  return (
    <section className="relative overflow-hidden">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -bottom-24 right-1/3 h-[400px] w-[400px] rounded-full bg-amber-500/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-6 py-12 xl:py-16">
        <div className="grid items-center gap-10 xl:grid-cols-[1fr_420px] 2xl:grid-cols-[1fr_480px]">

          {/* ── Left ── */}
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Platform is live · 6 products
            </div>

            <h1 className="text-5xl font-black uppercase leading-[.92] tracking-tight xl:text-7xl 2xl:text-8xl">
              <span className="hero-white-sheen">One platform.</span>
              <br />
              <span className="hero-gradient-glow">
                Six markets.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400 xl:text-lg xl:leading-8">
              Sports betting, Aviator, Polymarket predictions, P2P trading, Binary &amp; Forex, and a Smart Wallet — built into one seamless experience.
            </p>

            {/* Laurel badges — mobile only (desktop shows them inside the right panel) */}
            <div className="mt-7 flex flex-wrap gap-6 xl:hidden">
              <LaurelBadge title="No.1" subtitle="Betting Platform" />
              <LaurelBadge title="No.1" subtitle="Trading Volume" />
            </div>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/sports"
                className="rounded-2xl bg-white px-8 py-3.5 text-base font-black text-black transition hover:bg-white/90 active:scale-[.98]"
              >
                Get started
              </Link>
              <Link
                href="/aviator"
                className="rounded-2xl border border-white/15 bg-white/8 px-8 py-3.5 text-base font-black text-white transition hover:bg-white/12"
              >
                Play Aviator
              </Link>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e0f12] xl:block">
            {/* Tabs + progress */}
            <div className="px-5 pt-4">
              <div className="flex items-center gap-1">
                {panelTabs.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(i)}
                    type="button"
                    className={`relative px-3 py-2 text-sm font-black transition-colors ${
                      activeTab === i ? "text-white" : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {tab}
                    {/* progress bar under active tab */}
                    {activeTab === i && (
                      <div className="absolute bottom-0 left-0 h-[2px] rounded-full bg-amber-400 transition-none" style={{ width: `${progress}%` }} />
                    )}
                  </button>
                ))}
                <Link
                  href={activeTab === 0 ? "/sports" : activeTab === 1 ? "/predictions" : "/binary"}
                  className="ml-auto text-xs font-black text-slate-600 transition hover:text-slate-300"
                >
                  View all →
                </Link>
              </div>
              <div className="mt-1 h-px bg-white/[0.06]" />
            </div>

            {/* Panel body — fade on tab switch */}
            <div
              className="divide-y divide-white/[0.04] transition-opacity duration-200"
              style={{ opacity: visible ? 1 : 0 }}
            >
              {activeTab === 0 && liveMatches.map((m) => (
                <Link key={m.home} href="/sports"
                  className="group flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  {/* Left accent */}
                  <div className="h-8 w-[3px] shrink-0 rounded-full bg-[#ff1979]/60 group-hover:bg-[#ff1979]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-black text-white">
                      {m.home}
                      <span className="text-[10px] font-bold text-slate-600">VS</span>
                      {m.away}
                    </div>
                    <div className="text-[11px] text-slate-600">{m.league} · {m.time}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-300">{m.score}</span>
                    <span className={`min-w-[38px] rounded-lg px-2 py-1 text-center text-xs font-black ${m.up ? "bg-emerald-500/12 text-emerald-400" : "bg-red-500/12 text-red-400"}`}>
                      {m.odds}
                    </span>
                  </div>
                </Link>
              ))}

              {activeTab === 1 && marketData.map((m) => (
                <Link key={m.title} href="/predictions"
                  className="group flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div className="h-8 w-[3px] shrink-0 rounded-full bg-violet-500/60 group-hover:bg-violet-400" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-black text-white">{m.title}</div>
                    <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="bg-emerald-500 transition-all" style={{ width: `${m.yes}%` }} />
                      <div className="bg-red-500 transition-all" style={{ width: `${100 - m.yes}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-emerald-400">{m.yes}% YES</div>
                    <div className={`text-[11px] font-bold ${m.change.startsWith("+") ? "text-emerald-500" : "text-red-500"}`}>{m.change}</div>
                  </div>
                </Link>
              ))}

              {activeTab === 2 && tradingPairs.map((t) => (
                <Link key={t.pair} href="/binary"
                  className="group flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div className={`h-8 w-[3px] shrink-0 rounded-full ${t.up ? "bg-emerald-500/60 group-hover:bg-emerald-400" : "bg-red-500/60 group-hover:bg-red-400"}`} />
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.up ? "bg-emerald-500/12 text-emerald-400" : "bg-red-500/12 text-red-400"}`}>
                      <Icon name={t.up ? "trending_up" : "trending_down"} className="text-[16px]" />
                    </span>
                    <span className="text-sm font-black text-white">{t.pair}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-white">{t.price}</div>
                    <div className={`text-xs font-black ${t.up ? "text-emerald-400" : "text-red-400"}`}>{t.change}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Laurel badges */}
            <div className="flex items-center justify-around border-t border-white/[0.05] px-5 py-4">
              <LaurelBadge title="No.1" subtitle="Betting Platform" />
              <div className="h-8 w-px bg-white/[0.07]" />
              <LaurelBadge title="No.1" subtitle="Trading Volume" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
