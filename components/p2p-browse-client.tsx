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
  const [fiatInput, setFiatInput]         = useState("");
  const [selectedPayment, setSelectedPayment] = useState(ad.paymentMethods[0] ?? "");
  const [submitting, setSubmitting]       = useState(false);

  const cryptoAmount   = fiatInput ? Number(fiatInput) / ad.pricePerUnit : 0;
  const fiatNum        = Number(fiatInput);
  const belowMin       = !!fiatInput && fiatNum < ad.minLimit;
  const aboveMax       = !!fiatInput && fiatNum > ad.maxLimit;
  const valid          = fiatNum >= ad.minLimit && fiatNum <= ad.maxLimit && cryptoAmount > 0 && cryptoAmount <= ad.availableAmount;
  const isBuyingCrypto = ad.side === "SELL";

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#0d1420] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 pt-5 pb-4 border-b border-white/[0.07] rounded-t-2xl ${
          isBuyingCrypto ? "bg-gradient-to-r from-[#22c55e]/10 to-transparent" : "bg-gradient-to-r from-red-500/10 to-transparent"
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <span className={`text-xl font-black ${isBuyingCrypto ? "text-[#22c55e]" : "text-red-400"}`}>
                {isBuyingCrypto ? "Buy" : "Sell"} {ad.crypto}
              </span>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center text-white font-black text-[9px]">
                  {ad.merchant.displayName.charAt(0).toUpperCase()}
                </div>
                {ad.merchant.displayName}
                <Icon name="verified" className="text-[#3b82f6] text-xs" />
                <span className="text-slate-700">·</span>
                <span>{ad.merchant.completedTrades} trades</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Price info */}
          <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Price per {ad.crypto}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white">{ad.pricePerUnit.toLocaleString("en-KE")}</span>
                <span className="text-slate-400 text-sm font-bold">{ad.fiat}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-0.5">Available</p>
              <p className="text-white font-bold text-sm">{ad.availableAmount.toFixed(4)} {ad.crypto}</p>
              <p className="text-slate-500 text-xs">Limit: {ad.minLimit.toLocaleString()}–{ad.maxLimit.toLocaleString()} {ad.fiat}</p>
            </div>
          </div>

          {/* You pay */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">You pay ({ad.fiat})</label>
            <div className={`flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border transition-colors ${
              belowMin || aboveMax ? "border-red-500/50" : fiatInput ? "border-[#3b82f6]/40" : "border-transparent"
            }`}>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                className="flex-1 bg-transparent text-white text-xl font-black outline-none placeholder:text-slate-700"
                placeholder="0.00"
                value={fiatInput}
                onChange={(e) => setFiatInput(e.target.value)}
              />
              <span className="text-slate-400 text-sm font-black shrink-0 bg-white/[0.06] px-2.5 py-1 rounded-lg">{ad.fiat}</span>
            </div>
            {belowMin && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><Icon name="error" className="text-sm" />Minimum is {ad.fiat} {ad.minLimit.toLocaleString()}</p>}
            {aboveMax && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><Icon name="error" className="text-sm" />Maximum is {ad.fiat} {ad.maxLimit.toLocaleString()}</p>}
          </div>

          {/* You receive */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">You receive ({ad.crypto})</label>
            <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
              <span className="flex-1 text-white text-xl font-black">{cryptoAmount > 0 ? cryptoAmount.toFixed(6) : "—"}</span>
              <span className="text-slate-400 text-sm font-black shrink-0 bg-white/[0.06] px-2.5 py-1 rounded-lg">{ad.crypto}</span>
            </div>
          </div>

          {/* Payment method */}
          {ad.paymentMethods.length > 1 && (
            <div>
              <label className="text-xs font-bold text-slate-400 mb-2 block">Payment method</label>
              <div className="flex flex-wrap gap-2">
                {ad.paymentMethods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedPayment(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      selectedPayment === m
                        ? "bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]"
                        : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {fmtPm(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Terms */}
          {ad.terms && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex gap-2">
              <Icon name="info" className="text-amber-400 text-sm shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs leading-relaxed">{ad.terms}</p>
            </div>
          )}

          {/* Window */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Icon name="timer" className="text-sm" />
            Payment window: <span className="text-slate-300 font-bold">{ad.paymentWindow} min</span>
            <span className="ml-auto flex items-center gap-1 text-[#22c55e]">
              <Icon name="lock" className="text-xs" />
              Escrow protected
            </span>
          </div>

          <button
            onClick={submit}
            disabled={!valid || submitting}
            className={`w-full py-3.5 rounded-xl font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${
              isBuyingCrypto ? "bg-[#22c55e] hover:bg-[#16a34a]" : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Placing order…
              </span>
            ) : `${isBuyingCrypto ? "Buy" : "Sell"} ${ad.crypto}`}
          </button>
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
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {cells.map((s) => (
        <div
          key={s.label}
          className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#15191f] px-4 py-3 hover:border-white/[0.12] transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-2">
            {s.live && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse shrink-0" />}
            <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
          </div>
          <p className={`text-xl font-black ${stats ? "text-white" : "text-slate-700"}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Ad Card (Polymarket-style, used for all screen sizes) ───────────────────

const CRYPTO_COLOR: Record<string, string> = {
  USDT: "#26a17b",
  BTC:  "#f7931a",
  ETH:  "#627eea",
  BNB:  "#f0b90b",
};

function AdCard({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";
  const color   = CRYPTO_COLOR[ad.crypto] ?? "#087cff";
  const maxQty  = ad.maxLimit / ad.pricePerUnit;
  const fillPct = Math.min(100, maxQty > 0 ? (ad.availableAmount / maxQty) * 100 : 0);

  return (
    <div className="group flex min-h-[265px] flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-[#16171c] transition hover:border-white/[0.14] hover:bg-[#1c1d24] cursor-pointer">

      {/* Header strip — mirrors Polymarket's image strip */}
      <div
        className="relative flex h-14 items-end overflow-hidden px-3 pb-2.5"
        style={{ background: `linear-gradient(135deg, ${color}28 0%, transparent 70%)` }}
      >
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 90% 10%, ${color}18, transparent 65%)` }} />
        <div className="relative flex w-full items-end justify-between">
          <div className="flex items-center gap-2.5">
            {CRYPTO_ICONS[ad.crypto] && (
              <img src={CRYPTO_ICONS[ad.crypto]} alt={ad.crypto} className="h-8 w-8 rounded-full shadow-lg" />
            )}
            <div>
              <p className="text-white font-black text-sm leading-none">{ad.crypto}</p>
              <p className="text-white/35 text-[10px] font-bold mt-0.5">{ad.fiat} / {ad.crypto}</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
            isMerchantSelling ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-red-500/15 text-red-400"
          }`}>
            {isMerchantSelling ? "BUY" : "SELL"}
          </span>
        </div>
      </div>

        <div className="flex flex-1 flex-col p-3.5">
        {/* Merchant row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div className="w-7 h-7 rounded-full bg-[#087cff] flex items-center justify-center text-white font-black text-xs">
                {ad.merchant.displayName.charAt(0).toUpperCase()}
              </div>
              {ad.merchant.isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#22c55e] border border-[#16171c] rounded-full" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-white text-xs font-bold">{ad.merchant.displayName}</span>
                <Icon name="verified" className="text-[#3b82f6] text-[10px]" />
              </div>
              <p className="text-white/30 text-[10px]">
                {ad.merchant.completedTrades} trades
                <span className={`ml-1 ${ad.merchant.completionRate >= 95 ? "text-[#22c55e]" : "text-white/30"}`}>
                  · {ad.merchant.completionRate.toFixed(0)}%
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/25 font-bold">
            <Icon name="timer" className="text-[10px]" />
            ~{ad.merchant.avgReleaseTime || "<1"}m
          </div>
        </div>

        {/* Price — mirrors "question" text in Polymarket */}
        <div className="mb-3">
          <p className="text-xl font-black leading-none text-white">
            {ad.pricePerUnit.toLocaleString("en-KE")}
          </p>
          <p className="text-white/30 text-[11px] mt-0.5">{ad.fiat} per {ad.crypto}</p>
        </div>

        {/* Depth bar — mirrors Polymarket's probability bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
            <span className="text-white/40">Available</span>
            <span className="text-white/55">{ad.availableAmount.toFixed(4)} {ad.crypto}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="rounded-full" style={{ width: `${fillPct}%`, background: color }} />
          </div>
          <p className="text-white/25 text-[10px] mt-1">
            Limit: {(ad.minLimit / 1000).toFixed(0)}K – {(ad.maxLimit / 1000).toFixed(0)}K {ad.fiat}
          </p>
        </div>

        {/* Payment pills — mirrors Polymarket tags */}
        <div className="mb-3 flex flex-wrap gap-1">
          {ad.paymentMethods.map((m) => (
            <span key={m} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-white/35">
              {fmtPm(m)}
            </span>
          ))}
        </div>

        {/* Action buttons — mirrors "Buy Yes / Buy No" */}
        <button
          onClick={() => {
            if (!isSignedIn) { toast.error("Please sign in to trade"); return; }
            onBuy(ad);
          }}
          className={`h-9 w-full rounded-xl font-black text-[13px] transition hover:opacity-90 active:scale-[0.98] ${
            isMerchantSelling
              ? "bg-[#22c55e]/12 text-[#22c55e] hover:bg-[#22c55e]/22"
              : "bg-red-500/12 text-red-400 hover:bg-red-500/22"
          }`}
        >
          {isMerchantSelling ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`}
        </button>
      </div>
    </div>
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
      <div className="mb-5 rounded-2xl border border-white/[0.06] bg-[#090d14] px-5 py-5 text-center">
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
              className="relative rounded-xl border border-white/[0.06] bg-[#0c1118] p-4 text-center"
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
    <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#15191f] p-5">
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

      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 lg:h-full lg:overflow-hidden">

        {/* Workspace header */}
        <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="rounded-2xl border border-white/[0.07] bg-[#15191f] p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/30">Nezeem P2P</p>
                <h1 className="mt-1 text-[22px] font-black leading-tight text-white">Local crypto exchange</h1>
                <p className="mt-1 max-w-md text-sm font-semibold leading-6 text-slate-500">
                  Verified merchants, local payments, escrow-protected orders.
                </p>
              </div>
              <div className="hidden items-center gap-3 text-xs text-slate-500 sm:flex">
                <span className="flex items-center gap-1.5 rounded-full bg-[#22c55e]/10 px-3 py-1.5 text-[#22c55e]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  Escrow active
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/[0.05] px-3 py-1.5">
                  <Icon name="shield" className="text-[#8bc3ff] text-xs" />
                  0% fees
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-xl bg-black/25 p-1">
                {(["BUY", "SELL"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`h-10 rounded-lg px-6 text-sm font-black transition-all ${
                      tab === t
                        ? t === "BUY"
                          ? "bg-[#22c55e] text-white shadow shadow-[#22c55e]/20"
                          : "bg-red-500 text-white shadow shadow-red-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t === "BUY" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {CRYPTOS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCrypto(c)}
                    className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition-all ${
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

              <div className="ml-auto flex items-center gap-1.5">
                {PAYMENTS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPayment(p.value)}
                    className={`h-9 rounded-lg border px-3 text-xs font-bold transition-all ${
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
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
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
        <div className="space-y-3 lg:max-h-[calc(100dvh-20rem)] lg:overflow-y-auto lg:pr-1">
          {loading ? (
            <AdSkeleton />
          ) : ads.length === 0 ? (
            <EmptyAds side={tab === "BUY" ? "SELL" : "BUY"} isSignedIn={!!isSignedIn} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
