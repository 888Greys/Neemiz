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

const INTERVAL = 2250;
const BG_IMAGES = ["https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg1.avif", "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg2.avif", "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg3.avif", "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg4.avif", "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg5.avif", "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev/hero/bg6.avif"];
const BG_INTERVAL = 5000;

/* ── Hero Section ─────────────────────────────────────── */
export function HeroSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [bgIndex, setBgIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so interval callbacks always read the latest value without stale closure
  const isHoveredRef = useRef(false);

  const startCycle = (tab: number) => {
    // clear existing
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);

    setProgress(0);
    const step = 100 / (INTERVAL / 50);
    progressRef.current = setInterval(() => {
      if (isHoveredRef.current) return; // paused on hover
      setProgress((p) => Math.min(p + step, 100));
    }, 50);

    timerRef.current = setInterval(() => {
      if (isHoveredRef.current) return; // paused on hover
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

  useEffect(() => {
    if (isHovered) {
      if (bgTimerRef.current) clearInterval(bgTimerRef.current);
      return;
    }
    bgTimerRef.current = setInterval(() => {
      setBgIndex((i) => (i + 1) % BG_IMAGES.length);
    }, BG_INTERVAL);
    return () => {
      if (bgTimerRef.current) clearInterval(bgTimerRef.current);
    };
  }, [isHovered]);

  const handleTabClick = (i: number) => {
    setVisible(false);
    setTimeout(() => {
      setActiveTab(i);
      setVisible(true);
      startCycle(i);
    }, 150);
  };

  return (
    <section
      className="relative overflow-hidden min-h-[calc(100vh-64px)] flex flex-col justify-center"
      onMouseEnter={() => { isHoveredRef.current = true;  setIsHovered(true); }}
      onMouseLeave={() => { isHoveredRef.current = false; setIsHovered(false); }}
    >
      {/* Background image carousel */}
      <div className="pointer-events-none absolute inset-0">
        {BG_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url(${src})`,
              opacity: i === bgIndex ? 1 : 0,
            }}
          />
        ))}
        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 bg-black/60" />
        {/* Subtle bottom fade into page */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d0e12] to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-6 py-12 xl:py-16">
        <div className="grid items-center gap-10">

          {/* ── Left ── */}
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Platform is live · 6 products
            </div>

            <h1 className="text-5xl font-black uppercase leading-[.92] tracking-tight text-white xl:text-7xl 2xl:text-8xl">
              One platform.
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-white to-amber-400 bg-clip-text text-transparent">
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
                prefetch={false}
                className="rounded-2xl bg-white px-8 py-3.5 text-base font-black text-black transition hover:bg-white/90 active:scale-[.98]"
              >
                Get started
              </Link>
              <Link
                href="/aviator"
                prefetch={false}
                className="rounded-2xl border border-white/15 bg-white/8 px-8 py-3.5 text-base font-black text-white transition hover:bg-white/12"
              >
                Play Aviator
              </Link>
            </div>
          </div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {/* Progress bar for active tab cycling */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-[#087cff] transition-none"
        style={{ width: `${progress}%` }}
      />
    </section>
  );
}
