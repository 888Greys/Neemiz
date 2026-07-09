"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

type HeroSlide = {
  href: string;
  title: string;
  tag: string;
  blurb: string;
  cta: string;
  icon: string;
  accent: string;
  glow: string;
  gradient: string;
  image?: string;
};

const SLIDES: HeroSlide[] = [
  {
    href: "/aviator",
    title: "Aviator",
    tag: "Featured · Crash",
    blurb: "Ride the multiplier. Cash out before it flies away.",
    cta: "Play now",
    icon: "rocket_launch",
    accent: "#ff1979",
    glow: "bg-orange-500/20",
    gradient:
      "linear-gradient(125deg, rgba(18,6,2,.94) 0%, rgba(40,12,4,.7) 42%, rgba(12,8,4,.28) 100%)",
    image: "https://v3.bundlecdn.com/b02632/plain/casino/game-of-the-week.1/mobile.png",
  },
  {
    href: "/sports",
    title: "Sports",
    tag: "Sportsbook · Live",
    blurb: "Football, basketball, and in-play markets — bet before the whistle.",
    cta: "Open sportsbook",
    icon: "sports_soccer",
    accent: "#a78bfa",
    glow: "bg-violet-500/25",
    gradient:
      "radial-gradient(ellipse at top right, rgba(139,92,246,.45), transparent 55%), radial-gradient(ellipse at bottom left, rgba(8,124,255,.22), transparent 50%), linear-gradient(160deg, #0c0d14 0%, #16122a 55%, #0d0e12 100%)",
  },
  {
    href: "/binary",
    title: "Binary",
    tag: "Trade · Digits",
    blurb: "Digit contracts and live charts — call the next tick.",
    cta: "Start trading",
    icon: "candlestick_chart",
    accent: "#38bdf8",
    glow: "bg-sky-500/25",
    gradient:
      "radial-gradient(ellipse at top right, rgba(14,165,233,.4), transparent 55%), linear-gradient(160deg, #071018 0%, #0c1a24 55%, #0d0e12 100%)",
  },
  {
    href: "/forex",
    title: "Forex",
    tag: "FX · Markets",
    blurb: "Pairs, candles, and an order ticket built for quick entries.",
    cta: "Open forex",
    icon: "currency_exchange",
    accent: "#2dd4bf",
    glow: "bg-teal-500/25",
    gradient:
      "radial-gradient(ellipse at top right, rgba(20,184,166,.38), transparent 55%), linear-gradient(160deg, #061412 0%, #0c1f1c 55%, #0d0e12 100%)",
  },
  {
    href: "/predictions",
    title: "Predictions",
    tag: "Yes / No · Live",
    blurb: "Trade outcomes on live markets with clear probabilities.",
    cta: "Browse markets",
    icon: "online_prediction",
    accent: "#e879f9",
    glow: "bg-fuchsia-500/25",
    gradient:
      "radial-gradient(ellipse at top right, rgba(217,70,239,.38), transparent 55%), linear-gradient(160deg, #120814 0%, #1a1024 55%, #0d0e12 100%)",
  },
  {
    href: "/p2p",
    title: "P2P",
    tag: "Escrow · Trade",
    blurb: "Buy and sell peer-to-peer with escrow protection.",
    cta: "Open P2P",
    icon: "swap_horiz",
    accent: "#34d399",
    glow: "bg-emerald-500/25",
    gradient:
      "radial-gradient(ellipse at top right, rgba(16,185,129,.38), transparent 55%), linear-gradient(160deg, #06140e 0%, #0c1f16 55%, #0d0e12 100%)",
  },
];

/** Full-bleed product carousel — one game per slide, auto-rotates. */
export function HeroSection({ compact = false }: { compact?: boolean } = {}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = SLIDES[index]!;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <section
      className={`group relative overflow-hidden ${
        compact
          ? "min-h-[58vw] max-h-[380px] rounded-b-3xl"
          : "min-h-[min(72vh,720px)]"
      }`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Backgrounds — crossfade */}
      {SLIDES.map((s, i) => (
        <div
          key={s.href}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            opacity: i === index ? 1 : 0,
            backgroundImage: s.image
              ? `${s.gradient}, url(${s.image})`
              : s.gradient,
          }}
        />
      ))}

      <div
        className={`absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl transition duration-700 ${slide.glow}`}
      />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#0d0e12] to-transparent" />

      <div
        key={slide.href}
        className={`animate-fade-up relative z-10 flex h-full flex-col justify-end ${
          compact
            ? "px-5 pb-9 pt-14"
            : "mx-auto w-full max-w-[1600px] px-6 py-16 xl:px-8 xl:py-20"
        }`}
        style={{ animationDuration: "0.4s" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 animate-pulse rounded-full motion-reduce:animate-none"
            style={{ backgroundColor: slide.accent }}
          />
          <span
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: slide.accent }}
          >
            {slide.tag}
          </span>
        </div>

        <div className={`mt-4 flex items-end justify-between gap-6 ${compact ? "" : "max-w-3xl"}`}>
          <div>
            <h1
              className={`font-black leading-none tracking-tight text-white ${
                compact ? "text-[42px]" : "text-6xl xl:text-7xl 2xl:text-8xl"
              }`}
            >
              {slide.title}
            </h1>
            <p
              className={`mt-3 font-medium text-white/55 ${
                compact ? "max-w-[240px] text-[13px]" : "max-w-md text-base xl:text-lg"
              }`}
            >
              {slide.blurb}
            </p>
          </div>
          {!compact && (
            <span
              className="hidden shrink-0 drop-shadow-lg transition duration-500 group-hover:-translate-y-2 group-hover:translate-x-1 xl:block"
              style={{ color: `${slide.accent}99` }}
            >
              <Icon name={slide.icon} fill className="text-[120px]" />
            </span>
          )}
        </div>

        <div className={`mt-6 flex flex-wrap items-center gap-3 ${compact ? "" : "mt-8"}`}>
          <Link
            href={slide.href}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[13px] font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] xl:px-8 xl:py-3.5 xl:text-base"
            style={{
              backgroundColor: slide.accent,
              boxShadow: `0 12px 28px ${slide.accent}4d`,
            }}
          >
            {slide.cta}
            <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        </div>
      </div>

      {/* Dots */}
      <div
        className={`absolute z-20 flex gap-1.5 ${
          compact ? "bottom-3 right-4" : "bottom-8 right-8 xl:bottom-10 xl:right-10"
        }`}
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.href}
            type="button"
            aria-label={`Show ${s.title}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
              i === index ? "w-5 bg-white" : "w-1.5 bg-white/25 hover:bg-white/45"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
