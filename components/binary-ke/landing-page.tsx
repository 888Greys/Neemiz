"use client";

import { useState } from "react";
import Link from "next/link";
import { Syne } from "next/font/google";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import "./landing.css";

const bokDisplay = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bok-display",
});

function PhoneMock() {
  return (
    <div className="bok-phone-glow relative mx-auto w-[min(280px,72vw)]">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0c0e12] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_40px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
          <span className="h-5 w-24 rounded-full bg-black/80" />
        </div>
        <div className="space-y-3 px-3.5 pb-4 pt-9">
          <div className="flex items-center justify-between text-[10px] font-bold text-white/70">
            <span>KES Account</span>
            <span className="text-[var(--bok-lime)]">1,000.00</span>
          </div>
          <div className="rounded-xl bg-[#12151c] p-2.5 ring-1 ring-white/[0.06]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-black text-white">Volatility 75</span>
              <span className="rounded-md bg-[var(--bok-lime)]/15 px-1.5 py-0.5 text-[9px] font-black text-[var(--bok-lime)]">
                Even / Odd
              </span>
            </div>
            <svg viewBox="0 0 220 88" className="h-[88px] w-full" aria-hidden>
              <defs>
                <linearGradient id="bokChart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b8ff2a" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#b8ff2a" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 60 C20 55, 30 40, 48 42 S80 70, 100 52 S140 20, 160 34 S200 58, 220 28"
                fill="none"
                stroke="#b8ff2a"
                strokeWidth="2.2"
              />
              <path
                d="M0 60 C20 55, 30 40, 48 42 S80 70, 100 52 S140 20, 160 34 S200 58, 220 28 V88 H0 Z"
                fill="url(#bokChart)"
              />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#1a2030] py-2.5 text-center text-[12px] font-black text-sky-300 ring-1 ring-sky-400/20">
              Even
            </div>
            <div className="rounded-xl bg-[#201820] py-2.5 text-center text-[12px] font-black text-rose-300 ring-1 ring-rose-400/20">
              Odd
            </div>
          </div>
          <div className="rounded-full bg-[var(--bok-lime)] py-2.5 text-center text-[12px] font-black text-[var(--bok-lime-ink)]">
            Place trade · KES 100
          </div>
        </div>
      </div>
    </div>
  );
}

export function BinaryKeLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`bok-landing ${bokDisplay.variable}`}>
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <BrandLogo href="/" size="sm" />

          <nav className="hidden items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-1 ring-1 ring-white/[0.06] md:flex">
            {[
              { href: "/binary", label: "Trading" },
              { href: "#about", label: "About" },
              { href: "#help", label: "Help" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="hidden text-[13px] font-bold text-white/90 transition hover:text-white sm:inline"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className="bok-cta px-3.5 py-2 text-[12px] sm:px-4 sm:text-[13px]">
              Try for free
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
          <div className="border-t border-white/[0.06] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {[
                { href: "/binary", label: "Trading" },
                { href: "#about", label: "About" },
                { href: "#help", label: "Help" },
                { href: "/sign-in", label: "Sign in" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/80 hover:bg-white/[0.04]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Hero — brand, headline, support, CTA, product visual */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(184,255,42,0.18), transparent 60%), radial-gradient(ellipse 60% 40% at 70% 20%, rgba(255,255,255,0.04), transparent 50%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col items-center px-4 pb-16 pt-10 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:pt-14">
          <p className="bok-display bok-hero-rise text-[clamp(2.4rem,8vw,4.5rem)] font-extrabold leading-none tracking-tight text-white">
            Binary<span className="text-[var(--bok-lime)]">KE</span>
          </p>
          <h1 className="bok-display bok-hero-rise-delay mt-5 max-w-2xl text-center text-[clamp(1.35rem,3.6vw,2.15rem)] font-bold leading-[1.15] tracking-tight text-white">
            Build confidence with every single trade
          </h1>
          <p className="bok-hero-rise-delay mt-3 max-w-md text-center text-[15px] leading-relaxed text-[var(--bok-muted)]">
            Even/Odd and Rise/Fall on a modern Kenya-first platform — deposit with M-Pesa and start in minutes.
          </p>
          <div className="bok-hero-rise-delay mt-7 flex flex-col items-center gap-3">
            <Link href="/sign-up" className="bok-cta px-8 py-3.5 text-[15px]">
              Start now for free
            </Link>
            <Link href="#about" className="bok-link-lime text-[13px]">
              Learn more →
            </Link>
          </div>
          <div className="bok-hero-rise-delay mt-10 w-full sm:mt-14">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Value line */}
      <section id="about" className="scroll-mt-20 border-t border-white/[0.05] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="bok-display text-[clamp(1.6rem,4vw,2.6rem)] font-bold leading-[1.2] tracking-tight">
            Discover the perfect blend of{" "}
            <span className="text-[var(--bok-lime)]">care, reliability and usability</span>
          </h2>
        </div>
      </section>

      {/* Start panel */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] bg-[var(--bok-surface)] ring-1 ring-white/[0.06] lg:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 p-8 sm:p-12">
            <h2 className="bok-display text-[clamp(1.5rem,3vw,2.1rem)] font-bold tracking-tight">
              Explore trading built for practice and live play
            </h2>
            <p className="max-w-md text-[14px] leading-relaxed text-[var(--bok-muted)]">
              Open an account, fund with M-Pesa, and trade short-duration markets designed to be clear — not cluttered.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/sign-up" className="bok-cta px-6 py-3 text-[14px]">
                Try now
              </Link>
              <Link href="/binary" className="bok-link-lime text-[13px]">
                Open terminal →
              </Link>
            </div>
          </div>
          <div className="relative flex items-end justify-center bg-gradient-to-br from-[#1a2208] via-[var(--bok-surface-2)] to-black px-6 pb-0 pt-10">
            <div className="w-full max-w-[260px] translate-y-4">
              <PhoneMock />
            </div>
          </div>
        </div>
      </section>

      {/* Trust row */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
          {[
            {
              icon: "payments" as const,
              title: "Quick M-Pesa deposits",
              body: "Fund your wallet and get into markets without card friction.",
            },
            {
              icon: "candlestick_chart" as const,
              title: "Clear trade types",
              body: "Even/Odd and Rise/Fall with short durations you can follow.",
            },
            {
              icon: "verified_user" as const,
              title: "Kenya-first platform",
              body: "Built for local rails, local currency, and mobile-first trading.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] bg-[var(--bok-surface)] p-6 ring-1 ring-white/[0.06]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--bok-lime)]/12 text-[var(--bok-lime)]">
                <Icon name={item.icon} className="text-[22px]" />
              </span>
              <h3 className="bok-display mt-4 text-[17px] font-bold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--bok-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="help" className="scroll-mt-20 border-t border-white/[0.06] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo href="/" size="sm" />
            <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--bok-muted)]">
              BinaryOptionsKE — binary options trading. Past results do not guarantee future outcomes.
              Trade responsibly.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] font-semibold text-white/70">
            <Link href="/sign-in" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-white">
              Create account
            </Link>
            <Link href="/binary" className="hover:text-white">
              Trading
            </Link>
            <a href="mailto:support@binaryoptionske.com" className="hover:text-white">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
