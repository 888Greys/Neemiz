"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { BrandLogo } from "@/components/brand-logo";
import { COMPANY } from "@/lib/company";
import "./landing.css";

function AssetOrb({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="mb-float grid h-12 w-12 place-items-center rounded-full text-[11px] font-bold text-white shadow-lg sm:h-14 sm:w-14 sm:text-[12px]"
      style={{ backgroundColor: color, boxShadow: `0 10px 24px -6px ${color}80` }}
    >
      {label}
    </div>
  );
}

const ASSETS = [
  { label: "META", color: "#1877f2" },
  { label: "MCD", color: "#ffc72c" },
  { label: "TSLA", color: "#e31937" },
  { label: "GOOGL", color: "#4285f4" },
  { label: "AAPL", color: "#000000" },
];

function StepCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--mb-line)] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--mb-green)]/10 text-[var(--mb-green)]">
        <Icon name={icon} className="text-[22px]" />
      </div>
      <h3 className="mt-4 text-[17px] font-bold tracking-tight text-[var(--mb-ink)]">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--mb-muted)]">{body}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--mb-line)] bg-[var(--mb-surface)] p-6 text-center">
      <div className="text-[2rem] font-extrabold tracking-tight text-[var(--mb-green)] sm:text-[2.5rem]">
        {value}
      </div>
      <div className="mt-1 text-[13px] font-medium text-[var(--mb-muted)]">{label}</div>
    </div>
  );
}

export function MoneyBinaryLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="moneybinary-landing">
      <header className="sticky top-0 z-40 border-b border-[var(--mb-line)] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandLogo href="/" size="md" />

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
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-[var(--mb-muted)] transition hover:bg-[var(--mb-surface-2)] hover:text-[var(--mb-ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="hidden text-[13px] font-bold text-[var(--mb-ink)] transition hover:text-[var(--mb-green-600)] sm:inline"
            >
              Login
            </Link>
            <Link href="/sign-up" className="mb-cta px-4 py-2 text-[13px] sm:px-5">
              Try free demo
            </Link>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--mb-ink)] md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name={menuOpen ? "close" : "menu"} className="text-[22px]" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--mb-line)] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {[
                { href: "/binary", label: "Trading" },
                { href: "#about", label: "About" },
                { href: "#how", label: "How it works" },
                { href: "/sign-in", label: "Login" },
                { href: "/sign-up", label: "Try free demo" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[var(--mb-ink)] hover:bg-[var(--mb-surface)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section id="about" className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <div className="relative mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div className="text-center lg:text-left">
                <p className="mb-hero-rise text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1.05] tracking-tight text-[var(--mb-ink)]">
                  Investing Is<br />
                  <span className="text-[var(--mb-green)]">Even Better</span> Now
                </p>
                <p className="mb-hero-rise-delay mt-5 max-w-xl text-[clamp(1rem,2.2vw,1.25rem)] leading-relaxed text-[var(--mb-muted)]">
                  Providing you with the opportunity to invest in more than 100 assets for continuous income.
                </p>
                <div className="mb-hero-rise-delay mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                  <Link href="/sign-up" className="mb-cta px-7 py-3.5 text-[15px]">
                    Try free demo
                  </Link>
                  <Link href="/sign-in" className="mb-cta-outline px-7 py-3.5 text-[15px]">
                    Open account
                  </Link>
                </div>

                {/* Asset orbit */}
                <div className="mb-hero-rise-delay mt-10 flex items-center justify-center gap-3 lg:justify-start">
                  {ASSETS.map((a) => (
                    <AssetOrb key={a.label} label={a.label} color={a.color} />
                  ))}
                </div>
              </div>

              {/* Visual / phone mock */}
              <div className="mb-hero-rise-delay relative mx-auto w-full max-w-sm lg:max-w-none">
                <div className="rounded-[2rem] border border-[var(--mb-line)] bg-[var(--mb-surface)] p-6 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[var(--mb-muted)]">USD Account</span>
                    <span className="text-[13px] font-bold text-[var(--mb-green)]">10,000.00</span>
                  </div>
                  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[var(--mb-line)]">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-[var(--mb-ink)]">Volatility 75</span>
                      <span className="rounded-md bg-[var(--mb-green)]/10 px-2 py-1 text-[10px] font-black text-[var(--mb-green)]">
                        Even / Odd
                      </span>
                    </div>
                    <svg viewBox="0 0 220 96" className="h-[96px] w-full" aria-hidden>
                      <defs>
                        <linearGradient id="mbChart" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 60 C20 55, 30 40, 48 42 S80 70, 100 52 S140 20, 160 34 S200 58, 220 28"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M0 60 C20 55, 30 40, 48 42 S80 70, 100 52 S140 20, 160 34 S200 58, 220 28 V96 H0 Z"
                        fill="url(#mbChart)"
                      />
                    </svg>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" className="rounded-xl border border-[var(--mb-line)] py-2.5 text-[13px] font-bold text-[var(--mb-ink)] hover:bg-[var(--mb-surface-2)]">
                      Even
                    </button>
                    <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-[13px] font-bold text-rose-600 hover:bg-rose-100">
                      Odd
                    </button>
                  </div>
                  <button type="button" className="mb-cta mt-4 w-full py-3 text-[14px]">
                    Place trade · USD 100
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-[var(--mb-surface)] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-section-title text-center">How It Works</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StepCard
                icon="payments"
                title="Deposit"
                body="Open a real account and add funds. We work with M-Pesa and more than 20 payment systems."
              />
              <StepCard
                icon="candlestick_chart"
                title="Trade"
                body="Trade any of 100+ assets and markets. Use technical analysis and trade the news."
              />
              <StepCard
                icon="account_balance_wallet"
                title="Withdraw"
                body="Get funds easily to your bank card or mobile wallet with fast processing."
              />
              <StepCard
                icon="verified_user"
                title="Trusted"
                body="A leader in online trading with a secure, transparent platform built for Kenya."
              />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard value="$10" label="Minimum Deposit" />
              <StatCard value="$1" label="Minimum Trading Amount" />
              <StatCard value="0%" label="Commissions" />
              <StatCard value="0%" label="Fees" />
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[var(--mb-green)] px-6 py-14 text-center sm:px-12">
            <h2 className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-extrabold tracking-tight text-white">
              Start trading in minutes
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/90">
              Join a growing community of traders on a modern, mobile-first platform designed for Kenya.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/sign-up" className="rounded-full bg-white px-8 py-3.5 text-[15px] font-bold text-[var(--mb-green-700)] transition hover:bg-white/90">
                Create account
              </Link>
              <Link href="/binary" className="rounded-full border border-white/40 px-8 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/10">
                Open terminal
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="scroll-mt-20 border-t border-[var(--mb-line)] bg-[var(--mb-surface)] px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandLogo href="/" size="sm" />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--mb-muted)]">
              {COMPANY.brand} — online trading platform. Past results do not guarantee future outcomes. Trade responsibly.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-[var(--mb-muted)]">
            <Link href="/sign-in" className="hover:text-[var(--mb-green-600)]">
              Login
            </Link>
            <Link href="/sign-up" className="hover:text-[var(--mb-green-600)]">
              Register
            </Link>
            <Link href="/binary" className="hover:text-[var(--mb-green-600)]">
              Trading
            </Link>
            <a href={`mailto:${COMPANY.emails.support}`} className="hover:text-[var(--mb-green-600)]">
              Support
            </a>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-center text-[12px] text-[var(--mb-muted)]">
          © {new Date().getFullYear()} {COMPANY.brand}. {COMPANY.legalName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
