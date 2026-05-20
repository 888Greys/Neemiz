"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

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

  const isBuyingCrypto = ad.side === "SELL"; // merchant sells → buyer buys

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adId: ad.id,
          cryptoAmount: cryptoAmount.toFixed(8),
          paymentMethod: selectedPayment,
        }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[#111827] border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-black ${isBuyingCrypto ? "text-[#31c45d]" : "text-red-400"}`}>
                {isBuyingCrypto ? "Buy" : "Sell"} {ad.crypto}
              </span>
              <span className="text-slate-400 text-sm font-bold">· {ad.fiat}</span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">from {ad.merchant.displayName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Price */}
        <div className="bg-white/5 rounded-xl p-4 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {ad.pricePerUnit.toLocaleString("en-KE")}
            </span>
            <span className="text-slate-400 text-sm font-bold">{ad.fiat}/{ad.crypto}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
            <span>Avail: <span className="text-white">{ad.availableAmount.toFixed(4)} {ad.crypto}</span></span>
            <span>Limit: <span className="text-white">KSh {ad.minLimit.toLocaleString()} – {ad.maxLimit.toLocaleString()}</span></span>
          </div>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">
            You pay ({ad.fiat})
          </label>
          <div className={`flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border transition-colors ${
            belowMin || aboveMax ? "border-red-500/50" : fiatInput ? "border-[#087cff]/40" : "border-transparent"
          }`}>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              className="flex-1 bg-transparent text-white text-lg font-bold outline-none placeholder:text-slate-600"
              placeholder={`${ad.minLimit.toLocaleString()} – ${ad.maxLimit.toLocaleString()}`}
              value={fiatInput}
              onChange={(e) => setFiatInput(e.target.value)}
            />
            <span className="text-slate-500 text-sm font-bold shrink-0">{ad.fiat}</span>
          </div>
          {belowMin && (
            <p className="text-red-400 text-xs mt-1 font-medium">Minimum is KSh {ad.minLimit.toLocaleString()}</p>
          )}
          {aboveMax && (
            <p className="text-red-400 text-xs mt-1 font-medium">Maximum is KSh {ad.maxLimit.toLocaleString()}</p>
          )}
        </div>

        {/* You receive */}
        <div className="mb-5">
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">
            You receive ({ad.crypto})
          </label>
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
            <span className="flex-1 text-white text-lg font-bold">
              {cryptoAmount > 0 ? cryptoAmount.toFixed(6) : "—"}
            </span>
            <span className="text-slate-500 text-sm font-bold shrink-0">{ad.crypto}</span>
          </div>
        </div>

        {/* Payment method */}
        {ad.paymentMethods.length > 1 && (
          <div className="mb-5">
            <label className="text-xs font-bold text-slate-400 mb-2 block">Payment method</label>
            <div className="flex flex-wrap gap-2">
              {ad.paymentMethods.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedPayment(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    selectedPayment === m
                      ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]"
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
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
          <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <p className="text-amber-400 text-xs font-medium leading-relaxed">{ad.terms}</p>
          </div>
        )}

        {/* Payment window note */}
        <p className="text-slate-500 text-xs mb-5">
          <Icon name="timer" className="text-sm align-middle mr-1" />
          Payment window: <span className="text-slate-300 font-bold">{ad.paymentWindow} minutes</span>
        </p>

        <button
          onClick={submit}
          disabled={!valid || submitting}
          className="w-full py-3.5 rounded-xl font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed
            bg-[#087cff] hover:bg-[#0570e8] active:scale-[0.98]"
        >
          {submitting ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Placing order…
            </div>
          ) : (
            `${isBuyingCrypto ? "Buy" : "Sell"} ${ad.crypto}`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Ad Card ─────────────────────────────────────────────────────────────────

function AdCard({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";

  function paymentLabel(m: string) {
    if (m === "MPESA") return "M-Pesa";
    if (m === "BANK") return "Bank";
    return m;
  }

  return (
    <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-4 sm:p-5 hover:border-white/[0.12] transition-colors">
      {/* Merchant row */}
      <div className="flex items-center gap-3 mb-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#087cff] to-[#31c45d] flex items-center justify-center text-white font-black text-sm">
            {ad.merchant.displayName.charAt(0).toUpperCase()}
          </div>
          {ad.merchant.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#31c45d] border-2 border-[#0f1623] rounded-full" />
          )}
        </div>
        {/* Name + stats */}
        <div className="min-w-0">
          <p className="text-white font-bold text-sm truncate">{ad.merchant.displayName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-500 text-xs">
              {ad.merchant.completedTrades} trades
            </span>
            <span className="text-slate-700 text-xs">·</span>
            <span className="text-slate-500 text-xs">
              {ad.merchant.completionRate.toFixed(1)}% complete
            </span>
          </div>
        </div>
        {/* Verified badge */}
        <div className="ml-auto shrink-0 flex items-center gap-1 bg-[#087cff]/10 border border-[#087cff]/20 rounded-full px-2 py-0.5">
          <Icon name="verified" className="text-[#087cff] text-sm" />
          <span className="text-[#087cff] text-[10px] font-bold">Verified</span>
        </div>
      </div>

      {/* Price */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white">
            {ad.pricePerUnit.toLocaleString("en-KE")}
          </span>
          <span className="text-slate-500 text-sm font-bold">{ad.fiat}</span>
        </div>
        <p className="text-slate-600 text-xs mt-0.5">per {ad.crypto}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
        <div>
          <p className="text-slate-600 mb-0.5">Available</p>
          <p className="text-slate-300 font-bold">{ad.availableAmount.toFixed(4)}</p>
          <p className="text-slate-600">{ad.crypto}</p>
        </div>
        <div>
          <p className="text-slate-600 mb-0.5">Limit</p>
          <p className="text-slate-300 font-bold">{(ad.minLimit / 1000).toFixed(0)}K–{(ad.maxLimit / 1000).toFixed(0)}K</p>
          <p className="text-slate-600">{ad.fiat}</p>
        </div>
        <div>
          <p className="text-slate-600 mb-0.5">Release</p>
          <p className="text-slate-300 font-bold">~{ad.merchant.avgReleaseTime || "<1"}</p>
          <p className="text-slate-600">min avg</p>
        </div>
      </div>

      {/* Payment methods */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ad.paymentMethods.map((m) => (
          <span
            key={m}
            className="bg-white/5 border border-white/10 rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-400"
          >
            {paymentLabel(m)}
          </span>
        ))}
      </div>

      {/* Action */}
      <button
        onClick={() => {
          if (!isSignedIn) { toast.error("Please sign in to trade"); return; }
          onBuy(ad);
        }}
        className={`w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-[0.98]
          ${isMerchantSelling
            ? "bg-[#31c45d]/15 border border-[#31c45d]/30 text-[#31c45d] hover:bg-[#31c45d]/25"
            : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
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
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon name="swap_horiz" className="text-3xl text-slate-600" />
      </div>
      <p className="text-slate-400 font-bold text-lg mb-1">No {side === "SELL" ? "Buy" : "Sell"} ads</p>
      <p className="text-slate-600 text-sm max-w-xs">
        No merchants are currently {side === "SELL" ? "selling" : "buying"} with the selected filters.
        Try changing the crypto or payment method.
      </p>
    </div>
  );
}

// ─── Main Browse Component ────────────────────────────────────────────────────

const CRYPTOS = ["USDT", "BTC", "ETH", "BNB"];
const PAYMENTS = [
  { value: "", label: "All Methods" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "BANK", label: "Bank Transfer" },
];

export function P2PBrowseClient() {
  const { isSignedIn } = useSupabaseAuth();
  const [tab, setTab] = useState<"BUY" | "SELL">("BUY");
  const [crypto, setCrypto] = useState("USDT");
  const [payment, setPayment] = useState("");
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        side: tab === "BUY" ? "SELL" : "BUY", // BUY tab shows merchant SELL ads
        crypto,
        ...(payment ? { payment } : {}),
      });
      const res = await fetch(`/api/p2p/ads?${params}`);
      const data = await res.json();
      setAds(Array.isArray(data) ? data : []);
    } catch {
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [tab, crypto, payment]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  return (
    <>
      {/* Order modal */}
      {selectedAd && (
        <OrderModal ad={selectedAd} onClose={() => setSelectedAd(null)} />
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white mb-1">P2P Trading</h1>
          <p className="text-slate-500 text-sm">Trade directly with verified merchants. Escrow-protected every time.</p>
        </div>

        {/* Buy / Sell tabs */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit mb-6">
          {(["BUY", "SELL"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${
                tab === t
                  ? t === "BUY"
                    ? "bg-[#31c45d] text-white shadow"
                    : "bg-red-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "BUY" ? "Buy Crypto" : "Sell Crypto"}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Crypto pills */}
          <div className="flex items-center gap-1.5">
            {CRYPTOS.map((c) => (
              <button
                key={c}
                onClick={() => setCrypto(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                  crypto === c
                    ? "bg-[#087cff] border-[#087cff] text-white"
                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
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
                    : "bg-white/5 border-white/[0.06] text-slate-500 hover:border-white/15 hover:text-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAds}
            className="ml-auto text-slate-500 hover:text-white transition-colors p-1.5"
            title="Refresh"
          >
            <Icon name="refresh" className="text-lg" />
          </button>
        </div>

        {/* Table header (desktop) */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 px-5 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          <span>Merchant</span>
          <span>Price</span>
          <span>Available</span>
          <span>Limit ({ads[0]?.fiat ?? "KES"})</span>
          <span>Payment</span>
          <span />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <EmptyAds side={tab === "BUY" ? "SELL" : "BUY"} />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden space-y-3">
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />
              ))}
            </div>

            {/* Desktop: table rows */}
            <div className="hidden sm:block space-y-2">
              {ads.map((ad) => (
                <DesktopAdRow key={ad.id} ad={ad} onBuy={setSelectedAd} isSignedIn={!!isSignedIn} />
              ))}
            </div>
          </>
        )}

        {/* Escrow notice */}
        <div className="mt-10 flex items-start gap-3 bg-[#087cff]/5 border border-[#087cff]/15 rounded-2xl p-4">
          <Icon name="lock" className="text-[#087cff] text-xl shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-bold text-sm mb-0.5">Escrow Protected</p>
            <p className="text-slate-500 text-xs leading-relaxed">
              Nezeem holds the merchant&apos;s crypto in escrow before you pay. Funds are only released after you confirm payment.
              Raise a dispute if anything goes wrong.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Desktop Row ──────────────────────────────────────────────────────────────

function DesktopAdRow({ ad, onBuy, isSignedIn }: { ad: Ad; onBuy: (ad: Ad) => void; isSignedIn: boolean }) {
  const isMerchantSelling = ad.side === "SELL";

  function paymentLabel(m: string) {
    if (m === "MPESA") return "M-Pesa";
    if (m === "BANK") return "Bank";
    return m;
  }

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 items-center bg-[#0f1623] border border-white/[0.06] rounded-xl px-5 py-4 hover:border-white/[0.12] transition-colors">
      {/* Merchant */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#087cff] to-[#31c45d] flex items-center justify-center text-white font-black text-xs">
            {ad.merchant.displayName.charAt(0).toUpperCase()}
          </div>
          {ad.merchant.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#31c45d] border-2 border-[#0f1623] rounded-full" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-sm truncate">{ad.merchant.displayName}</p>
            <Icon name="verified" className="text-[#087cff] text-sm shrink-0" />
          </div>
          <p className="text-slate-500 text-xs">{ad.merchant.completedTrades} trades · {ad.merchant.completionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-white font-black">{ad.pricePerUnit.toLocaleString("en-KE")}</p>
        <p className="text-slate-600 text-xs">{ad.fiat}</p>
      </div>

      {/* Available */}
      <div>
        <p className="text-slate-300 font-bold text-sm">{ad.availableAmount.toFixed(4)}</p>
        <p className="text-slate-600 text-xs">{ad.crypto}</p>
      </div>

      {/* Limit */}
      <div>
        <p className="text-slate-300 font-bold text-sm">
          {ad.minLimit.toLocaleString()} – {ad.maxLimit.toLocaleString()}
        </p>
        <p className="text-slate-600 text-xs">{ad.fiat}</p>
      </div>

      {/* Payment */}
      <div className="flex flex-wrap gap-1">
        {ad.paymentMethods.map((m) => (
          <span key={m} className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
            {paymentLabel(m)}
          </span>
        ))}
      </div>

      {/* Action */}
      <button
        onClick={() => {
          if (!isSignedIn) { toast.error("Please sign in to trade"); return; }
          onBuy(ad);
        }}
        className={`py-2 rounded-lg font-black text-xs transition-all active:scale-[0.97]
          ${isMerchantSelling
            ? "bg-[#31c45d]/15 border border-[#31c45d]/30 text-[#31c45d] hover:bg-[#31c45d]/25"
            : "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
          }`}
      >
        {isMerchantSelling ? `Buy ${ad.crypto}` : `Sell ${ad.crypto}`}
      </button>
    </div>
  );
}
