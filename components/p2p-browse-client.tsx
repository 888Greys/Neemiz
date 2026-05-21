"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// ─── Order Modal ──────────────────────────────────────────────────────────────

function OrderModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const router = useRouter();
  const [fiatInput, setFiatInput] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(ad.paymentMethods[0] ?? "");
  const [submitting, setSubmitting] = useState(false);

  const cryptoAmount = fiatInput ? Number(fiatInput) / ad.pricePerUnit : 0;
  const fiatNum = Number(fiatInput);
  const belowMin = fiatInput && fiatNum < ad.minLimit;
  const aboveMax = fiatInput && fiatNum > ad.maxLimit;
  const valid = fiatNum >= ad.minLimit && fiatNum <= ad.maxLimit && cryptoAmount > 0 && cryptoAmount <= ad.availableAmount;
  const isBuyingCrypto = ad.side === "SELL";

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/orders", {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#0d1420] border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 pt-5 pb-4 border-b border-white/[0.07] rounded-t-2xl ${
          isBuyingCrypto ? "bg-gradient-to-r from-[#31c45d]/10 to-transparent" : "bg-gradient-to-r from-red-500/10 to-transparent"
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xl font-black ${isBuyingCrypto ? "text-[#31c45d]" : "text-red-400"}`}>
                  {isBuyingCrypto ? "Buy" : "Sell"} {ad.crypto}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#087cff] to-[#31c45d] flex items-center justify-center text-white font-black text-[9px]">
                  {ad.merchant.displayName.charAt(0).toUpperCase()}
                </div>
                {ad.merchant.displayName}
                <Icon name="verified" className="text-[#087cff] text-xs" />
                <span className="text-slate-700">·</span>
                <span>{ad.merchant.completedTrades} trades</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
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
              belowMin || aboveMax ? "border-red-500/50" : fiatInput ? "border-[#087cff]/40" : "border-transparent"
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
                      selectedPayment === m ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]" : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {m === "MPESA" ? "M-Pesa" : m === "BANK" ? "Bank Transfer" : m}
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
            <span className="ml-auto flex items-center gap-1 text-[#31c45d]">
              <Icon name="lock" className="text-xs" />
              Escrow protected
            </span>
          </div>

          <button
            onClick={submit}
            disabled={!valid || submitting}
            className={`w-full py-3.5 rounded-xl font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${
              isBuyingCrypto ? "bg-[#31c45d] hover:bg-[#28af52]" : "bg-red-500 hover:bg-red-600"
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

// ─── Desktop Row ──────────────────────────────────────────────────────────────

function DesktopAdRow({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";
  const pm = (m: string) => m === "MPESA" ? "M-Pesa" : m === "BANK" ? "Bank" : m;

  return (
    <div className="grid grid-cols-[2.5fr_1.2fr_1fr_1.2fr_1fr_110px] gap-4 items-center bg-[#0a0f1a] border border-white/[0.05] rounded-xl px-5 py-4 hover:bg-[#0d1320] hover:border-white/[0.10] transition-all group">
      {/* Merchant */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#087cff] to-[#6366f1] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#087cff]/20">
            {ad.merchant.displayName.charAt(0).toUpperCase()}
          </div>
          {ad.merchant.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#31c45d] border-2 border-[#0a0f1a] rounded-full" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-sm truncate">{ad.merchant.displayName}</p>
            <Icon name="verified" className="text-[#087cff] text-xs shrink-0" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
            <span>{ad.merchant.completedTrades} trades</span>
            <span className="text-slate-700">·</span>
            <span className={ad.merchant.completionRate >= 95 ? "text-[#31c45d]" : "text-slate-500"}>{ad.merchant.completionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-white font-black text-sm">{ad.pricePerUnit.toLocaleString("en-KE")}</p>
        <p className="text-slate-600 text-[11px]">{ad.fiat}</p>
      </div>

      {/* Available */}
      <div>
        <p className="text-slate-200 font-bold text-sm">{ad.availableAmount.toFixed(4)}</p>
        <p className="text-slate-600 text-[11px]">{ad.crypto}</p>
      </div>

      {/* Limit */}
      <div>
        <p className="text-slate-200 font-bold text-sm">{(ad.minLimit / 1000).toFixed(0)}K – {(ad.maxLimit / 1000).toFixed(0)}K</p>
        <p className="text-slate-600 text-[11px]">{ad.fiat}</p>
      </div>

      {/* Payment */}
      <div className="flex flex-wrap gap-1">
        {ad.paymentMethods.map((m) => (
          <span key={m} className="bg-[#087cff]/10 border border-[#087cff]/15 rounded-md px-2 py-0.5 text-[10px] font-bold text-[#4da3ff]">
            {pm(m)}
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
            ? "bg-[#31c45d]/15 border border-[#31c45d]/30 text-[#31c45d] hover:bg-[#31c45d] hover:text-white hover:border-[#31c45d]"
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
  const pm = (m: string) => m === "MPESA" ? "M-Pesa" : m === "BANK" ? "Bank" : m;

  return (
    <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-2xl p-4 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#087cff] to-[#6366f1] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#087cff]/20">
              {ad.merchant.displayName.charAt(0).toUpperCase()}
            </div>
            {ad.merchant.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#31c45d] border-2 border-[#0a0f1a] rounded-full" />}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-white font-bold text-sm">{ad.merchant.displayName}</p>
              <Icon name="verified" className="text-[#087cff] text-xs" />
            </div>
            <p className="text-slate-500 text-[11px]">{ad.merchant.completedTrades} trades · {ad.merchant.completionRate.toFixed(1)}%</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
          <Icon name="timer" className="text-xs" />
          ~{ad.merchant.avgReleaseTime || "<1"}m
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl font-black text-white">{ad.pricePerUnit.toLocaleString("en-KE")}</span>
        <span className="text-slate-500 text-sm font-bold">{ad.fiat}</span>
        <span className="text-slate-700 text-xs ml-1">per {ad.crypto}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          <p className="text-slate-600 mb-0.5">Available</p>
          <p className="text-slate-200 font-bold">{ad.availableAmount.toFixed(4)} {ad.crypto}</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg px-3 py-2">
          <p className="text-slate-600 mb-0.5">Order limit</p>
          <p className="text-slate-200 font-bold">{(ad.minLimit/1000).toFixed(0)}K–{(ad.maxLimit/1000).toFixed(0)}K {ad.fiat}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {ad.paymentMethods.map((m) => (
          <span key={m} className="bg-[#087cff]/10 border border-[#087cff]/15 rounded-md px-2 py-0.5 text-[10px] font-bold text-[#4da3ff]">
            {pm(m)}
          </span>
        ))}
      </div>

      <button
        onClick={() => {
          if (!isSignedIn) { toast.error("Please sign in to trade"); return; }
          onBuy(ad);
        }}
        className={`w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] ${
          isMerchantSelling
            ? "bg-[#31c45d]/15 border border-[#31c45d]/30 text-[#31c45d] hover:bg-[#31c45d] hover:text-white"
            : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white"
        }`}
      >
        {isMerchantSelling ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`}
      </button>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyAds({ side }: { side: "BUY" | "SELL" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4">
        <Icon name="swap_horiz" className="text-2xl text-slate-600" />
      </div>
      <p className="text-slate-300 font-bold text-base mb-1">No {side === "SELL" ? "buy" : "sell"} ads right now</p>
      <p className="text-slate-600 text-sm max-w-xs">
        Try a different crypto or payment method. Merchants update their ads frequently.
      </p>
    </div>
  );
}

// ─── Become a Merchant Banner ─────────────────────────────────────────────────

function MerchantPromoBanner({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#087cff]/20 bg-gradient-to-br from-[#087cff]/10 via-[#0d1420] to-[#6366f1]/10 p-6 mt-10">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#087cff]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-[#6366f1]/5 blur-2xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#087cff]/15 border border-[#087cff]/20 shrink-0">
          <Icon name="storefront" className="text-[#087cff] text-2xl" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-black text-lg mb-1">Become a Verified Merchant</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-3">
            Post buy &amp; sell ads with your own prices. Accept M-Pesa or bank transfers.
            All trades are escrow-protected — zero counterparty risk.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            {[
              { icon: "price_change", text: "Set your own spread" },
              { icon: "lock",         text: "Escrow-secured trades" },
              { icon: "verified",     text: "Verified badge" },
              { icon: "payments",     text: "M-Pesa & Bank" },
            ].map(({ icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon name={icon} className="text-[#087cff] text-sm" />
                {text}
              </span>
            ))}
          </div>
        </div>

        <Link
          href="/p2p/merchant"
          className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-[#087cff] text-white font-black text-sm hover:bg-[#0570e8] active:scale-[0.97] transition-all shadow-lg shadow-[#087cff]/30"
        >
          {isSignedIn ? "Apply Now" : "Learn More"}
          <Icon name="arrow_forward" className="text-base" />
        </Link>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CRYPTOS = ["USDT", "BTC", "ETH", "BNB"];
const PAYMENTS = [
  { value: "",       label: "All" },
  { value: "MPESA",  label: "M-Pesa" },
  { value: "BANK",   label: "Bank" },
];

export function P2PBrowseClient() {
  const { isSignedIn } = useSupabaseAuth();
  const [tab, setTab]         = useState<"BUY" | "SELL">("BUY");
  const [crypto, setCrypto]   = useState("USDT");
  const [payment, setPayment] = useState("");
  const [ads, setAds]         = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ side: tab === "BUY" ? "SELL" : "BUY", crypto, ...(payment ? { payment } : {}) });
      const res = await fetch(`/api/p2p/ads?${params}`);
      const data = await res.json();
      setAds(Array.isArray(data) ? data : []);
    } catch { setAds([]); }
    finally { setLoading(false); }
  }, [tab, crypto, payment]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  return (
    <>
      {selectedAd && <OrderModal ad={selectedAd} onClose={() => setSelectedAd(null)} />}

      {/* Sub-navigation */}
      <P2PSubNav />

      {/* Page body */}
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Hero header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">P2P Trading</h1>
            <p className="text-slate-500 text-sm">Trade directly with verified merchants — every order is escrow-protected.</p>
          </div>
          {/* Trust indicators */}
          <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#31c45d] animate-pulse" />
              Escrow active
            </span>
            <span className="flex items-center gap-1">
              <Icon name="shield" className="text-[#087cff] text-xs" />
              0% fees
            </span>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Buy/Sell toggle */}
          <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1">
            {(["BUY", "SELL"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${
                  tab === t
                    ? t === "BUY"
                      ? "bg-[#31c45d] text-white shadow shadow-[#31c45d]/30"
                      : "bg-red-500 text-white shadow shadow-red-500/30"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                  crypto === c
                    ? "bg-[#087cff] border-[#087cff] text-white shadow shadow-[#087cff]/20"
                    : "bg-white/[0.04] border-white/[0.07] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
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

          <button onClick={fetchAds} className="ml-auto text-slate-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]" title="Refresh">
            <Icon name="refresh" className="text-lg" />
          </button>
        </div>

        {/* Table header (desktop) */}
        {!loading && ads.length > 0 && (
          <div className="hidden sm:grid grid-cols-[2.5fr_1.2fr_1fr_1.2fr_1fr_110px] gap-4 px-5 py-2 text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
            <span>Merchant</span>
            <span>Price</span>
            <span>Available</span>
            <span>Order limit</span>
            <span>Payment</span>
            <span />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <EmptyAds side={tab === "BUY" ? "SELL" : "BUY"} />
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {ads.map((ad) => <AdCard key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />)}
            </div>
            <div className="hidden sm:block space-y-1.5">
              {ads.map((ad) => <DesktopAdRow key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />)}
            </div>
          </>
        )}

        {/* Become a Merchant CTA */}
        <MerchantPromoBanner isSignedIn={!!isSignedIn} />
      </div>
    </>
  );
}
