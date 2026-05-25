"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { P2PSubNav } from "@/components/p2p-subnav";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdMerchant {
  displayName: string;
  isOnline: boolean;
  completedTrades: number;
  completionRate: number;
  avgReleaseTime: number;
}

interface Ad {
  id: string;
  side: "BUY" | "SELL";
  crypto: string;
  fiat: string;
  pricePerUnit: number;
  availableAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  paymentWindow: number;
  terms: string | null;
  merchant: AdMerchant;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtPm = (m: string) =>
  m === "MPESA" ? "M-Pesa" : m === "BANK" ? "Bank" : m;

// ─── Order Modal ──────────────────────────────────────────────────────────────

function OrderModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const router = useRouter();
  const [inputMode, setInputMode]         = useState<"fiat" | "crypto">("fiat");
  const [rawInput, setRawInput]           = useState("");
  const [selectedPayment, setSelectedPayment] = useState(ad.paymentMethods[0] ?? "");
  const [submitting, setSubmitting]       = useState(false);

  // Derive fiat and crypto amounts from whichever field is active
  const fiatNum    = inputMode === "fiat"   ? Number(rawInput) : Number(rawInput) * ad.pricePerUnit;
  const cryptoAmount = inputMode === "crypto" ? Number(rawInput) : (Number(rawInput) ? Number(rawInput) / ad.pricePerUnit : 0);

  const belowMin       = !!rawInput && fiatNum < ad.minLimit;
  const aboveMax       = !!rawInput && fiatNum > ad.maxLimit;
  const valid          = fiatNum >= ad.minLimit && fiatNum <= ad.maxLimit && cryptoAmount > 0 && cryptoAmount <= ad.availableAmount;
  const isBuyingCrypto = ad.side === "SELL";
  const actionTone = isBuyingCrypto ? "bg-[#05b957] hover:bg-[#06d169]" : "bg-red-500 hover:bg-red-600";

  function toggleMode() {
    setInputMode((m) => m === "fiat" ? "crypto" : "fiat");
    setRawInput("");
  }

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res  = await fetch("/api/p2p/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: ad.id, cryptoAmount: cryptoAmount.toFixed(8), paymentMethod: selectedPayment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/p2p/order/${data.orderId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 backdrop-blur-sm pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[#0e0e14] text-white shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
          <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center">
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/[0.06]"
            >
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <h2 className="truncate text-center text-[15px] font-black">{isBuyingCrypto ? "Buy" : "Sell"} {ad.crypto}</h2>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-white/[0.06] hover:text-white"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-5">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Price</span>
              <span className="font-black text-[#05b957]">{ad.pricePerUnit.toLocaleString("en-KE", { maximumFractionDigits: 2 })} {ad.fiat}</span>
              <span className="text-slate-600">38s</span>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-400">
              <Icon name="verified_user" className="text-[11px] text-[#05b957]" />
              Security Protection
            </span>
          </div>


          <section className="mb-3 rounded-2xl bg-[#16161f] p-3 ring-1 ring-white/[0.04]">
            <div className="mb-6 flex items-center justify-between border-b border-white/[0.06]">
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => { setInputMode("fiat"); setRawInput(""); }}
                  className={`pb-2 text-[12px] font-black ${inputMode === "fiat" ? "border-b-2 border-[#087cff] text-[#087cff]" : "text-slate-600"}`}
                >
                  With Fiat
                </button>
                <button
                  type="button"
                  onClick={() => { setInputMode("crypto"); setRawInput(""); }}
                  className={`pb-2 text-[12px] font-black ${inputMode === "crypto" ? "border-b-2 border-[#087cff] text-[#087cff]" : "text-slate-600"}`}
                >
                  With Crypto
                </button>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-slate-600">
                <Icon name="schedule" className="text-[11px]" />
                {ad.paymentWindow}m
              </span>
            </div>

            <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent text-[28px] font-light text-white outline-none placeholder:text-slate-700"
                placeholder="0"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              <span className="text-sm font-black text-white">{inputMode === "fiat" ? ad.fiat : ad.crypto}</span>
              <button type="button" onClick={() => setRawInput(String(inputMode === "fiat" ? Math.floor(ad.maxLimit) : ad.availableAmount.toFixed(6)))} className="text-sm font-black text-[#f59e0b]">
                Max
                </button>
              </div>
            <p className="mt-3 text-[11px] text-slate-500">Limits: {ad.minLimit.toLocaleString("en-KE")} - {ad.maxLimit.toLocaleString("en-KE")} {ad.fiat}</p>
            <p className="mt-2 text-[12px] text-slate-500">
              I will receive <span className="text-white">{cryptoAmount > 0 ? cryptoAmount.toFixed(6) : "--"} {ad.crypto}</span>
            </p>
            {(belowMin || aboveMax) && (
              <p className="mt-2 text-[11px] font-bold text-red-400">
                {belowMin ? `Minimum is ${ad.fiat} ${ad.minLimit.toLocaleString("en-KE")}` : `Maximum is ${ad.fiat} ${ad.maxLimit.toLocaleString("en-KE")}`}
              </p>
            )}
          </section>

          {/* Payment method */}
          <section className="mb-5 rounded-2xl bg-[#16161f] p-3 ring-1 ring-white/[0.04]">
            <div className="flex flex-wrap gap-2">
                {ad.paymentMethods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedPayment(m)}
                  className={`rounded-lg border-l-2 px-3 py-2 text-xs font-black transition-colors ${
                      selectedPayment === m
                      ? "border-[#087cff] bg-[#087cff]/[0.08] text-white"
                      : "border-white/10 bg-white/[0.02] text-slate-500"
                    }`}
                  >
                    {fmtPm(m)}
                  </button>
                ))}
              </div>
          </section>

          <section className="border-t border-white/[0.05] pt-4">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" className="flex items-center gap-1 text-sm font-bold text-white">
                {ad.merchant.displayName}
                <Icon name="chevron_right" className="text-[15px] text-slate-500" />
              </button>
              <div className="text-right text-[11px] text-slate-500">
                <span className="text-slate-300">{ad.merchant.completedTrades}</span> Orders | Completion Rate <span className="text-slate-300">{ad.merchant.completionRate.toFixed(0)}%</span>
              </div>
            </div>

            <h3 className="mb-2 text-sm font-black text-white">Advertiser Terms</h3>
            <p className="text-[12px] leading-5 text-slate-500">
              {ad.terms || "Merchants may include additional terms in their advertiser terms. Please review them carefully before placing an order."}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-slate-500">
              In the event of any conflict, the <span className="font-black text-[#087cff]">P2P Taker Terms of Use</span> and <span className="font-black text-[#087cff]">P2P Privacy Agreement</span> prevail. Violations are not protected under platform protection.
            </p>
          </section>
        </div>

        <div className="shrink-0 border-t border-[#1e1e30] bg-[#0e0e14] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <div className="grid grid-cols-[minmax(0,1fr)_118px] items-center gap-3">
            <div>
              <p className="text-[16px] font-black text-white">{fiatNum > 0 ? fiatNum.toLocaleString("en-KE", { maximumFractionDigits: 2 }) : "0"} {ad.fiat}</p>
              <p className="text-[11px] text-slate-500">Total Payable</p>
            </div>
          <button
            onClick={submit}
            disabled={!valid || submitting}
              className={`h-11 rounded-full text-sm font-black text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98] ${actionTone}`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Placing order…
              </span>
              ) : isBuyingCrypto ? "Buy" : "Sell"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

interface PlatformStats {
  volumeToday:    number;
  onlineMerchants: number;
  avgReleaseMin:  number;
  feePct:         number;
}

function fmtVolume(kes: number | null | undefined): string {
  const n = Number(kes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "KSh 0";
  if (n >= 1_000_000) return `KSh ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `KSh ${(n / 1_000).toFixed(0)}K`;
  return `KSh ${n.toLocaleString("en-KE")}`;
}

function StatsBar() {
  const [stats, setStats]     = useState<PlatformStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await fetch("/api/p2p/stats");
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch { /* keep null */ }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const cells = [
    {
      label: "Traded today",
      value: stats ? fmtVolume(stats.volumeToday) : "—",
      accent: "#22c55e",
    },
    {
      label: "Merchants online",
      value: stats ? String(stats.onlineMerchants) : "—",
      accent: "#3b82f6",
      live: true,
    },
    {
      label: "Avg release time",
      value: stats
        ? stats.avgReleaseMin > 0 ? `~${stats.avgReleaseMin} min` : "< 1 min"
        : "—",
      accent: "#a78bfa",
    },
    {
      label: "Platform fees",
      value: stats ? `${stats.feePct}%` : "0%",
      accent: "#f59e0b",
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-2 xl:grid-cols-4">
      {cells.map((s) => (
        <div
          key={s.label}
          className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#111118] px-3 py-2.5 transition-colors hover:border-white/[0.12]"
        >
          <div className="mb-1 flex items-center gap-1.5">
            {s.live && <span className="w-1.5 h-1.5 rounded-full bg-[#05b957] animate-pulse shrink-0" />}
            <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
          </div>
          <p className={`text-lg font-black leading-tight ${stats ? "text-white" : "text-slate-700"}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Ad Row ──────────────────────────────────────────────────────────────────

const CRYPTO_COLOR: Record<string, string> = {
  USDT: "#26a17b",
  BTC:  "#f7931a",
  ETH:  "#627eea",
  BNB:  "#f0b90b",
};

function AdCard({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";
  const color   = CRYPTO_COLOR[ad.crypto] ?? "#087cff";
  const openOrder = () => {
    if (!isSignedIn) {
      toast.error("Please sign in to trade");
      return;
    }
    onBuy(ad);
  };

  return (
    <button
      type="button"
      onClick={openOrder}
      className="group grid min-h-[118px] w-full grid-cols-[minmax(0,1fr)_84px] gap-3 border-b border-[#1e1e30] bg-[#0e0e14] px-3 py-3 text-left transition hover:bg-[#111118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#087cff]/60 sm:grid-cols-[minmax(0,1fr)_118px] sm:px-4"
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-black"
              style={{ backgroundColor: color }}
            >
              {ad.merchant.displayName.charAt(0).toUpperCase()}
            </div>
            {ad.merchant.isOnline && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full border border-black bg-[#05b957]" />
            )}
          </div>
          <span className="truncate text-[12px] font-black text-white">{ad.merchant.displayName}</span>
          <Icon name="verified" className="shrink-0 text-[12px] text-white/55" />
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-white/35">
            <Icon name="schedule" className="text-[11px]" />
            {ad.merchant.avgReleaseTime || "<1"}m
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
            isMerchantSelling ? "bg-[#05b957]/12 text-[#05b957]" : "bg-red-500/12 text-red-400"
          }`}>
            Fast release
          </span>
        </div>

        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold leading-3 text-white/45">{ad.fiat}</p>
            <p className="text-[21px] font-black leading-tight text-white tabular-nums">
              {ad.pricePerUnit.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="hidden shrink-0 pt-1 text-right text-[10px] font-semibold text-white/35 sm:block">
            {ad.merchant.completedTrades} Orders ({ad.merchant.completionRate.toFixed(0)}%)
          </div>
        </div>

        <div className="space-y-0.5 text-[10px] font-semibold leading-4 text-white/40">
          <p>
            Limits <span className="text-white/65">{ad.minLimit.toLocaleString("en-KE")} - {ad.maxLimit.toLocaleString("en-KE")} {ad.fiat}</span>
          </p>
          <p>
            Quantity <span className="text-white/65">{ad.availableAmount.toLocaleString("en-KE", { maximumFractionDigits: 4 })} {ad.crypto}</span>
          </p>
        </div>

        <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 gap-y-1">
          {ad.paymentMethods.map((m) => (
            <span key={m} className="flex items-center gap-1 text-[10px] font-semibold text-white/45">
              <span className={`h-3 w-0.5 rounded-full ${m === "MPESA" ? "bg-[#05b957]" : "bg-[#f59e0b]"}`} />
              {fmtPm(m)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-end justify-center gap-4">
        <span className="text-right text-[10px] font-semibold leading-3 text-white/35 sm:hidden">
          {ad.merchant.completedTrades} Orders ({ad.merchant.completionRate.toFixed(0)}%)
        </span>
        <span
          className={`grid h-8 w-[72px] place-items-center rounded-full text-[12px] font-black text-white shadow-[0_6px_16px_rgba(5,196,107,0.18)] transition group-active:scale-[0.98] sm:w-[86px] ${
            isMerchantSelling
              ? "bg-[#05b957] group-hover:bg-[#06d169]"
              : "bg-red-500 group-hover:bg-red-400"
          }`}
        >
          {isMerchantSelling ? "Buy" : "Sell"}
        </span>
      </div>
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyAds({ side, isSignedIn }: { side: "BUY" | "SELL"; isSignedIn: boolean }) {
  const steps = [
    {
      icon: "manage_search",
      title: "Browse ads",
      desc: "Find verified merchants with the best rates for your currency",
    },
    {
      icon: "payments",
      title: "Pay the merchant",
      desc: "Send via M-Pesa or bank transfer within the payment window",
    },
    {
      icon: "account_balance_wallet",
      title: "Receive crypto",
      desc: "Crypto releases from escrow instantly once payment is confirmed",
    },
  ];

  return (
    <div className="py-2">
      {/* No ads message */}
      <div className="mb-5 rounded-2xl border border-white/[0.06] bg-[#0e0e14] px-5 py-5 text-center">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]">
          <Icon name="swap_horiz" className="text-xl text-slate-500" />
        </div>
        <p className="mb-1 text-lg font-black text-white">
          No {side === "SELL" ? "buy" : "sell"} ads right now
        </p>
        <p className="text-sm text-slate-500">
          Try a different crypto or payment filter — or be the first to post.
        </p>
        {isSignedIn && (
          <Link
            href="/p2p/merchant"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/10 px-5 py-2.5 text-sm font-black text-[#3b82f6] transition-colors hover:bg-[#3b82f6]/20"
          >
            <Icon name="add_business" className="text-base" />
            Post an ad
          </Link>
        )}
      </div>

      {/* How it works */}
      <div>
        <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-slate-600">
          How P2P trading works
        </p>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-xl border border-white/[0.06] bg-[#111118] p-4 text-center"
            >
              {/* Connector line */}
              {i < 2 && (
                <div className="hidden sm:block absolute top-1/2 -right-1.5 w-3 h-px bg-white/[0.08] z-10" />
              )}
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-[#3b82f6]/20 bg-[#3b82f6]/10">
                <Icon name={step.icon} className="text-base text-[#3b82f6]" />
              </div>
              <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5">
                <span className="text-[10px] font-black text-slate-500">Step {i + 1}</span>
              </div>
              <p className="mb-1 text-sm font-black text-white">{step.title}</p>
              <p className="text-xs leading-5 text-slate-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Merchant Promo Banner ────────────────────────────────────────────────────

function MerchantPromoBanner({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#111118] p-5">
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#087cff]/15 border border-[#087cff]/25 shrink-0">
          <Icon name="storefront" className="text-[#3b82f6] text-xl" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-black text-base mb-1">Open a merchant desk</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-3 max-w-2xl">
            Post buy &amp; sell ads at your own prices. Accept M-Pesa or bank transfers.
            All trades are escrow-protected — zero counterparty risk.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
            {[
              { icon: "price_change",    text: "Set your own spread" },
              { icon: "lock",            text: "Escrow-secured trades" },
              { icon: "verified",        text: "Verified badge" },
              { icon: "payments",        text: "M-Pesa & Bank" },
            ].map(({ icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon name={icon} className="text-[#3b82f6] text-sm" />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/p2p/merchant"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-[#087cff] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#087cff]/20 hover:bg-[#0068d9] transition-all active:scale-[0.97]"
        >
          {isSignedIn ? "Apply Now" : "Learn More"}
          <Icon name="arrow_forward" className="text-base" />
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function AdSkeleton() {
  return (
    <div className="space-y-2">
      {[0.9, 0.75, 0.6, 0.45].map((o, i) => (
        <div
          key={i}
          className="h-[68px] rounded-xl bg-white/[0.04] animate-pulse"
          style={{ opacity: o }}
        />
      ))}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CRYPTO_ICONS: Record<string, string> = {
  USDT:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  BTC:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
};

const CRYPTOS   = ["USDT", "BTC", "ETH", "BNB"];
const PAYMENTS  = [
  { value: "",       label: "All" },
  { value: "MPESA",  label: "M-Pesa" },
  { value: "BANK",   label: "Bank" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const VALID_SIDES   = ["BUY", "SELL"] as const;
const VALID_CRYPTOS_SET = new Set(CRYPTOS);
const VALID_PAYMENTS_SET = new Set(PAYMENTS.map((p) => p.value));

export function P2PBrowseClient() {
  const { isSignedIn }   = useSupabaseAuth();
  const router           = useRouter();
  const pathname         = usePathname();
  const searchParams     = useSearchParams();

  // Initialise from URL params — falls back to safe defaults
  const initTab     = (VALID_SIDES as readonly string[]).includes(searchParams.get("side") ?? "")
    ? (searchParams.get("side") as "BUY" | "SELL")
    : "BUY";
  const initCrypto  = VALID_CRYPTOS_SET.has(searchParams.get("crypto") ?? "")
    ? searchParams.get("crypto")!
    : "USDT";
  const initPayment = VALID_PAYMENTS_SET.has(searchParams.get("payment") ?? "")
    ? (searchParams.get("payment") ?? "")
    : "";

  const [tab, setTabState]         = useState<"BUY" | "SELL">(initTab);
  const [crypto, setCryptoState]   = useState(initCrypto);
  const [payment, setPaymentState] = useState(initPayment);
  const [ads, setAds]              = useState<Ad[]>([]);
  const [loading, setLoading]      = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  // Sync state to URL whenever filters change
  const pushUrl = useCallback((newTab: string, newCrypto: string, newPayment: string) => {
    const p = new URLSearchParams();
    if (newTab !== "BUY")     p.set("side",    newTab);
    if (newCrypto !== "USDT") p.set("crypto",  newCrypto);
    if (newPayment)           p.set("payment", newPayment);
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, pathname]);

  const setTab = useCallback((t: "BUY" | "SELL") => {
    setTabState(t);
    pushUrl(t, crypto, payment);
  }, [crypto, payment, pushUrl]);

  const setCrypto = useCallback((c: string) => {
    setCryptoState(c);
    pushUrl(tab, c, payment);
  }, [tab, payment, pushUrl]);

  const setPayment = useCallback((p: string) => {
    setPaymentState(p);
    pushUrl(tab, crypto, p);
  }, [tab, crypto, pushUrl]);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const params = new URLSearchParams({
        side: tab === "BUY" ? "SELL" : "BUY",
        crypto,
        ...(payment ? { payment } : {}),
      });
      const res  = await fetch(`/api/p2p/ads?${params}`, { signal: controller.signal });
      const data = await res.json();
      setAds(Array.isArray(data) ? data : []);
    } catch {
      setAds([]);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [tab, crypto, payment]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  return (
    <>
      {selectedAd && <OrderModal ad={selectedAd} onClose={() => setSelectedAd(null)} />}

      <P2PSubNav />

      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">

        {/* Workspace header */}
        <div className="mb-2 grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_575px]">
          <div className="min-w-0 rounded-xl border border-[#1e1e30] bg-[#111118] px-3 py-2.5">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Nezeem P2P</p>
                <h1 className="text-lg font-black leading-tight text-white">Local crypto exchange</h1>
                <p className="max-w-md text-xs font-semibold leading-5 text-slate-500">
                  Verified merchants, local payments, escrow-protected orders.
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 text-xs text-slate-500 sm:flex">
                <span className="flex items-center gap-1.5 rounded-full bg-[#05b957]/10 px-2.5 py-1 text-[#05b957]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#05b957] animate-pulse" />
                  Escrow active
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1">
                  <Icon name="shield" className="text-[#8bc3ff] text-xs" />
                  0% fees
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#08080c]/60 p-1 sm:flex sm:items-center">
                {(["BUY", "SELL"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`h-8 rounded-md px-3 text-xs font-black transition-all sm:px-5 ${
                      tab === t
                        ? t === "BUY"
                          ? "bg-[#05b957] text-white shadow shadow-[#05b957]/20"
                          : "bg-red-500 text-white shadow shadow-red-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t === "BUY" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>

              <div className="grid min-w-0 grid-cols-[repeat(4,minmax(0,1fr))] gap-1.5 sm:flex sm:items-center">
                {CRYPTOS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCrypto(c)}
                    className={`flex h-8 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] font-black transition-all sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                      crypto === c
                        ? "bg-[#087cff] border-[#087cff] text-white shadow shadow-[#087cff]/20"
                        : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {CRYPTO_ICONS[c] && (
                      <img src={CRYPTO_ICONS[c]} alt={c} width={15} height={15} className="h-[15px] w-[15px] rounded-full" />
                    )}
                    {c}
                  </button>
                ))}
              </div>

              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 sm:ml-auto sm:flex sm:items-center">
                {PAYMENTS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPayment(p.value)}
                    className={`h-8 rounded-md border px-2 text-xs font-bold transition-all sm:px-3 ${
                      payment === p.value
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/[0.04] border-white/[0.05] text-slate-500 hover:border-white/15 hover:text-slate-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={fetchAds}
                  title="Refresh"
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <Icon name="refresh" className={`text-lg ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <StatsBar />
          </div>
        </div>

        {/* Ad grid */}
        <div className="space-y-3">
          {loading ? (
            <AdSkeleton />
          ) : ads.length === 0 ? (
            <EmptyAds side={tab === "BUY" ? "SELL" : "BUY"} isSignedIn={!!isSignedIn} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#1e1e30] bg-[#0e0e14]">
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />
              ))}
            </div>
          )}

          {ads.length > 0 && <MerchantPromoBanner isSignedIn={!!isSignedIn} />}
        </div>
      </div>
    </>
  );
}
