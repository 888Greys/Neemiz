"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { COMPANY } from "@/lib/company";
import { useSiteConfig } from "@/lib/site-config-context";
import "./landing.css";

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[min(280px,72vw)]">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#100d1a] shadow-[0_0_0_1px_rgba(168,85,247,0.2),0_60px_80px_rgba(0,0,0,0.6)] ring-1 ring-violet-500/10">
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
          <span className="h-5 w-28 rounded-full bg-black/60" />
        </div>
        <div className="space-y-3 px-3.5 pb-4 pt-9">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ao-muted)]">
            <span>KES Account</span>
            <span className="text-[var(--ao-gold)]">5,000.00</span>
          </div>
          <div className="rounded-xl bg-[#151125] p-2.5 ring-1 ring-violet-500/10">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black text-white">Volatility 75</span>
              <span className="rounded-md bg-[var(--ao-violet)]/15 px-1.5 py-0.5 text-[9px] font-black text-[var(--ao-violet)]">
                Even / Odd
              </span>
            </div>
            <svg viewBox="0 0 220 88" className="h-[88px] w-full" aria-hidden>
              <defs>
                <linearGradient id="aoChart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 50 C20 38, 35 55, 55 42 S85 28, 105 40 S150 60, 170 34 S200 48, 220 20"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2.2"
              />
              <path
                d="M0 50 C20 38, 35 55, 55 42 S85 28, 105 40 S150 60, 170 34 S200 48, 220 20 V88 H0 Z"
                fill="url(#aoChart)"
              />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#1a1040] py-2.5 text-center text-[12px] font-black text-violet-300 ring-1 ring-violet-400/20">
              Even
            </div>
            <div className="rounded-xl bg-[#201810] py-2.5 text-center text-[12px] font-black text-amber-300 ring-1 ring-amber-400/20">
              Odd
            </div>
          </div>
          <div className="ao-cta rounded-lg py-2.5 text-center text-[12px] font-black">
            Place trade · KES 100
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="ao-feat-card">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--ao-violet)]/12 text-[var(--ao-violet)]">
        <Icon name={icon} className="text-[22px]" />
      </span>
      <h3 className="mt-4 text-[17px] font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ao-muted)]">{body}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="ao-card p-5 text-center sm:p-6">
      <div className="text-[1.8rem] font-extrabold tracking-tight text-[var(--ao-gold)] sm:text-[2.2rem]">
        {value}
      </div>
      <div className="mt-1 text-[12px] font-semibold text-[var(--ao-muted)]">{label}</div>
    </div>
  );
}

export function AlphaOptionsKELandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { brand } = useSiteConfig();

  return (
    <div className="alpha-landing">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--ao-line)] bg-[var(--ao-bg)]/85 backdrop-blur-xl">
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
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-[var(--ao-muted)] transition hover:bg-white/[0.04] hover:text-white"
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
            <Link href="/sign-up" className="ao-cta px-4 py-2 text-[13px] sm:px-5">
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
          <div className="border-t border-[var(--ao-line)] px-4 py-3 md:hidden">
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
        <div className="pointer-events-none absolute inset-0 ao-aurora-violet" aria-hidden />
        <div className="pointer-events-none absolute inset-0 ao-aurora-gold" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
          style={{
            background: "radial-gradient(ellipse 40% 30% at 50% 50%, rgba(168,85,247,0.3), transparent 60%)",
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col items-center px-4 pb-16 pt-10 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:pt-16">
          {/* Premium badge */}
          <div className="ao-rise mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--ao-line)] bg-[var(--ao-surface)]/80 px-4 py-1.5 backdrop-blur">
            <span className="text-[12px] font-semibold text-[var(--ao-gold)]">✦ Premium trading</span>
          </div>

          <h1 className="ao-rise text-center text-[clamp(2.5rem,8vw,4.8rem)] font-extrabold leading-[0.95] tracking-tight text-white">
            Elevate your
            <br />
            <span className="bg-gradient-to-r from-[var(--ao-violet)] via-[var(--ao-violet)] to-[var(--ao-gold)] bg-clip-text text-transparent">
              trading edge
            </span>
          </h1>

          <p className="ao-rise-delay mt-6 max-w-lg text-center text-[clamp(0.95rem,2vw,1.1rem)] leading-relaxed text-[var(--ao-muted)]">
            A premium binary options platform built for serious Kenyan traders. M-Pesa deposits,
            elite tools, and the precision you deserve.
          </p>

          <div className="ao-rise-delay mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/sign-up" className="ao-cta px-8 py-3.5 text-[15px]">
              Start trading now
            </Link>
            <Link href="/binary" className="ao-cta-outline px-8 py-3.5 text-[15px]">
              Open terminal →
            </Link>
          </div>

          <div className="ao-rise-delay mt-12 w-full sm:mt-16">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-t border-[var(--ao-line)] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="ao-section-title mb-3 text-center text-white">
            Built for <span className="text-[var(--ao-violet)]">elite</span> traders
          </h2>
          <p className="mx-auto max-w-md text-center text-[14px] leading-relaxed text-[var(--ao-muted)]">
            Every feature designed to give you the upper hand. No compromises.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value="85%+" label="Payout rate" />
            <StatCard value="Instant" label="M-Pesa deposits" />
            <StatCard value="24/7" label="Markets open" />
            <StatCard value="KES 50" label="Minimum trade" />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-20 bg-[var(--ao-surface)]/60 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="ao-section-title mb-10 text-center text-white">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon="payments"
              title="Deposit instantly"
              body="Fund your account with M-Pesa in seconds. No cards, no delays."
            />
            <FeatureCard
              icon="candlestick_chart"
              title="Pick a market"
              body="Choose from Even/Odd or Rise/Fall. Precision tools for calculated moves."
            />
            <FeatureCard
              icon="account_balance_wallet"
              title="Withdraw fast"
              body="Cash out to M-Pesa or bank. Your earnings, delivered when you need them."
            />
            <FeatureCard
              icon="verified_user"
              title="Trade with confidence"
              body="A secure, transparent platform built for Kenyan traders who demand excellence."
            />
          </div>
        </div>
      </section>

      {/* ── Value proposition ── */}
      <section id="about" className="scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="ao-section-title leading-[1.2] text-white">
            You don&apos;t follow the market —{" "}
            <span className="text-[var(--ao-gold)]">you lead it</span>
          </h2>
          <p className="mt-5 text-[clamp(0.95rem,2vw,1.15rem)] leading-relaxed text-[var(--ao-muted)]">
            AlphaOptionsKE is designed for traders who think different. No clutter, no gimmicks.
            Just a clean, powerful platform that puts your strategy first.
          </p>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--ao-violet)] to-[var(--ao-violet-deep)] px-6 py-14 text-center sm:px-12">
          <h2 className="text-[clamp(1.6rem,3.5vw,2.5rem)] font-extrabold tracking-tight text-white">
            Ready to take the lead?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/85">
            Join the elite. Start with as little as KES 50 and trade like a pro.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className="rounded-lg bg-white px-8 py-3.5 text-[15px] font-bold text-[var(--ao-violet-deep)] transition hover:bg-white/90">
              Create free account
            </Link>
            <Link href="/binary" className="rounded-lg border border-white/40 px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/10">
              Try demo →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className="scroll-mt-20 border-t border-[var(--ao-line)] px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo href="/" size="sm" />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--ao-muted)]">
              {brand} — premium binary options trading. Past results do not guarantee future outcomes. Trade responsibly.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-[var(--ao-muted)]">
            <Link href="/sign-in" className="hover:text-white transition">Sign in</Link>
            <Link href="/sign-up" className="hover:text-white transition">Register</Link>
            <Link href="/binary" className="hover:text-white transition">Trading</Link>
            <a href={`mailto:${COMPANY.emails.support}`} className="hover:text-white transition">Support</a>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-center text-[12px] text-[var(--ao-muted)]">
          © {new Date().getFullYear()} {COMPANY.brand}. {COMPANY.legalName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
