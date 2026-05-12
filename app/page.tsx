"use client";

import { useState } from "react";
import Link from "next/link";

const products = [
  { icon: "⚽", label: "Sports Betting",  desc: "Live odds on 30+ sports. In-play markets updated in real time.", color: "from-violet-500/20 to-transparent", border: "rgba(139,92,246,0.25)" },
  { icon: "🚀", label: "Aviator",          desc: "Provably fair crash game. Cash out before the plane flies away.", color: "from-orange-500/20 to-transparent", border: "rgba(249,115,22,0.25)" },
  { icon: "🔮", label: "Predictions",      desc: "Polymarket-style markets. Trade YES/NO on real-world events.", color: "from-pink-500/20 to-transparent", border: "rgba(236,72,153,0.25)" },
  { icon: "🤝", label: "P2P Trading",      desc: "Buy and sell with real merchants. Escrow-protected every trade.", color: "from-emerald-500/20 to-transparent", border: "rgba(16,185,129,0.25)" },
  { icon: "📈", label: "Binary & Forex",   desc: "Up or down. Trade currency pairs with fixed risk, fixed reward.", color: "from-blue-500/20 to-transparent", border: "rgba(59,130,246,0.25)" },
  { icon: "💰", label: "Smart Wallet",     desc: "Multi-currency wallet. Deposit, withdraw, and transfer instantly.", color: "from-amber-500/20 to-transparent", border: "rgba(245,158,11,0.25)" },
];

const stats = [
  { value: "30+",   label: "Sports" },
  { value: "$2M+",  label: "Daily vol" },
  { value: "50K+",  label: "Players" },
  { value: "99.9%", label: "Uptime" },
];

const ticker = [
  { teams: "Real Madrid vs Man City", score: "2–1", time: "68'" },
  { teams: "Arsenal vs Chelsea",      score: "1–1", time: "45'" },
  { teams: "PSG vs Bayern",           score: "0–2", time: "72'" },
  { teams: "Liverpool vs Spurs",      score: "3–0", time: "88'" },
  { teams: "Barcelona vs Atlético",   score: "1–0", time: "34'" },
  { teams: "Dortmund vs Leipzig",     score: "2–2", time: "61'" },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) setSubmitted(true);
  }

  return (
    <div className="hero-bg noise min-h-screen text-white">

      {/* ── Navbar ── */}
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 md:px-10 md:py-4">
        <div className="glass rounded-full px-4 py-2 md:px-5 md:py-2.5">
          <span className="text-lg font-black tracking-tight text-white md:text-xl">
            NEEM<span className="gradient-text">IZ</span>
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/sign-in"
            className="glass rounded-full px-4 py-2 text-xs font-semibold text-white/80 transition hover:text-white md:px-5 md:text-sm"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500 md:px-5 md:text-sm"
          >
            Join waitlist
          </Link>
        </div>
      </nav>

      {/* ── Live ticker ── */}
      <div className="fixed left-0 right-0 top-[56px] z-40 overflow-hidden border-b border-white/5 bg-black/50 py-1.5 backdrop-blur-sm md:top-[68px]">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...ticker, ...ticker].map((item, i) => (
            <span key={i} className="mx-6 inline-flex items-center gap-2 text-[11px] md:mx-8 md:gap-3 md:text-xs">
              <span className="animate-live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-white/50">{item.teams}</span>
              <span className="font-mono font-bold text-white">{item.score}</span>
              <span className="font-mono text-red-400">{item.time}</span>
              <span className="ml-3 text-white/10">|</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 pb-16 pt-28 text-center md:min-h-screen md:px-6 md:pt-36 md:pb-24">

        {/* Orbs */}
        <div className="animate-orb pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[80px] md:h-96 md:w-96 md:blur-[100px]" />
        <div className="pointer-events-none absolute right-0 top-1/2 h-40 w-40 rounded-full bg-amber-500/10 blur-[60px] md:right-1/4 md:h-64 md:w-64 md:blur-[80px]" style={{ animation: "orb-move 15s ease-in-out infinite reverse" }} />

        {/* Badge */}
        <div className="animate-fade-up mb-5 md:mb-6" style={{ animationDelay: "0.1s" }}>
          <span className="glass-purple inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-300 md:px-4 md:text-xs">
            <span className="animate-live-dot h-1.5 w-1.5 rounded-full bg-violet-400" />
            Now in development · Launching soon
          </span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-up mx-auto mb-5 max-w-xs text-4xl font-black leading-[1.05] tracking-tight sm:max-w-lg sm:text-5xl md:mb-6 md:max-w-4xl md:text-7xl lg:text-8xl"
          style={{ animationDelay: "0.2s" }}
        >
          The Future of{" "}
          <span className="shimmer-text">Smart Betting</span>
          <br className="hidden sm:block" />
          {" "}is Almost Here
        </h1>

        {/* Subtext */}
        <p
          className="animate-fade-up mx-auto mb-8 max-w-sm text-sm text-white/50 md:mb-10 md:max-w-xl md:text-xl"
          style={{ animationDelay: "0.3s" }}
        >
          Sports · Aviator · P2P · Predictions · Forex — all in one platform. Built for serious players.
        </p>

        {/* CTA form */}
        <div className="animate-fade-up w-full max-w-sm px-1 md:max-w-md md:px-0" style={{ animationDelay: "0.4s" }}>
          {submitted ? (
            <div className="glass-purple rounded-2xl px-6 py-5 md:px-8 md:py-6">
              <div className="mb-2 text-3xl">🎉</div>
              <p className="font-bold text-violet-300">You&apos;re on the list!</p>
              <p className="mt-1 text-sm text-white/50">We&apos;ll hit you up the moment we launch.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass flex flex-col gap-2 overflow-hidden rounded-2xl p-2 sm:flex-row sm:gap-0 sm:p-1.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-white/30 transition"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-500 active:scale-95 sm:w-auto"
              >
                Notify me
              </button>
            </form>
          )}
          <p className="mt-3 text-[11px] text-white/25">No spam. Early access perks for waitlist members.</p>
        </div>

        {/* Stats */}
        <div
          className="animate-fade-up mt-8 grid grid-cols-4 gap-2 md:mt-16 md:gap-4"
          style={{ animationDelay: "0.5s" }}
        >
          {stats.map((s) => (
            <div key={s.label} className="stat-card rounded-xl px-3 py-3 text-center md:rounded-2xl md:px-6 md:py-4">
              <div className="font-mono text-lg font-black text-white md:text-2xl">{s.value}</div>
              <div className="mt-0.5 text-[10px] text-white/40 md:mt-1 md:text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll hint — hide on small screens */}
        <div className="animate-fade-in absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:flex" style={{ animationDelay: "1.2s" }}>
          <div className="flex flex-col items-center gap-2 text-white/20">
            <span className="text-xs uppercase tracking-widest">Explore</span>
            <div className="animate-float h-6 w-px bg-gradient-to-b from-white/20 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6 md:pb-32">
        <div className="mb-10 text-center md:mb-14">
          <h2 className="mb-2 text-2xl font-black md:mb-3 md:text-5xl">
            Everything in{" "}
            <span className="gradient-text">one place</span>
          </h2>
          <p className="text-sm text-white/40 md:text-base">Six products. One account. Zero switching.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {products.map((p, i) => (
            <div
              key={p.label}
              className="product-card animate-fade-up group relative overflow-hidden rounded-2xl p-4 md:p-6"
              style={{ animationDelay: `${0.1 + i * 0.08}s`, borderColor: p.border }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="relative">
                <div className="mb-3 text-3xl md:mb-4 md:text-4xl">{p.icon}</div>
                <h3 className="mb-1 text-sm font-bold text-white md:mb-2 md:text-lg">{p.label}</h3>
                <p className="hidden text-sm leading-relaxed text-white/45 sm:block">{p.desc}</p>
              </div>
              <div className="relative mt-4 flex items-center gap-1 text-xs font-bold text-white/25 transition-colors group-hover:text-violet-400 md:mt-6 md:gap-2">
                Coming soon
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden border-t border-white/5 px-5 py-20 text-center md:px-6 md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-900/10 to-transparent" />
        <div className="relative mx-auto max-w-2xl">
          <div className="mb-4 text-4xl md:mb-6 md:text-5xl" style={{ animation: "float-slow 8s ease-in-out infinite" }}>🏆</div>
          <h2 className="mb-3 text-2xl font-black md:mb-4 md:text-5xl">
            Get in early.{" "}
            <span className="gradient-text">Win big.</span>
          </h2>
          <p className="mb-8 text-sm text-white/40 md:mb-10 md:text-base">
            Waitlist members get boosted welcome bonuses, early access to all products, and founder-tier status.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-2xl shadow-violet-500/30 transition hover:from-violet-500 hover:to-indigo-500 active:scale-95 md:px-10 md:py-4 md:text-base"
          >
            Create your account →
          </Link>
          <p className="mt-4 text-[11px] text-white/25">Free to join · No credit card required</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-5 py-6 text-center text-xs text-white/20 md:px-6 md:py-8">
        <div className="mb-2 text-sm font-black tracking-tight text-white/40">
          NEEM<span className="text-violet-500">IZ</span>
        </div>
        <p>© 2025 Neemiz. All rights reserved.</p>
        <p className="mt-1">Play responsibly. 18+ only.</p>
      </footer>
    </div>
  );
}
