"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { COMPANY } from "@/lib/company";
import { useSiteConfig } from "@/lib/site-config-context";
import "./landing.css";

function SpeedDash() {
  return (
    <div className="relative mx-auto w-[min(290px,76vw)]">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#0f1a2e] shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_60px_80px_rgba(0,0,0,0.6)] ring-1 ring-blue-500/10">
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
          <span className="h-5 w-28 rounded-full bg-black/60" />
        </div>
        <div className="space-y-3 px-3.5 pb-4 pt-9">
          <div className="flex items-center justify-between text-[10px] font-bold text-blue-200/70">
            <span>KES Account</span>
            <span className="text-[var(--qb-amber)]">2,500.00</span>
          </div>
          <div className="rounded-xl bg-[#121d33] p-2.5 ring-1 ring-blue-500/10">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black text-white">Volatility 75</span>
              <span className="rounded-md bg-[var(--qb-blue)]/15 px-1.5 py-0.5 text-[9px] font-black text-[var(--qb-blue)]">
                Even / Odd
              </span>
            </div>
            <svg viewBox="0 0 220 88" className="h-[88px] w-full" aria-hidden>
              <defs>
                <linearGradient id="qbChart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 55 C20 42, 35 60, 50 48 S85 30, 105 42 S145 58, 165 36 S200 50, 220 22"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.2"
              />
              <path
                d="M0 55 C20 42, 35 60, 50 48 S85 30, 105 42 S145 58, 165 36 S200 50, 220 22 V88 H0 Z"
                fill="url(#qbChart)"
              />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#0f2040] py-2.5 text-center text-[12px] font-black text-blue-300 ring-1 ring-blue-400/20">
              Even
            </div>
            <div className="rounded-xl bg-[#201810] py-2.5 text-center text-[12px] font-black text-amber-300 ring-1 ring-amber-400/20">
              Odd
            </div>
          </div>
          <div className="qb-cta rounded-lg py-2.5 text-center text-[12px] font-black">
            Place trade · KES 100
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="qb-feat-card">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--qb-blue)]/12 text-[var(--qb-blue)]">
        <Icon name={icon} className="text-[22px]" />
      </span>
      <h3 className="mt-4 text-[17px] font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--qb-muted)]">{body}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="qb-card p-5 text-center sm:p-6">
      <div className="text-[1.8rem] font-extrabold tracking-tight text-[var(--qb-amber)] sm:text-[2.2rem]">
        {value}
      </div>
      <div className="mt-1 text-[12px] font-semibold text-[var(--qb-muted)]">{label}</div>
    </div>
  );
}

function PulseDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--qb-blue)] opacity-40" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--qb-blue)]" />
    </span>
  );
}

export function BinaryMarketLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { brand } = useSiteConfig();

  return (
    <div className="binarymarket-landing">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--qb-line)] bg-[var(--qb-bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <BrandLogo href="/" size="sm" />

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "/binary", label: "Trading" },
              { href: "#about", label: "About" },
              { href: "#how", label: "How it works" },
              { href: "#contact", label: "Help" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-[var(--qb-muted)] transition hover:bg-white/[0.04] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="hidden text-[13px] font-bold text-white/80 transition hover:text-white sm:inline"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className="qb-cta px-4 py-2 text-[13px] sm:px-5">
              Get started
            </Link>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-white/80 ring-1 ring-white/10 md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name={menuOpen ? "close" : "menu"} className="text-[20px]" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--qb-line)] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {[
                { href: "/binary", label: "Trading" },
                { href: "#about", label: "About" },
                { href: "#how", label: "How it works" },
                { href: "/sign-in", label: "Sign in" },
                { href: "/sign-up", label: "Get started" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/70 hover:bg-white/[0.04] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 qb-aurora-blue" aria-hidden />
        <div className="pointer-events-none absolute inset-0 qb-aurora-amber" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            background: "radial-gradient(ellipse 40% 30% at 50% 50%, rgba(59,130,246,0.3), transparent 60%)",
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col items-center px-4 pb-16 pt-10 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:pt-16">
          {/* Status badge */}
          <div className="qb-rise mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--qb-line)] bg-[var(--qb-surface)]/80 px-4 py-1.5 backdrop-blur">
            <PulseDot />
            <span className="text-[12px] font-semibold text-[var(--qb-muted)]">Live trading · 24/7</span>
          </div>

          <h1 className="qb-rise text-center text-[clamp(2.5rem,8vw,4.8rem)] font-extrabold leading-[0.95] tracking-tight text-white">
            Trade at the
            <br />
            <span className="bg-gradient-to-r from-[var(--qb-blue)] via-[var(--qb-blue)] to-[var(--qb-amber)] bg-clip-text text-transparent">
              speed of light
            </span>
          </h1>

          <p className="qb-rise-delay mt-6 max-w-lg text-center text-[clamp(0.95rem,2vw,1.1rem)] leading-relaxed text-[var(--qb-muted)]">
            Instant deposits via M-Pesa. Lightning-fast Even/Odd and Rise/Fall trades.
            Built for traders who move fast.
          </p>

          <div className="qb-rise-delay mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/sign-up" className="qb-cta px-8 py-3.5 text-[15px]">
              Start trading free
            </Link>
            <Link href="/binary" className="qb-cta-outline px-8 py-3.5 text-[15px]">
              Open terminal →
            </Link>
          </div>

          <div className="qb-rise-delay mt-12 w-full sm:mt-16">
            <SpeedDash />
          </div>
        </div>
      </section>

      {/* ── Speed stats ── */}
      <section className="border-t border-[var(--qb-line)] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="qb-section-title mb-3 text-center text-white">
            Built for <span className="text-[var(--qb-blue)]">instant</span> execution
          </h2>
          <p className="mx-auto max-w-md text-center text-[14px] leading-relaxed text-[var(--qb-muted)]">
            Every trade executes in milliseconds. No lag, no delay — just pure speed.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value="< 50ms" label="Trade execution" />
            <StatCard value="Instant" label="M-Pesa deposits" />
            <StatCard value="24/7" label="Markets open" />
            <StatCard value="KES 10" label="Minimum trade" />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-20 bg-[var(--qb-surface)]/60 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="qb-section-title mb-10 text-center text-white">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon="payments"
              title="Deposit instantly"
              body="Fund your account with M-Pesa in seconds. No cards, no delays — just tap and trade."
            />
            <FeatureCard
              icon="candlestick_chart"
              title="Pick a market"
              body="Choose from Even/Odd or Rise/Fall. Short durations mean quick results — no waiting around."
            />
            <FeatureCard
              icon="account_balance_wallet"
              title="Withdraw fast"
              body="Cash out to M-Pesa or bank. Fast processing so your money reaches you when you need it."
            />
            <FeatureCard
              icon="verified_user"
              title="Trade with confidence"
              body="A secure, transparent platform purpose-built for Kenyan traders. Your funds, protected."
            />
          </div>
        </div>
      </section>

      {/* ── Value proposition ── */}
      <section id="about" className="scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="qb-section-title leading-[1.2] text-white">
            The market moves fast —{" "}
            <span className="text-[var(--qb-amber)]">so should your platform</span>
          </h2>
          <p className="mt-5 text-[clamp(0.95rem,2vw,1.15rem)] leading-relaxed text-[var(--qb-muted)]">
            BinaryMarket is designed from the ground up for speed. No heavy dashboards, no clutter.
            Just the markets you want, when you want them.
          </p>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--qb-blue)] to-[var(--qb-blue-600)] px-6 py-14 text-center sm:px-12">
          <h2 className="text-[clamp(1.6rem,3.5vw,2.5rem)] font-extrabold tracking-tight text-white">
            Ready to experience the speed?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/85">
            Join thousands of Kenyan traders on the fastest binary trading platform. Start with as little as KES 10.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className="rounded-lg bg-white px-8 py-3.5 text-[15px] font-bold text-[var(--qb-blue-600)] transition hover:bg-white/90">
              Create free account
            </Link>
            <Link href="/binary" className="rounded-lg border border-white/40 px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/10">
              Try demo →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="scroll-mt-20 border-t border-[var(--qb-line)] px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo href="/" size="sm" />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--qb-muted)]">
              {brand} — binary options trading. Past results do not guarantee future outcomes. Trade responsibly.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-[var(--qb-muted)]">
            <Link href="/sign-in" className="hover:text-white transition">Sign in</Link>
            <Link href="/sign-up" className="hover:text-white transition">Register</Link>
            <Link href="/binary" className="hover:text-white transition">Trading</Link>
            <a href={`mailto:${COMPANY.emails.support}`} className="hover:text-white transition">Support</a>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-center text-[12px] text-[var(--qb-muted)]">
          © {new Date().getFullYear()} {COMPANY.brand}. {COMPANY.legalName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
