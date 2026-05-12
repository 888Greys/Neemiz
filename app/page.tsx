"use client";

import { useState } from "react";
import Link from "next/link";

const products = [
  {
    icon: "⚽",
    label: "Sports Betting",
    desc: "Live odds on 30+ sports. In-play markets updated in real time.",
    color: "from-violet-500/20 to-transparent",
    border: "rgba(139,92,246,0.25)",
  },
  {
    icon: "🚀",
    label: "Aviator",
    desc: "Provably fair crash game. Cash out before the plane flies away.",
    color: "from-orange-500/20 to-transparent",
    border: "rgba(249,115,22,0.25)",
  },
  {
    icon: "🔮",
    label: "Predictions",
    desc: "Polymarket-style markets. Trade YES/NO on real-world events.",
    color: "from-pink-500/20 to-transparent",
    border: "rgba(236,72,153,0.25)",
  },
  {
    icon: "🤝",
    label: "P2P Trading",
    desc: "Buy and sell with real merchants. Escrow-protected every trade.",
    color: "from-emerald-500/20 to-transparent",
    border: "rgba(16,185,129,0.25)",
  },
  {
    icon: "📈",
    label: "Binary & Forex",
    desc: "Up or down. Trade currency pairs with fixed risk, fixed reward.",
    color: "from-blue-500/20 to-transparent",
    border: "rgba(59,130,246,0.25)",
  },
  {
    icon: "💰",
    label: "Smart Wallet",
    desc: "Multi-currency wallet. Deposit, withdraw, and transfer instantly.",
    color: "from-amber-500/20 to-transparent",
    border: "rgba(245,158,11,0.25)",
  },
];

const stats = [
  { value: "30+", label: "Sports covered" },
  { value: "$2M+", label: "Daily volume" },
  { value: "50K+", label: "Players ready" },
  { value: "99.9%", label: "Uptime SLA" },
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

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 md:px-10">
        <div className="glass rounded-full px-5 py-2.5">
          <span className="text-xl font-black tracking-tight text-white">
            NEEM<span className="gradient-text">IZ</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="glass rounded-full px-5 py-2 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500"
          >
            Get early access
          </Link>
        </div>
      </nav>

      {/* ── Live ticker ─────────────────────────────────────── */}
      <div className="fixed left-0 right-0 top-[68px] z-40 overflow-hidden border-b border-white/5 bg-black/40 py-2 backdrop-blur-sm">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...ticker, ...ticker].map((item, i) => (
            <span key={i} className="mx-8 inline-flex items-center gap-3 text-xs">
              <span className="animate-live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-white/50">{item.teams}</span>
              <span className="font-mono font-bold text-white">{item.score}</span>
              <span className="font-mono text-red-400">{item.time}</span>
              <span className="ml-4 text-white/10">|</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-36 pb-24 text-center">

        {/* Background orbs */}
        <div className="animate-orb pointer-events-none absolute left-1/4 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[100px]" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]" style={{ animation: "orb-move 15s ease-in-out infinite reverse" }} />
        <div className="pointer-events-none absolute bottom-1/4 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[60px]" style={{ animation: "orb-move 10s ease-in-out infinite 3s" }} />

        {/* Badge */}
        <div className="animate-fade-up mb-6" style={{ animationDelay: "0.1s" }}>
          <span className="glass-purple inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-300">
            <span className="animate-live-dot h-1.5 w-1.5 rounded-full bg-violet-400" />
            Now in development · Launching soon
          </span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-up mx-auto mb-6 max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl lg:text-8xl"
          style={{ animationDelay: "0.2s" }}
        >
          The Future of{" "}
          <span className="shimmer-text">Smart Betting</span>
          <br />
          is Almost Here
        </h1>

        {/* Sub */}
        <p
          className="animate-fade-up mx-auto mb-10 max-w-xl text-lg text-white/50 md:text-xl"
          style={{ animationDelay: "0.3s" }}
        >
          Sports · Aviator · P2P Trading · Predictions · Binary/Forex — all in one platform. Built for serious players.
        </p>

        {/* CTA */}
        <div className="animate-fade-up w-full max-w-md" style={{ animationDelay: "0.4s" }}>
          {submitted ? (
            <div className="glass-purple rounded-2xl px-8 py-6">
              <div className="mb-2 text-3xl">🎉</div>
              <p className="font-bold text-violet-300">You&apos;re on the list!</p>
              <p className="mt-1 text-sm text-white/50">We&apos;ll hit you up the moment we launch.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="glass flex overflow-hidden rounded-2xl p-1.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-white/30 transition"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-500 active:scale-95"
              >
                Notify me
              </button>
            </form>
          )}
          <p className="mt-3 text-xs text-white/25">No spam. Early access perks for waitlist members.</p>
        </div>

        {/* Stats */}
        <div
          className="animate-fade-up mt-16 grid grid-cols-2 gap-4 md:grid-cols-4"
          style={{ animationDelay: "0.5s" }}
        >
          {stats.map((s) => (
            <div key={s.label} className="stat-card rounded-2xl px-6 py-4 text-center">
              <div className="font-mono text-2xl font-black text-white">{s.value}</div>
              <div className="mt-1 text-xs text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="animate-fade-in absolute bottom-8 left-1/2 -translate-x-1/2" style={{ animationDelay: "1.2s" }}>
          <div className="flex flex-col items-center gap-2 text-white/20">
            <span className="text-xs uppercase tracking-widest">Explore</span>
            <div className="animate-float h-6 w-px bg-gradient-to-b from-white/20 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Products ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-black md:text-5xl">
            Everything in{" "}
            <span className="gradient-text">one place</span>
          </h2>
          <p className="text-white/40">Six products. One account. Zero switching.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <div
              key={p.label}
              className="product-card animate-fade-up group relative overflow-hidden rounded-2xl p-6"
              style={{
                animationDelay: `${0.1 + i * 0.08}s`,
                borderColor: p.border,
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="relative">
                <div className="mb-4 text-4xl">{p.icon}</div>
                <h3 className="mb-2 text-lg font-bold text-white">{p.label}</h3>
                <p className="text-sm leading-relaxed text-white/45">{p.desc}</p>
              </div>
              <div className="relative mt-6 flex items-center gap-2 text-xs font-bold text-white/25 transition-colors group-hover:text-violet-400">
                Coming soon
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/5 px-6 py-32 text-center">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-900/10 to-transparent" />
        <div className="relative mx-auto max-w-2xl">
          <div className="mb-6 text-5xl animate-float-slow">🏆</div>
          <h2 className="mb-4 text-3xl font-black md:text-5xl">
            Get in early.{" "}
            <span className="gradient-text">Win big.</span>
          </h2>
          <p className="mb-10 text-white/40">
            Waitlist members get boosted welcome bonuses, early access to all products, and founder-tier status.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-base font-bold text-white shadow-2xl shadow-violet-500/30 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 active:scale-95"
          >
            Create your account
            <span>→</span>
          </Link>
          <p className="mt-4 text-xs text-white/25">Free to join · No credit card required</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-white/20">
        <div className="mb-3 text-sm font-black tracking-tight text-white/40">
          NEEM<span className="text-violet-500">IZ</span>
        </div>
        <p>© 2025 Neemiz. All rights reserved.</p>
        <p className="mt-1">Play responsibly. 18+ only.</p>
      </footer>
    </div>
  );
}
