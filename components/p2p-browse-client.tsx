"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getCached, cachedFetch } from "@/lib/client-cache";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { P2PSubNav } from "@/components/p2p-subnav";
import { formatFiat, FIAT_CURRENCIES } from "@/lib/p2p/currencies";
import { paymentMethodsForFiat, paymentMethodLabel, ALL_PAYMENT_CODES } from "@/lib/p2p/payment-methods";
import { LoadingDots } from "@/components/loading-dots";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdMerchant {
  id?: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  totalTrades?: number;
  completedTrades: number;
  completionRate: number;
  avgReleaseTime: number;
  joinedAt?: string;
}

interface Ad {
  id: string;
  side: "BUY" | "SELL";
  crypto: string;
  fiat: string;
  featured?: boolean;
  pricePerUnit: number;
  availableAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  paymentWindow: number;
  terms: string | null;
  merchant: AdMerchant;
}

interface MerchantOffer {
  id: string;
  side: "BUY" | "SELL";
  crypto: string;
  fiat: string;
  pricePerUnit: number;
  availableAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
}

interface MerchantProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  isVerified: boolean;
  kycStatus?: string;
  completedTrades: number;
  completionRate: number;
  avgReleaseTime: number;
  totalTrades: number;
  joinedAt: string;
  activeAds: number;
  paymentRails: string[];
  offers: MerchantOffer[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtPm = (m: string) => paymentMethodLabel(m);

// Real flag image (flag emoji doesn't render on Windows). The first two letters
// of every supported ISO-4217 code happen to be the ISO-3166 country (EUR→eu).
const flagUrl = (currencyCode: string) =>
  `https://flagcdn.com/w40/${currencyCode.slice(0, 2).toLowerCase()}.png`;

const formatJoined = (value?: string) => {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-KE", { month: "short", year: "numeric" }).format(date);
};

const formatReleaseTime = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "New";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
};

// ─── Merchant Profile Modal ──────────────────────────────────────────────────

function MerchantProfileModal({ merchant, onClose }: { merchant: AdMerchant; onClose: () => void }) {
  const router = useRouter();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError("");
    setLoading(true);

    if (!merchant.id) {
      setError("Refresh offers to load this merchant profile.");
      setLoading(false);
      return;
    }

    fetch(`/api/p2p/merchants/${merchant.id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Merchant profile is unavailable")))
      .then((data: MerchantProfile) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Merchant profile is unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [merchant.id]);

  const viewOffers = (offer?: MerchantOffer) => {
    const crypto = offer?.crypto ?? profile?.offers[0]?.crypto;
    const side = offer?.side ?? profile?.offers[0]?.side;
    const params = new URLSearchParams();
    if (crypto) params.set("crypto", crypto);
    if (side === "BUY") params.set("side", "SELL");
    onClose();
    router.push(`/p2p${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const source = profile ?? merchant;
  const rails = profile?.paymentRails ?? [];
  const offers = profile?.offers ?? [];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/85 backdrop-blur-sm pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-3.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0e0e14] text-white shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <p className="text-sm font-black">Merchant Profile</p>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex items-start gap-3">
            {source.avatarUrl ? (
              <img src={source.avatarUrl} alt={source.displayName} className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#087cff] text-lg font-black text-white">
                {(source.displayName || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-lg font-black">{source.displayName}</h3>
                {(profile?.isVerified ?? true) && <Icon name="verified" className="text-[17px] text-[#05b957]" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${source.isOnline ? "bg-[#05b957]" : "bg-slate-600"}`} />
                  {source.isOnline ? "Online now" : "Offline"}
                </span>
                <span>Joined {formatJoined(profile?.joinedAt ?? merchant.joinedAt)}</span>
                {profile?.kycStatus && <span>{profile.kycStatus.replace(/_/g, " ")}</span>}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-8 text-center text-xs font-bold text-slate-500">
              <LoadingDots label="Loading merchant" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm font-semibold text-red-300">
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <p className="text-lg font-black">{profile?.completedTrades ?? merchant.completedTrades}</p>
                  <p className="text-[10px] font-bold text-slate-600">Completed</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <p className="text-lg font-black text-[#05b957]">{Number(profile?.completionRate ?? merchant.completionRate).toFixed(0)}%</p>
                  <p className="text-[10px] font-bold text-slate-600">Completion</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <p className="text-lg font-black">{profile?.totalTrades ?? merchant.totalTrades ?? merchant.completedTrades}</p>
                  <p className="text-[10px] font-bold text-slate-600">Total trades</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                  <p className="text-lg font-black">{formatReleaseTime(profile?.avgReleaseTime ?? merchant.avgReleaseTime)}</p>
                  <p className="text-[10px] font-bold text-slate-600">Avg release</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#087cff]/20 bg-[#087cff]/10 px-3 py-3">
                <div className="flex items-start gap-2">
                  <Icon name="shield" className="mt-0.5 text-[18px] text-[#8bc3ff]" />
                  <div>
                    <p className="text-sm font-black">Escrow protected merchant</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Trade only through the order page. Payments and crypto release are tracked by Nezeem so disputes have evidence.
                    </p>
                  </div>
                </div>
              </div>

              {rails.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-600">Payment rails</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rails.map((rail) => (
                      <span key={rail} className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-slate-300">
                        {fmtPm(rail)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">Active offers</p>
                  <span className="text-[11px] font-bold text-slate-500">{profile?.activeAds ?? offers.length}</span>
                </div>
                {offers.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-4 text-center text-xs font-semibold text-slate-500">
                    No active offers right now.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {offers.map((offer) => (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => viewOffers(offer)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                      >
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${offer.side === "SELL" ? "bg-[#05b957]/15 text-[#05b957]" : "bg-red-500/15 text-red-300"}`}>
                          {offer.side === "SELL" ? "Buy" : "Sell"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-white">{offer.crypto} at {formatFiat(offer.pricePerUnit, offer.fiat)}</p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {formatFiat(offer.minLimit, offer.fiat)} - {formatFiat(offer.maxLimit, offer.fiat, { symbol: false })} limits
                          </p>
                        </div>
                        <Icon name="chevron_right" className="text-[17px] text-slate-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Offer Details Modal ─────────────────────────────────────────────────────

function OfferDetailsModal({
  ad,
  marketRef,
  onClose,
  onTrade,
  onMerchantClick,
}: {
  ad: Ad;
  marketRef: number;
  onClose: () => void;
  onTrade: (ad: Ad) => void;
  onMerchantClick: (merchant: AdMerchant) => void;
}) {
  const isBuyingCrypto = ad.side === "SELL";
  const actionLabel = `${isBuyingCrypto ? "Buy" : "Sell"} ${ad.crypto}`;
  const marginPct = marketRef > 0 ? ((ad.pricePerUnit / marketRef) - 1) * 100 : 0;
  const availableFiat = ad.availableAmount * ad.pricePerUnit;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-3.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b11] text-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black sm:text-base">{actionLabel} with {ad.merchant.displayName}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">Offer details</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white/[0.06] hover:text-white">
            <Icon name="close" className="text-[19px]" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => onMerchantClick(ad.merchant)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:border-[#087cff]/30 hover:bg-[#087cff]/5"
              >
                {ad.merchant.avatarUrl ? (
                  <img src={ad.merchant.avatarUrl} alt={ad.merchant.displayName} className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#087cff] text-lg font-black">
                    {(ad.merchant.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-base font-black">{ad.merchant.displayName}</h3>
                    <Icon name="verified" className="text-[16px] text-[#05b957]" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${ad.merchant.isOnline ? "bg-[#05b957]" : "bg-slate-600"}`} />
                      {ad.merchant.isOnline ? "Online now" : "Offline"}
                    </span>
                    <span>Joined {formatJoined(ad.merchant.joinedAt)}</span>
                    <span className="text-[#8bc3ff]">View profile</span>
                  </div>
                </div>
                <Icon name="chevron_right" className="text-[19px] text-slate-600" />
              </button>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-lg font-black">{ad.merchant.completedTrades}</p>
                  <p className="text-[10px] font-bold text-slate-600">Completed trades</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-lg font-black text-[#05b957]">{ad.merchant.completionRate.toFixed(0)}%</p>
                  <p className="text-[10px] font-bold text-slate-600">Completion rate</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-lg font-black">{ad.merchant.totalTrades ?? ad.merchant.completedTrades}</p>
                  <p className="text-[10px] font-bold text-slate-600">Total trades</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <p className="text-lg font-black">{formatReleaseTime(ad.merchant.avgReleaseTime)}</p>
                  <p className="text-[10px] font-bold text-slate-600">Average release</p>
                </div>
              </div>

              <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
                <div className="border-b border-white/[0.06] px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Offer information</p>
                </div>
                <div className="grid sm:grid-cols-2">
                  <div className="border-b border-white/[0.06] p-4 sm:border-r">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Available</p>
                    <p className="mt-1 text-base font-black">{ad.availableAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} {ad.crypto}</p>
                    <p className="text-[11px] font-semibold text-slate-500">Approx. {formatFiat(availableFiat, ad.fiat)}</p>
                  </div>
                  <div className="border-b border-white/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Order limits</p>
                    <p className="mt-1 text-base font-black">{formatFiat(ad.minLimit, ad.fiat)} - {formatFiat(ad.maxLimit, ad.fiat, { symbol: false })}</p>
                    <p className="text-[11px] font-semibold text-slate-500">Per order</p>
                  </div>
                  <div className="border-b border-white/[0.06] p-4 sm:border-b-0 sm:border-r">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Payment window</p>
                    <p className="mt-1 text-base font-black">{ad.paymentWindow || 15} minutes</p>
                    <p className="text-[11px] font-semibold text-slate-500">Complete payment before expiry</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Payment methods</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ad.paymentMethods.map((method) => (
                        <span key={method} className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-slate-300">
                          {fmtPm(method)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Advertiser terms</p>
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-300">
                  {ad.terms?.trim() || "No additional advertiser terms. Use only the selected payment method and keep all communication inside the order chat."}
                </p>
              </section>
            </div>

            <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-2xl border border-white/[0.08] bg-[#12121a] p-4 shadow-xl shadow-black/20">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Offer price</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-black tabular-nums">{formatFiat(ad.pricePerUnit, ad.fiat)}</p>
                  <span className="pb-1 text-xs font-bold text-slate-500">per {ad.crypto}</span>
                </div>
                {marketRef > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-500">Market comparison</span>
                    <span className={`font-black ${marginPct > 0 ? "text-amber-400" : "text-[#05b957]"}`}>
                      {marginPct > 0 ? "+" : ""}{marginPct.toFixed(1)}%
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onTrade(ad)}
                  className={`mt-4 flex h-12 w-full items-center justify-center rounded-xl text-sm font-black text-white transition active:scale-[0.99] ${isBuyingCrypto ? "bg-[#05b957] hover:bg-[#06d169]" : "bg-red-500 hover:bg-red-400"}`}
                >
                  {actionLabel}
                </button>
                <p className="mt-2 text-center text-[10px] font-semibold text-slate-600">Review amount and payment method next</p>
              </div>

              <div className="rounded-2xl border border-[#087cff]/20 bg-[#087cff]/10 p-4">
                <div className="flex gap-3">
                  <Icon name="shield" className="mt-0.5 text-[22px] text-[#55aaff]" />
                  <div>
                    <p className="text-sm font-black">Escrow protected</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                      Crypto is locked when the order opens. Never pay outside the order instructions or release before confirming receipt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
                <p className="text-sm font-black text-amber-200">Cancellation policy</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                  The fiat payer may cancel before marking payment as sent. After payment is marked, use dispute support instead of cancelling.
                </p>
              </div>
            </aside>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.07] bg-[#0b0b11]/95 p-3 sm:hidden">
          <button
            type="button"
            onClick={() => onTrade(ad)}
            className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-black text-white ${isBuyingCrypto ? "bg-[#05b957]" : "bg-red-500"}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Modal ──────────────────────────────────────────────────────────────

function OrderModal({ ad, onClose, onMerchantClick }: { ad: Ad; onClose: () => void; onMerchantClick: (merchant: AdMerchant) => void }) {
  const router = useRouter();
  const [inputMode, setInputMode]         = useState<"fiat" | "crypto">("fiat");
  const [rawInput, setRawInput]           = useState("");
  const [selectedPayment, setSelectedPayment] = useState(ad.paymentMethods[0] ?? "");
  const [submitting, setSubmitting]       = useState(false);

  // Derive fiat and crypto amounts from whichever field is active
  const fiatNum    = inputMode === "fiat"   ? Number(rawInput) : Number(rawInput) * ad.pricePerUnit;
  const cryptoAmount = inputMode === "crypto" ? Number(rawInput) : (Number(rawInput) ? Number(rawInput) / ad.pricePerUnit : 0);

  const isBuyingCrypto = ad.side === "SELL";
  const hasOrderLimits = true; // both buy and sell ads now have order limits (partial fills)
  const mustUseFullAmount = !hasOrderLimits && !!rawInput && Math.abs(cryptoAmount - ad.availableAmount) > 0.00000001;
  const belowMin          = hasOrderLimits && !!rawInput && fiatNum < ad.minLimit;
  const aboveMax          = hasOrderLimits && !!rawInput && fiatNum > ad.maxLimit;
  const exceedsAvailable  = !!rawInput && cryptoAmount > 0 && cryptoAmount > ad.availableAmount;
  const valid             = hasOrderLimits
    ? fiatNum >= ad.minLimit && fiatNum <= ad.maxLimit && cryptoAmount > 0 && !exceedsAvailable
    : cryptoAmount > 0 && !mustUseFullAmount && !exceedsAvailable;
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
              <span className="font-black text-[#05b957]">{formatFiat(ad.pricePerUnit, ad.fiat)}</span>
              <span className="text-slate-600">{ad.paymentWindow ?? 15}m window</span>
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
              <button
                type="button"
                onClick={() => {
                  if (inputMode === "fiat") {
                    const maxFiat = hasOrderLimits
                      ? Math.min(Math.floor(ad.maxLimit), Math.floor(ad.availableAmount * ad.pricePerUnit))
                      : ad.availableAmount * ad.pricePerUnit;
                    setRawInput(String(maxFiat));
                  } else {
                    setRawInput(ad.availableAmount.toFixed(8));
                  }
                }}
                className="text-sm font-black text-[#f59e0b]"
              >
                Max
              </button>
              </div>
            {hasOrderLimits ? (
              <p className="mt-3 text-[11px] text-slate-500">Limits: {formatFiat(ad.minLimit, ad.fiat)} – {formatFiat(ad.maxLimit, ad.fiat, { symbol: false })}</p>
            ) : (
              <p className="mt-3 text-[11px] text-slate-500">Amount requested: {ad.availableAmount.toLocaleString("en-US", { maximumFractionDigits: 8 })} {ad.crypto}</p>
            )}
            <p className="mt-2 text-[12px] text-slate-500">
              {isBuyingCrypto ? "I will receive" : "I will send"}{" "}
              <span className="text-white">{cryptoAmount > 0 ? cryptoAmount.toFixed(6) : "--"} {ad.crypto}</span>
            </p>
            {(belowMin || aboveMax || exceedsAvailable || mustUseFullAmount) && (
              <p className="mt-2 text-[11px] font-bold text-red-400">
                {belowMin
                  ? `Minimum is ${formatFiat(ad.minLimit, ad.fiat)}`
                  : aboveMax
                  ? `Maximum is ${formatFiat(ad.maxLimit, ad.fiat)}`
                  : exceedsAvailable
                  ? `Only ${ad.availableAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${ad.crypto} available`
                  : `Use the full requested amount of ${ad.availableAmount.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${ad.crypto}`}
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
              <button
                type="button"
                onClick={() => onMerchantClick(ad.merchant)}
                className="flex min-w-0 items-center gap-1 text-left text-sm font-bold text-white transition hover:text-[#8bc3ff]"
              >
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
              <p className="text-[16px] font-black text-white">{fiatNum > 0 ? formatFiat(fiatNum, ad.fiat) : formatFiat(0, ad.fiat)}</p>
              <p className="text-[11px] text-slate-500">{isBuyingCrypto ? "Total Payable" : "Total Receivable"}</p>
            </div>
          <button
            onClick={submit}
            disabled={!valid || submitting}
              className={`h-11 rounded-full text-sm font-black text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98] ${actionTone}`}
          >
            {submitting ? (
              <LoadingDots label="Placing order" />
              ) : isBuyingCrypto ? "Buy" : "Sell"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Currency picker (searchable modal) ────────────────────────────────────────

function FiatSelect({ value, onChange, inline = false }: { value: string; onChange: (code: string) => void; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = FIAT_CURRENCIES.find((f) => f.code === value) ?? FIAT_CURRENCIES[0];

  const term = q.trim().toLowerCase();
  const filtered = term
    ? FIAT_CURRENCIES.filter((f) => f.code.toLowerCase().includes(term) || f.name.toLowerCase().includes(term))
    : FIAT_CURRENCIES;

  function pick(code: string) { onChange(code); setOpen(false); setQ(""); }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Currency"
        className={inline
          ? "flex shrink-0 items-center gap-0.5 rounded bg-white/[0.06] py-0.5 pl-1.5 pr-1 text-[10px] font-black text-slate-200 transition-colors hover:bg-white/[0.12]"
          : "flex h-8 shrink-0 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.04] pl-2.5 pr-1.5 text-xs font-black text-white transition-colors hover:border-white/20"}
      >
        {current.code}
        <Icon name="expand_more" className={inline ? "text-[14px] text-slate-400" : "text-base text-slate-400"} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/80 px-4 pt-[8vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#111118] shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <h3 className="text-sm font-black text-white">Select currency</h3>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white">
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="shrink-0 p-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <Icon name="search" className="text-[18px] text-slate-500" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search currency"
                  className="h-10 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 [scrollbar-width:thin]">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-600">No currency matches “{q}”</p>
              ) : filtered.map((f) => (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => pick(f.code)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${f.code === value ? "bg-[#087cff]/15" : "hover:bg-white/[0.06]"}`}
                >
                  <img src={flagUrl(f.code)} alt="" className="h-6 w-8 shrink-0 rounded-sm object-cover" />
                  <span className="text-sm font-black text-white">{f.code}</span>
                  <span className="truncate text-xs font-semibold text-slate-500">{f.name}</span>
                  {f.code === value && <Icon name="check" className="ml-auto shrink-0 text-[18px] text-[#087cff]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CryptoSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Crypto"
        className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] pl-1.5 pr-1.5 text-xs font-black text-white transition-colors hover:border-white/20"
      >
        {CRYPTO_ICONS[value] && <img src={CRYPTO_ICONS[value]} alt={value} className="h-4 w-4 rounded-full" />}
        {value === "ALL" ? "All" : value}
        <Icon name="expand_more" className={`text-base text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#111118] p-1 shadow-2xl shadow-black/60">
          {["ALL", ...CRYPTOS].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${c === value ? "bg-[#05b957]/15" : "hover:bg-white/[0.06]"}`}
            >
              {c === "ALL" ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]">
                  <Icon name="apps" className="text-[13px] text-[#75b8ff]" />
                </span>
              ) : (
                CRYPTO_ICONS[c] && <img src={CRYPTO_ICONS[c]} alt={c} className="h-5 w-5 rounded-full" />
              )}
              <span className="text-xs font-black text-white">{c === "ALL" ? "All assets" : c}</span>
              {c === value && <Icon name="check" className="ml-auto text-[15px] text-[#05b957]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentSelect({ value, fiat, onChange }: { value: string; fiat: string; onChange: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = [{ value: "", label: "All payments" }, ...paymentMethodsForFiat(fiat)];
  const current = options.find((o) => o.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative min-w-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Payment method"
        className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 text-xs font-bold text-white transition-colors hover:border-white/20"
      >
        <Icon name="account_balance_wallet" className="text-[14px] text-slate-400" />
        <span className="max-w-[120px] truncate">{current.label}</span>
        <Icon name="expand_more" className={`text-base text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#111118] p-1 shadow-2xl shadow-black/60 [scrollbar-width:thin]">
          {options.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${o.value === value ? "bg-[#087cff]/15" : "hover:bg-white/[0.06]"}`}
            >
              <span className="text-xs font-bold text-white">{o.label}</span>
              {o.value === value && <Icon name="check" className="ml-auto shrink-0 text-[15px] text-[#087cff]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ad Row ──────────────────────────────────────────────────────────────────

const CRYPTO_COLOR: Record<string, string> = {
  USDT: "#26a17b",
  BTC:  "#f7931a",
  ETH:  "#627eea",
  BNB:  "#f0b90b",
  KES:  "#0a7e3f",
};

const AD_COLS = "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_120px]";
const AD_GRID = `lg:grid ${AD_COLS} lg:items-center lg:gap-4`;

function AdCard({
  ad,
  onDetails,
  onMerchantClick,
  marketRef,
}: {
  ad: Ad;
  onDetails: (ad: Ad) => void;
  onMerchantClick: (merchant: AdMerchant) => void;
  marketRef: number;
}) {
  const isMerchantSelling = ad.side === "SELL";
  const color   = CRYPTO_COLOR[ad.crypto] ?? "#087cff";
  const actionLabel = isMerchantSelling ? "Buy" : "Sell";
  const marginPct = marketRef > 0 ? ((ad.pricePerUnit / marketRef) - 1) * 100 : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDetails(ad)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDetails(ad);
        }
      }}
      className={`cursor-pointer border-b border-white/[0.06] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#087cff]/40 sm:px-4 lg:py-2 ${AD_GRID}`}
    >
      {/* ── Advertiser ── */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMerchantClick(ad.merchant);
        }}
        className="flex min-w-0 items-center gap-2 rounded-lg text-left transition hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#087cff]/40"
        title={`View ${ad.merchant.displayName}`}
      >
        <div className="relative shrink-0">
          {ad.merchant.avatarUrl ? (
            <img src={ad.merchant.avatarUrl} alt={ad.merchant.displayName} className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-black" style={{ backgroundColor: color }}>
              {(ad.merchant.displayName || "?").charAt(0).toUpperCase()}
            </div>
          )}
          {ad.merchant.isOnline && (
            <span className="absolute -bottom-0 -right-0 h-2 w-2 rounded-full border-2 border-[#0e0e14] bg-[#05b957]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate text-[12px] font-black text-white">{ad.merchant.displayName}</span>
            <Icon name="verified" className="shrink-0 text-[10px] text-[#05b957]" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-white/45">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#05b957]" />
              {ad.merchant.completionRate.toFixed(0)}%
            </span>
            <span>{ad.merchant.completedTrades} trades</span>
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${ad.merchant.isOnline ? "bg-[#05b957]" : "bg-slate-600"}`} />
              {ad.merchant.isOnline ? "Active" : "Offline"}
            </span>
          </div>
        </div>
      </button>

      {/* ── Price + margin + limits ── */}
      <div className="mt-2 lg:mt-0">
        <p className="lg:hidden text-[9px] font-bold uppercase tracking-wide text-white/35">Price</p>
        <div className="flex flex-wrap items-center gap-1">
          {CRYPTO_ICONS[ad.crypto] && (
            <img src={CRYPTO_ICONS[ad.crypto]} alt={ad.crypto} width={14} height={14} className="h-[14px] w-[14px] shrink-0 rounded-full" />
          )}
          <span className="text-[15px] font-black leading-none text-white tabular-nums lg:text-[14px]">
            {formatFiat(ad.pricePerUnit, ad.fiat, { symbol: false, decimals: 2 })}
          </span>
          <span className="text-[11px] font-bold text-white/45">{ad.fiat}</span>
          {Math.abs(marginPct) >= 0.1 && (
            <span
              title="Price vs live market rate"
              className={`inline-flex items-center rounded-full px-1 text-[10px] font-bold leading-none ${marginPct > 0 ? "text-amber-400/90" : "text-[#05b957]"}`}
            >
              {marginPct > 0 ? "+" : ""}{marginPct.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-white/40">
          Limits <span className="text-white/65">{formatFiat(ad.minLimit, ad.fiat, { symbol: false })} – {formatFiat(ad.maxLimit, ad.fiat, { symbol: false })}</span>
        </p>
      </div>

      {/* ── Payment ── */}
      <div className="mt-2 lg:mt-0">
        <p className="lg:hidden text-[9px] font-bold uppercase tracking-wide text-white/35">Payment</p>
        <div className="flex flex-wrap items-center gap-1">
          {ad.paymentMethods.slice(0, 3).map((m) => (
            <span key={m} className="flex items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
              <span className={`h-2.5 w-0.5 rounded-full ${m === "MPESA" || m === "AIRTEL" || m === "MTN_MOMO" ? "bg-[#05b957]" : "bg-[#f59e0b]"}`} />
              {fmtPm(m)}
            </span>
          ))}
        </div>
      </div>

      {/* ── Available ── */}
      <div className="mt-2 lg:mt-0">
        <p className="lg:hidden text-[9px] font-bold uppercase tracking-wide text-white/35">Available</p>
        <p className="text-[11px] font-bold text-white/80 tabular-nums">
          {ad.availableAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} <span className="text-white/45">{ad.crypto}</span>
        </p>
      </div>

      {/* ── Trade ── */}
      <div className="mt-2 flex items-center justify-end lg:mt-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDetails(ad);
          }}
          className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-[12px] font-black text-white transition active:scale-[0.98] lg:w-auto ${
            isMerchantSelling ? "bg-[#05b957] hover:bg-[#06d169]" : "bg-red-500 hover:bg-red-400"
          }`}
        >
          {actionLabel} {ad.crypto}
        </button>
      </div>
    </div>
  );
}

// ─── Direct-buy promo banner ───────────────────────────────────────────────────

function DirectBuyBanner() {
  return (
    <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-lg border border-[#05b957]/20 bg-gradient-to-r from-[#0c2a1d] via-[#0e1a16] to-[#0e0e14] px-3 py-2.5 sm:px-4">
      <div className="min-w-0">
        <p className="text-[13px] font-black text-white sm:text-sm">Need crypto <span className="text-[#05b957]">right now?</span></p>
        <p className="mt-0.5 text-[10px] font-semibold text-slate-400 sm:text-[11px]">No time to chat? Top up instantly with M-Pesa or crypto.</p>
      </div>
      <Link
        href="/wallet"
        className="shrink-0 rounded-lg bg-[#05b957] px-3 py-2 text-[12px] font-black text-white transition hover:bg-[#06d169] active:scale-[0.98]"
      >
        Direct buy
      </Link>
    </div>
  );
}

// ─── Offers table (one section: promoted or other) ─────────────────────────────

function OffersTable({
  title, ads, marketRefs, onDetails, onMerchantClick, promoted = false,
}: {
  title: string;
  ads: Ad[];
  marketRefs: Record<string, number>;
  onDetails: (ad: Ad) => void;
  onMerchantClick: (merchant: AdMerchant) => void;
  promoted?: boolean;
}) {
  if (ads.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0e0e14]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-black text-white">
          {promoted && <Icon name="bolt" fill className="text-[12px] text-[#f59e0b]" />}
          {title} <span className="text-white/40">({ads.length})</span>
        </span>
      </div>
      {/* Column header — desktop only */}
      <div className={`hidden border-b border-white/[0.05] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white/30 lg:grid lg:gap-4 ${AD_COLS}`}>
        <span>Advertiser</span>
        <span>Price</span>
        <span>Payment</span>
        <span>Available</span>
        <span className="text-right">Trade</span>
      </div>
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} onDetails={onDetails} onMerchantClick={onMerchantClick} marketRef={marketRefs[ad.crypto] ?? 0} />
      ))}
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
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#087cff]/20 bg-[#087cff]/10 px-5 py-2.5 text-sm font-black text-[#087cff] transition-colors hover:bg-[#087cff]/20"
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
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-[#087cff]/20 bg-[#087cff]/10">
                <Icon name={step.icon} className="text-base text-[#087cff]" />
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
    <Link
      href="/p2p/merchant"
      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#111118] px-4 py-3 hover:bg-[#16161f] transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#087cff]/15 border border-[#087cff]/25 shrink-0">
          <Icon name="storefront" className="text-[#087cff] text-base" />
        </div>
        <span className="text-sm font-semibold text-slate-400">
          {isSignedIn ? "Apply to be a merchant" : "Become a merchant"}
        </span>
      </div>
      <Icon name="chevron_right" className="text-lg text-white/25 shrink-0" />
    </Link>
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
  USDC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
  KES:   "https://flagcdn.com/w80/ke.png",
};

// All cryptos supported for P2P (must match the ads API's VALID_CRYPTOS).
// "KES" is the in-app KES Coin, backed 1:1 by fiat wallet balance.
const CRYPTOS   = ["USDT", "USDC", "BTC", "ETH", "BNB", "KES"];

// ─── Main Component ───────────────────────────────────────────────────────────

const VALID_SIDES   = ["BUY", "SELL"] as const;
const VALID_CRYPTOS_SET = new Set(CRYPTOS);
const VALID_PAYMENTS_SET = new Set<string>(["", ...Array.from(ALL_PAYMENT_CODES)]);
const VALID_FIAT_SET = new Set(FIAT_CURRENCIES.map((f) => f.code));

export function P2PBrowseClient({ defaultFiat = "KES" }: { defaultFiat?: string }) {
  const { isSignedIn }   = useSupabaseAuth();
  const router           = useRouter();
  const pathname         = usePathname();
  const searchParams     = useSearchParams();

  // Initialise from URL params — falls back to safe defaults
  const initTab     = (VALID_SIDES as readonly string[]).includes(searchParams?.get("side") ?? "")
    ? (searchParams?.get("side") as "BUY" | "SELL")
    : "BUY";
  const initCrypto  = VALID_CRYPTOS_SET.has(searchParams?.get("crypto") ?? "")
    ? searchParams?.get("crypto")!
    : "ALL";
  const initPayment = VALID_PAYMENTS_SET.has(searchParams?.get("payment") ?? "")
    ? (searchParams?.get("payment") ?? "")
    : "";
  const initFiat    = VALID_FIAT_SET.has(searchParams?.get("fiat") ?? "")
    ? searchParams?.get("fiat")!
    : (VALID_FIAT_SET.has(defaultFiat) ? defaultFiat : "KES");

  const [tab, setTabState]          = useState<"BUY" | "SELL">(initTab);
  const [crypto, setCryptoState]    = useState(initCrypto);
  const [payment, setPaymentState]  = useState(initPayment);
  const [fiat, setFiatState]        = useState(initFiat);
  const [amountInput, setAmountInput] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Ad | null>(null);
  const [orderAd, setOrderAd] = useState<Ad | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<AdMerchant | null>(null);

  // Sync state to URL whenever filters change
  const pushUrl = useCallback((newTab: string, newCrypto: string, newPayment: string, newFiat: string) => {
    const p = new URLSearchParams();
    if (newTab !== "BUY")     p.set("side",    newTab);
    if (newCrypto !== "ALL")  p.set("crypto",  newCrypto);
    if (newPayment)           p.set("payment", newPayment);
    if (newFiat !== "KES")    p.set("fiat",    newFiat);
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router, pathname]);

  const setTab = useCallback((t: "BUY" | "SELL") => {
    setTabState(t);
    pushUrl(t, crypto, payment, fiat);
  }, [crypto, payment, fiat, pushUrl]);

  const setCrypto = useCallback((c: string) => {
    setCryptoState(c);
    pushUrl(tab, c, payment, fiat);
  }, [tab, payment, fiat, pushUrl]);

  const setPayment = useCallback((p: string) => {
    setPaymentState(p);
    pushUrl(tab, crypto, p, fiat);
  }, [tab, crypto, fiat, pushUrl]);

  const setFiat = useCallback((f: string) => {
    setFiatState(f);
    // Remember the manual choice for 1 year so it overrides geo-detection next visit.
    document.cookie = `user_fiat=${f}; path=/; max-age=31536000; samesite=lax`;
    // If the active payment filter isn't a rail for the new currency, clear it.
    const stillValid = payment === "" || paymentMethodsForFiat(f).some((m) => m.value === payment);
    const nextPayment = stillValid ? payment : "";
    if (nextPayment !== payment) setPaymentState(nextPayment);
    pushUrl(tab, crypto, nextPayment, f);
  }, [tab, crypto, payment, pushUrl]);

  const adsKey = `/api/p2p/ads?${new URLSearchParams({
    side:   tab === "BUY" ? "SELL" : "BUY",
    crypto,
    fiat,
    ...(payment ? { payment } : {}),
  })}`;

  // Initialise to SSR-consistent values (empty + loading). Reading the
  // client-only cache here would diverge from the server render and trigger a
  // hydration mismatch, so we seed from cache in an effect after mount instead.
  const [ads, setAds]         = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  // Seed instantly from the session cache once mounted (post-hydration).
  useEffect(() => {
    const cached = getCached<Ad[]>(adsKey);
    if (cached) { setAds(cached); setLoading(false); }
    // Only on mount — the fetch effect below keeps it fresh thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAds = useCallback(async (force = false) => {
    if (!ads.length) setLoading(true);
    const data = await cachedFetch<Ad[]>(adsKey, force);
    if (data) setAds(data);
    setLoading(false);
  }, [adsKey, ads.length]);

  useEffect(() => { fetchAds(true); }, [fetchAds]);

  // Live spot rate (CoinGecko) for the selected crypto+fiat; null until loaded
  // or if the provider is unavailable.
  const [spotRate, setSpotRate] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSpotRate(null);
    if (crypto === "ALL") return () => { cancelled = true; };
    fetch(`/api/p2p/spot?crypto=${crypto}&fiat=${fiat}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { rate?: number | null } | null) => {
        if (!cancelled && typeof d?.rate === "number" && d.rate > 0) setSpotRate(d.rate);
      })
      .catch(() => { /* fall back to median */ });
    return () => { cancelled = true; };
  }, [crypto, fiat]);

  // Amount filter — show only offers whose limits cover the entered amount (in fiat).
  const amountNum = Number(amountInput) || 0;
  const visibleAds = amountNum > 0
    ? ads.filter((a) => amountNum >= a.minLimit && amountNum <= a.maxLimit)
    : ads;

  const median = (prices: number[]) => {
    const sorted = prices.filter((price) => price > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Each asset needs its own reference. A single median across KES, USDT, BTC,
  // etc. makes percentages meaningless when the "All" filter is active.
  const marketRefs = visibleAds.reduce<Record<string, number>>((refs, ad) => {
    if (refs[ad.crypto] != null) return refs;
    refs[ad.crypto] = median(
      visibleAds.filter((candidate) => candidate.crypto === ad.crypto).map((candidate) => candidate.pricePerUnit),
    );
    return refs;
  }, {});

  if (crypto !== "ALL" && spotRate != null) marketRefs[crypto] = spotRate;

  const marketRef = crypto === "ALL" ? 0 : (marketRefs[crypto] ?? 0);
  const rateIsLive = spotRate != null;
  const openOrder = (ad: Ad) => {
    if (!isSignedIn) {
      toast.error("Please sign in to trade");
      return;
    }
    setSelectedOffer(null);
    setOrderAd(ad);
  };

  // Promoted = merchant-paid featured ads. If none are featured yet, fall back
  // to a heuristic (top active online merchants) so the section isn't empty.
  const featuredAds = visibleAds.filter((a) => a.featured);
  const promoted = featuredAds.length > 0
    ? featuredAds
    : [...visibleAds]
        .sort((a, b) =>
          (Number(b.merchant.isOnline) - Number(a.merchant.isOnline)) ||
          (b.merchant.completedTrades - a.merchant.completedTrades),
        )
        .slice(0, Math.min(2, visibleAds.length));
  const promotedIds = new Set(promoted.map((a) => a.id));
  const otherAds = visibleAds.filter((a) => !promotedIds.has(a.id));

  return (
    <>
      {selectedOffer && (
        <OfferDetailsModal
          ad={selectedOffer}
          marketRef={marketRefs[selectedOffer.crypto] ?? 0}
          onClose={() => setSelectedOffer(null)}
          onTrade={openOrder}
          onMerchantClick={setSelectedMerchant}
        />
      )}
      {orderAd && <OrderModal ad={orderAd} onClose={() => setOrderAd(null)} onMerchantClick={setSelectedMerchant} />}
      {selectedMerchant && <MerchantProfileModal merchant={selectedMerchant} onClose={() => setSelectedMerchant(null)} />}

      <P2PSubNav />

      <div className="w-full px-3 py-2 sm:px-4 lg:px-3">

        {/* Workspace header */}
        <div className="mb-2 min-w-0">
          <div className="min-w-0 rounded-lg border border-[#1e1e30] bg-[#111118] px-3 py-2">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3 lg:mb-1.5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Nezeem P2P</p>
                <h1 className="text-[15px] font-black leading-tight text-white">{tab === "BUY" ? "Buy" : "Sell"} {crypto === "ALL" ? "Crypto" : crypto}</h1>
                {marketRef > 0 && crypto !== "ALL" ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    <img src={CRYPTO_ICONS[crypto]} alt={crypto} width={14} height={14} className="h-3.5 w-3.5 rounded-full" />
                    1 {crypto} ≈ <span className="text-white">{formatFiat(marketRef, fiat)}</span>
                    <span className="hidden text-slate-600 sm:inline">· {rateIsLive ? "live market price" : "median of offers"}</span>
                  </p>
                ) : (
                  <p className="max-w-md text-xs font-semibold leading-5 text-slate-500 lg:leading-4">
                    Verified merchants, local payments, escrow-protected orders.
                  </p>
                )}
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

              {/* Crypto dropdown + USING */}
              <div className="flex items-center gap-1.5">
                <CryptoSelect value={crypto} onChange={setCrypto} />
                <span className="hidden rounded bg-white/[0.06] px-1.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 sm:inline">Using</span>
              </div>

              {/* Amount */}
              <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] px-2 sm:w-[170px]">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="Amount"
                  className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-600"
                />
                {amountInput && (
                  <button type="button" onClick={() => setAmountInput("")} className="shrink-0 text-slate-600 hover:text-slate-300">
                    <Icon name="close" className="text-[14px]" />
                  </button>
                )}
                {/* Currency filter — sits as the amount suffix */}
                <FiatSelect value={fiat} onChange={setFiat} inline />
              </div>

              {/* Payment dropdown */}
              <PaymentSelect value={payment} fiat={fiat} onChange={setPayment} />
            </div>
          </div>
        </div>

        {/* Offers */}
        <div className="space-y-3">
          {loading ? (
            <AdSkeleton />
          ) : visibleAds.length === 0 ? (
            <EmptyAds side={tab === "BUY" ? "SELL" : "BUY"} isSignedIn={!!isSignedIn} />
          ) : (
            <>
              <OffersTable title="Promoted offers" ads={promoted} marketRefs={marketRefs} onDetails={setSelectedOffer} onMerchantClick={setSelectedMerchant} promoted />
              <DirectBuyBanner />
              <OffersTable title="Other offers" ads={otherAds} marketRefs={marketRefs} onDetails={setSelectedOffer} onMerchantClick={setSelectedMerchant} />
            </>
          )}

          {visibleAds.length > 0 && <MerchantPromoBanner isSignedIn={!!isSignedIn} />}
        </div>
      </div>
    </>
  );
}
