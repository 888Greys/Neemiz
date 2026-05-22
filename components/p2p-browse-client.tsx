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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
      {cells.map((s) => (
        <div
          key={s.label}
          className="relative overflow-hidden bg-[#0c1118] border border-white/[0.06] rounded-2xl px-4 py-3.5 hover:border-white/[0.10] transition-colors"
        >
          <div
            className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 blur-xl pointer-events-none"
            style={{ background: s.accent }}
          />
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

// ─── Desktop Ad Row ───────────────────────────────────────────────────────────

function DesktopAdRow({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";

  return (
    <div className="grid grid-cols-[2.5fr_1.3fr_1fr_1.3fr_1fr_120px] gap-4 items-center px-5 py-3.5 border border-white/[0.05] rounded-xl bg-[#0a0f1a] hover:bg-[#0d1320] hover:border-white/[0.09] transition-all">

      {/* Merchant */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center text-white font-black text-xs shadow-lg shadow-[#3b82f6]/20">
            {ad.merchant.displayName.charAt(0).toUpperCase()}
          </div>
          {ad.merchant.isOnline && (
            <span className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-[#22c55e] border-2 border-[#0a0f1a] rounded-full" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-sm truncate">{ad.merchant.displayName}</p>
            <Icon name="verified" className="text-[#3b82f6] text-xs shrink-0" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
            <span>{ad.merchant.completedTrades} trades</span>
            <span className="text-slate-700">·</span>
            <span className={ad.merchant.completionRate >= 95 ? "text-[#22c55e]" : "text-slate-500"}>
              {ad.merchant.completionRate.toFixed(1)}%
            </span>
            <span className="text-slate-700">·</span>
            <Icon name="timer" className="text-[10px]" />
            <span>~{ad.merchant.avgReleaseTime || "<1"}m</span>
          </div>
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-white font-black text-sm">{ad.pricePerUnit.toLocaleString("en-KE")}</p>
        <p className="text-slate-600 text-[11px]">{ad.fiat}</p>
      </div>

      {/* Available with mini progress bar */}
      <div>
        <p className="text-slate-200 font-bold text-sm">{ad.availableAmount.toFixed(4)}</p>
        <p className="text-slate-600 text-[11px]">{ad.crypto}</p>
      </div>

      {/* Limit */}
      <div>
        <p className="text-slate-200 font-bold text-sm">
          {(ad.minLimit / 1000).toFixed(0)}K – {(ad.maxLimit / 1000).toFixed(0)}K
        </p>
        <p className="text-slate-600 text-[11px]">{ad.fiat}</p>
      </div>

      {/* Payment */}
      <div className="flex flex-wrap gap-1">
        {ad.paymentMethods.map((m) => (
          <span
            key={m}
            className="bg-[#3b82f6]/10 border border-[#3b82f6]/15 rounded-md px-2 py-0.5 text-[10px] font-bold text-[#60a5fa]"
          >
            {fmtPm(m)}
          </span>
        ))}
      </div>

      {/* Action */}
      <button
        onClick={() => {
          if (!isSignedIn) { toast.error("Please sign in to trade"); return; }
          onBuy(ad);
        }}
        className={`py-2 rounded-lg font-black text-xs transition-all active:scale-[0.97] ${
          isMerchantSelling
            ? "bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e] hover:text-white hover:border-[#22c55e]"
            : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500"
        }`}
      >
        {isMerchantSelling ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`}
      </button>
    </div>
  );
}

// ─── Mobile Ad Card ───────────────────────────────────────────────────────────

function AdCard({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";

  return (
    <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.11] transition-colors">
      {/* Top row: merchant info + release time */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#3b82f6]/20">
              {ad.merchant.displayName.charAt(0).toUpperCase()}
            </div>
            {ad.merchant.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#22c55e] border-2 border-[#0a0f1a] rounded-full" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-white font-bold text-sm">{ad.merchant.displayName}</p>
              <Icon name="verified" className="text-[#3b82f6] text-xs" />
            </div>
            <p className="text-slate-500 text-[11px]">
              {ad.merchant.completedTrades} trades
              <span className={`ml-1 ${ad.merchant.completionRate >= 95 ? "text-[#22c55e]" : "text-slate-500"}`}>
                · {ad.merchant.completionRate.toFixed(1)}%
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white/[0.04] px-2 py-1 rounded-lg">
          <Icon name="timer" className="text-xs" />
          ~{ad.merchant.avgReleaseTime || "<1"}m
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl font-black text-white">{ad.pricePerUnit.toLocaleString("en-KE")}</span>
        <span className="text-slate-500 text-sm font-bold">{ad.fiat}</span>
        <span className="text-slate-700 text-xs ml-1">per {ad.crypto}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2">
          <p className="text-slate-600 mb-0.5">Available</p>
          <p className="text-slate-200 font-bold">{ad.availableAmount.toFixed(4)} {ad.crypto}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2">
          <p className="text-slate-600 mb-0.5">Order limit</p>
          <p className="text-slate-200 font-bold">{(ad.minLimit / 1000).toFixed(0)}K–{(ad.maxLimit / 1000).toFixed(0)}K {ad.fiat}</p>
        </div>
      </div>

      {/* Payment pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {ad.paymentMethods.map((m) => (
          <span
            key={m}
            className="bg-[#3b82f6]/10 border border-[#3b82f6]/15 rounded-md px-2 py-0.5 text-[10px] font-bold text-[#60a5fa]"
          >
            {fmtPm(m)}
          </span>
        ))}
      </div>

      {/* Action */}
      <button
        onClick={() => {
          if (!isSignedIn) { toast.error("Please sign in to trade"); return; }
          onBuy(ad);
        }}
        className={`w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] ${
          isMerchantSelling
            ? "bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e] hover:text-white"
            : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white"
        }`}
      >
        {isMerchantSelling ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`}
      </button>
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
    <div className="py-8">
      {/* No ads message */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] mb-4">
          <Icon name="swap_horiz" className="text-2xl text-slate-500" />
        </div>
        <p className="text-lg font-black text-white mb-1">
          No {side === "SELL" ? "buy" : "sell"} ads right now
        </p>
        <p className="text-sm text-slate-500">
          Try a different crypto or payment filter — or be the first to post.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-8">
        <p className="text-xs font-black text-slate-600 uppercase tracking-widest text-center mb-4">
          How P2P trading works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative bg-[#0c1118] border border-white/[0.06] rounded-2xl p-5 text-center"
            >
              {/* Connector line */}
              {i < 2 && (
                <div className="hidden sm:block absolute top-1/2 -right-1.5 w-3 h-px bg-white/[0.08] z-10" />
              )}
              <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center mx-auto mb-3">
                <Icon name={step.icon} className="text-[#3b82f6] text-lg" />
              </div>
              <div className="inline-flex items-center gap-1 bg-white/[0.04] rounded-full px-2.5 py-0.5 mb-2">
                <span className="text-[10px] font-black text-slate-500">Step {i + 1}</span>
              </div>
              <p className="text-sm font-black text-white mb-1">{step.title}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {isSignedIn && (
        <div className="text-center">
          <Link
            href="/p2p/merchant"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-sm font-black hover:bg-[#3b82f6]/20 transition-colors"
          >
            <Icon name="add_business" className="text-base" />
            Post the first ad
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Merchant Promo Banner ────────────────────────────────────────────────────

function MerchantPromoBanner({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#3b82f6]/15 bg-[#0c1118] p-5 sm:p-6">
      {/* Subtle glow */}
      <div className="absolute top-0 left-0 w-64 h-32 rounded-full bg-[#3b82f6]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-32 rounded-full bg-[#6366f1]/5 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 shrink-0">
          <Icon name="storefront" className="text-[#3b82f6] text-xl" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-black text-base mb-1">Become a Verified Merchant</h3>
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
          className="flex shrink-0 items-center gap-2 rounded-xl bg-[#3b82f6] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#3b82f6]/20 hover:bg-[#2563eb] transition-all active:scale-[0.97]"
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

      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">

        {/* Page heading */}
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">P2P Trading</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Trade directly with verified merchants — every order is escrow-protected.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              Escrow active
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1">
              <Icon name="shield" className="text-[#3b82f6] text-xs" />
              0% fees
            </span>
          </div>
        </div>

        {/* Stats */}
        <StatsBar />

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">

          {/* Buy / Sell */}
          <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1">
            {(["BUY", "SELL"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-1.5 rounded-lg text-sm font-black transition-all ${
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

          {/* Crypto pills */}
          <div className="flex items-center gap-1.5">
            {CRYPTOS.map((c) => (
              <button
                key={c}
                onClick={() => setCrypto(c)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                  crypto === c
                    ? "bg-[#3b82f6] border-[#3b82f6] text-white shadow shadow-[#3b82f6]/20"
                    : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {CRYPTO_ICONS[c] && (
                  <img
                    src={CRYPTO_ICONS[c]}
                    alt={c}
                    width={15}
                    height={15}
                    className="h-[15px] w-[15px] rounded-full"
                  />
                )}
                {c}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Payment filter */}
          <div className="flex items-center gap-1.5">
            {PAYMENTS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPayment(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  payment === p.value
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/[0.04] border-white/[0.05] text-slate-500 hover:border-white/15 hover:text-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAds}
            title="Refresh"
            className="ml-auto p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <Icon name="refresh" className={`text-lg ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Table header — desktop only, when ads exist */}
        {!loading && ads.length > 0 && (
          <div className="hidden sm:grid grid-cols-[2.5fr_1.3fr_1fr_1.3fr_1fr_120px] gap-4 px-5 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">
            <span>Merchant</span>
            <span>Price</span>
            <span>Available</span>
            <span>Order limit</span>
            <span>Payment</span>
            <span />
          </div>
        )}

        {/* Ad list */}
        <div className="space-y-5">
          {loading ? (
            <AdSkeleton />
          ) : ads.length === 0 ? (
            <EmptyAds side={tab === "BUY" ? "SELL" : "BUY"} isSignedIn={!!isSignedIn} />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 sm:hidden">
                {ads.map((ad) => (
                  <AdCard key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />
                ))}
              </div>
              {/* Desktop rows */}
              <div className="hidden space-y-1.5 sm:block">
                {ads.map((ad) => (
                  <DesktopAdRow key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />
                ))}
              </div>
            </>
          )}

          {/* Merchant CTA */}
          <MerchantPromoBanner isSignedIn={!!isSignedIn} />
        </div>
      </div>
    </>
  );
}
