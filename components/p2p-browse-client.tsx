"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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

interface PayMethod {
  id: string;
  type: string;
  name: string;
  accountName: string;
  accountNo: string;
  bankName: string | null;
  isActive: boolean;
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
  feedbackCount: number;
  feedbackAverage: number;
  positiveFeedbackRate: number;
  feedback: MerchantFeedback[];
  offers: MerchantOffer[];
}

interface MerchantFeedback {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  fromUser: {
    displayName: string;
    imageUrl?: string | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtPm = (m: string) => paymentMethodLabel(m);
const p2pRailLabel = (method: string, fiat = "KES") =>
  method === "MPESA" && fiat === "KES" ? "M-PESA Kenya (Safaricom)" : paymentMethodLabel(method);

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

const formatMinutes = (minutes?: number) =>
  `${(Number.isFinite(minutes) && (minutes as number) > 0 ? (minutes as number) : 0).toFixed(2)} Minute(s)`;

const daysAgo = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return `${days.toLocaleString()} Day(s) ago`;
};

// Blue verified seal, shared across the P2P advertiser surfaces.
function VerifiedSeal({ className = "h-[15px] w-[15px]" }: { className?: string }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center" title="Verified merchant" aria-label="Verified merchant">
      <span aria-hidden className="absolute inset-0 m-auto h-2/3 w-2/3 rounded-full bg-[#087cff]/50 blur-[4px] animate-pulse" />
      <svg aria-hidden viewBox="0 0 24 24" className={`relative drop-shadow-[0_0_2px_rgba(8,124,255,0.7)] ${className}`}>
        <defs>
          <linearGradient id="p2p-verified-seal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8bc3ff" />
            <stop offset="45%" stopColor="#087cff" />
            <stop offset="100%" stopColor="#0560c4" />
          </linearGradient>
        </defs>
        <path fill="url(#p2p-verified-seal)" d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z" />
        <path d="M8.2 12.3l2.5 2.5 4.9-5.1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// ─── Merchant Profile Modal ──────────────────────────────────────────────────

function MerchantProfileModal({ merchant, onClose }: { merchant: AdMerchant; onClose: () => void }) {
  const router = useRouter();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"info" | "ads" | "feedback">("info");
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError("");

    if (!merchant.id) {
      setError("Refresh offers to load this merchant profile.");
      return;
    }

    fetch(`/api/p2p/merchants/${merchant.id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Merchant profile is unavailable")))
      .then((data: MerchantProfile) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Merchant profile is unavailable");
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
  const offers = profile?.offers ?? [];

  // Derived stats (real where the API provides them; "—" placeholders for the
  // 30d split / counterparties / deposit fields that arrive with the feedback work).
  const completionRate = Number(profile?.completionRate ?? merchant.completionRate ?? 0);
  const completedTrades = Number(profile?.completedTrades ?? merchant.completedTrades ?? 0);
  const totalTrades = Number(profile?.totalTrades ?? merchant.totalTrades ?? completedTrades);
  const avgRelease = profile?.avgReleaseTime ?? merchant.avgReleaseTime;
  const adsCount = profile?.activeAds ?? offers.length;
  const feedback = profile?.feedback ?? [];
  const feedbackCount = profile?.feedbackCount ?? 0;
  const feedbackAverage = profile?.feedbackAverage ?? 0;
  const positiveFeedbackRate = profile?.positiveFeedbackRate ?? 0;
  const joined = profile?.joinedAt ?? merchant.joinedAt;
  const kycOk = (profile?.kycStatus ?? "").toLowerCase().includes("verif") || (profile?.isVerified ?? true);

  const verifications = [
    { label: "Email", ok: true },
    { label: "SMS", ok: true },
    { label: "KYC", ok: kycOk },
    { label: "Address", ok: true },
  ];

  const tabs = [
    { key: "info" as const, label: "Info" },
    { key: "ads" as const, label: `Ads (${adsCount})` },
    { key: "feedback" as const, label: `Feedback(${feedbackCount})` },
  ];

  const infoStats: { label: string; value: ReactNode; accent?: string }[] = [
    { label: "30d Trades", value: completedTrades.toLocaleString() },
    { label: "30d Completion Rate", value: `${completionRate.toFixed(1)}%` },
    { label: "Avg. Release Time", value: formatMinutes(avgRelease) },
    { label: "Avg. Pay Time", value: "—" },
    { label: "Positive Feedback", value: `${positiveFeedbackRate.toFixed(1)}%` },
    { label: "Avg. Rating", value: feedbackCount > 0 ? `${feedbackAverage.toFixed(1)} / 5` : "—" },
  ];

  const tradeStats: { label: string; value: ReactNode }[] = [
    { label: "Trade Type", value: <span className="underline decoration-dotted underline-offset-2">Multi-Product Trader</span> },
    { label: "Registered", value: daysAgo(joined) },
    { label: "First Trade", value: "—" },
    { label: "Trading Counterparties", value: "—" },
    {
      label: "All Trades",
      value: (
        <span className="block text-right">
          {totalTrades.toLocaleString()} Time(s)
          <span className="block text-[11px] font-semibold text-slate-500">Buy — | Sell —</span>
        </span>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b11] text-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* ── Banner ── */}
          <div
            className="relative h-28 shrink-0"
            style={{ background: "conic-gradient(from 45deg at 50% 45%, #0a4ea8 0deg 90deg, #1a78ff 90deg 180deg, #0a4ea8 180deg 270deg, #1a78ff 270deg 360deg)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-black/10"
            >
              <Icon name="arrow_back" className="text-[22px]" />
            </button>
            <button
              type="button"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/90 transition hover:bg-black/10"
              title="Share"
            >
              <Icon name="share" className="text-[20px]" />
            </button>
          </div>

          {/* ── Identity ── */}
          <div className="shrink-0 px-4 sm:px-5">
            <div className="mt-2 flex items-end justify-between">
              {source.avatarUrl ? (
                <img src={source.avatarUrl} alt={source.displayName} className="h-16 w-16 rounded-full border-[3px] border-[#0b0b11] object-cover ring-1 ring-black/10" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-[#0b0b11] bg-white text-2xl font-black text-slate-700 ring-1 ring-black/10">
                  {(source.displayName || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => setFollowing((f) => !f)}
                className={`mb-1.5 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-black transition ${
                  following ? "bg-white/10 text-slate-200" : "bg-[#087cff] text-white hover:bg-[#1a78ff]"
                }`}
              >
                <Icon name={following ? "check" : "person_add"} className="text-[15px]" />
                {following ? "Following" : "Follow"}
              </button>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              <h3 className="truncate text-lg font-black">{source.displayName}</h3>
              {(profile?.isVerified ?? true) && <VerifiedSeal className="h-[17px] w-[17px]" />}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-[#8bc3ff]">
                <VerifiedSeal className="h-[13px] w-[13px]" />
                Verified Merchant
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300 underline decoration-dotted underline-offset-2">Deposit: — USDT</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1">
              {verifications.map((v) => (
                <span key={v.label} className="flex items-center gap-0.5 text-[11px] font-semibold">
                  <Icon name="check_circle" className={`text-[11px] ${v.ok ? "text-[#087cff]" : "text-slate-600"}`} />
                  <span className={v.ok ? "text-slate-200" : "text-slate-600"}>{v.label}</span>
                </span>
              ))}
            </div>

            {/* ── Tabs ── */}
            <div className="mt-3 flex items-center gap-6 border-b border-white/[0.08]">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative -mb-px pb-2 text-[13px] font-bold transition ${
                    tab === t.key ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t.label}
                  {tab === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#087cff]" />}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2 sm:px-5">
            {error && (
              <div className="mb-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
                Showing available merchant data. {error}
              </div>
            )}
            {tab === "info" ? (
              <>
                <div className="divide-y divide-white/[0.05]">
                  {infoStats.map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2">
                      <span className="text-[12px] text-slate-500">{row.label}</span>
                      <span className="text-[13px] font-bold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-1 divide-y divide-white/[0.05] border-t border-white/[0.05]">
                  {tradeStats.map((row) => (
                    <div key={row.label} className="flex items-start justify-between py-2">
                      <span className="text-[12px] text-slate-500">{row.label}</span>
                      <span className="text-[13px] font-bold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="mt-3 w-full text-center text-[13px] font-bold text-slate-300 transition hover:text-white"
                >
                  Block
                </button>

                <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="verified_user" className="text-[16px] text-[#8bc3ff]" />
                    <p className="text-[13px] font-bold text-slate-200">Nezeem Risk Management</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    To reduce your trading risk, the verified advertiser has already paid a deposit as collateral.
                  </p>
                </div>
              </>
            ) : tab === "ads" ? (
              offers.length === 0 ? (
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
              )
            ) : (
              feedback.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-8 text-center text-xs font-semibold text-slate-500">
                  No feedback yet. Completed traders can leave feedback after settlement.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-slate-400">Received Feedback</span>
                      <span className="text-[13px] font-black text-white">{feedbackAverage.toFixed(1)} / 5</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{feedbackCount} review{feedbackCount === 1 ? "" : "s"}</span>
                      <span>{positiveFeedbackRate.toFixed(1)}% positive</span>
                    </div>
                  </div>
                  {feedback.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                      <div className="flex items-center gap-2">
                        {item.fromUser.imageUrl ? (
                          <img src={item.fromUser.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-[12px] font-black text-white">
                            {item.fromUser.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-black text-white">{item.fromUser.displayName}</p>
                          <p className="text-[11px] font-bold text-[#05b957]">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600">{daysAgo(item.createdAt)}</span>
                      </div>
                      {item.comment && <p className="mt-2 text-[12px] leading-5 text-slate-400">{item.comment}</p>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
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
                    <VerifiedSeal className="h-[17px] w-[17px]" />
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
  const [paymentScreen, setPaymentScreen] = useState<"order" | "select" | "edit">("order");
  const [savedMethods, setSavedMethods] = useState<PayMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PayMethod | null>(null);
  const [editAccountName, setEditAccountName] = useState("");
  const [editAccountNo, setEditAccountNo] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [savingMethod, setSavingMethod] = useState(false);
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
  const actionLabel = isBuyingCrypto ? "Buy" : "Sell";
  const selectableMethods = savedMethods.filter((method) => method.isActive && ad.paymentMethods.includes(method.name));
  const selectedMethod = selectableMethods.find((method) => method.name === selectedPayment) ?? selectableMethods[0] ?? null;

  function toggleMode() {
    setInputMode((m) => m === "fiat" ? "crypto" : "fiat");
    setRawInput("");
  }

  const loadPaymentMethods = useCallback(async () => {
    setMethodsLoading(true);
    try {
      const res = await fetch("/api/p2p/merchant/payment-methods");
      if (!res.ok) throw new Error("Could not load payment methods");
      const methods = await res.json() as PayMethod[];
      setSavedMethods(methods);
      const firstSupported = methods.find((method) => method.isActive && ad.paymentMethods.includes(method.name));
      if (firstSupported && !methods.some((method) => method.name === selectedPayment && method.isActive)) {
        setSelectedPayment(firstSupported.name);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load payment methods");
    } finally {
      setMethodsLoading(false);
    }
  }, [ad.paymentMethods, selectedPayment]);

  useEffect(() => {
    if (!isBuyingCrypto) void loadPaymentMethods();
  }, [isBuyingCrypto, loadPaymentMethods]);

  function startEdit(method: PayMethod) {
    setEditingMethod(method);
    setEditAccountName(method.accountName);
    setEditAccountNo(method.accountNo);
    setEditBankName(method.bankName ?? "");
    setPaymentScreen("edit");
  }

  async function savePaymentMethod() {
    if (!editingMethod) return;
    const accountName = editAccountName.trim();
    const accountNo = editAccountNo.trim();
    const bankName = editBankName.trim();
    if (accountName.length < 2) return toast.error("Enter the account holder name");
    if (accountNo.length < 4) return toast.error("Enter a valid account/phone number");

    setSavingMethod(true);
    try {
      const res = await fetch(`/api/p2p/merchant/payment-methods/${editingMethod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: editingMethod.name,
          accountName,
          accountNo,
          bankName: editBankName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save payment method");
      setSavedMethods((current) => current.map((method) => method.id === data.id ? data : method));
      setEditingMethod(data);
      setSelectedPayment(data.name);
      setPaymentScreen("select");
      toast.success("Payment method saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save payment method");
    } finally {
      setSavingMethod(false);
    }
  }

  async function deletePaymentMethod() {
    if (!editingMethod) return;
    setSavingMethod(true);
    try {
      const res = await fetch(`/api/p2p/merchant/payment-methods/${editingMethod.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete payment method");
      setSavedMethods((current) => current.filter((method) => method.id !== editingMethod.id));
      setEditingMethod(null);
      setSelectedPayment(ad.paymentMethods[0] ?? "");
      setPaymentScreen("select");
      toast.success("Payment method deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete payment method");
    } finally {
      setSavingMethod(false);
    }
  }

  async function addPaymentMethod(method: string) {
    const existing = savedMethods.find((saved) => saved.name === method);
    if (existing) {
      startEdit(existing);
      return;
    }
    setEditingMethod({
      id: "",
      type: method === "BANK" ? "BANK" : "MPESA",
      name: method,
      accountName: "",
      accountNo: "",
      bankName: null,
      isActive: true,
    });
    setEditAccountName("");
    setEditAccountNo("");
    setEditBankName("");
    setPaymentScreen("edit");
  }

  async function createPaymentMethod() {
    if (!editingMethod || editingMethod.id) return savePaymentMethod();
    const accountName = editAccountName.trim();
    const accountNo = editAccountNo.trim();
    const bankName = editBankName.trim();
    if (accountName.length < 2) return toast.error("Enter the account holder name");
    if (accountNo.length < 4) return toast.error("Enter a valid account/phone number");

    setSavingMethod(true);
    try {
      const res = await fetch("/api/p2p/merchant/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: editingMethod.name,
          accountName,
          accountNo,
          bankName: bankName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add payment method");
      setSavedMethods((current) => [...current.filter((method) => method.name !== data.name), data]);
      setEditingMethod(data);
      setSelectedPayment(data.name);
      setPaymentScreen("select");
      toast.success("Payment method added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add payment method");
    } finally {
      setSavingMethod(false);
    }
  }

  async function submit() {
    if (!valid) return;
    if (!isBuyingCrypto && !selectedMethod) {
      toast.error("Add a payment method before placing this sell order");
      setPaymentScreen("select");
      return;
    }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/p2p/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: ad.id, cryptoAmount: cryptoAmount.toFixed(8), paymentMethod: selectedMethod?.name ?? selectedPayment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/p2p/order/${data.orderId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
      setSubmitting(false);
    }
  }

  if (paymentScreen === "select") {
    const supportedRails = paymentMethodsForFiat(ad.fiat).filter((method) => ad.paymentMethods.includes(method.value));
    const unsupportedRails = paymentMethodsForFiat(ad.fiat).filter((method) => !ad.paymentMethods.includes(method.value));
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="flex h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b11] text-white shadow-2xl sm:h-[720px] sm:rounded-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center px-4 py-4">
            <button type="button" onClick={() => setPaymentScreen("order")} className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/[0.06]">
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <h2 className="text-center text-base font-black">Select a payment method</h2>
            <span />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
            <p className="mb-4 text-sm text-slate-200">Select payment methods</p>
            {methodsLoading ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-sm font-bold text-slate-500">Loading payment methods...</div>
            ) : selectableMethods.length > 0 ? (
              <div className="space-y-2">
                {selectableMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setSelectedPayment(method.name);
                      setPaymentScreen("order");
                    }}
                    className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                      selectedPayment === method.name ? "border-[#087cff] bg-[#087cff]/10" : "border-white/[0.10] bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-black text-white">
                          <span className={`h-3.5 w-0.5 rounded-full ${method.name === "MPESA" ? "bg-[#05b957]" : "bg-[#facc15]"}`} />
                          {p2pRailLabel(method.name, ad.fiat)}
                        </p>
                        <p className="mt-3 text-xs font-semibold text-slate-400">{method.accountName}</p>
                        <p className="mt-2 text-sm font-bold text-slate-300">{method.accountNo}</p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(method);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            startEdit(method);
                          }
                        }}
                        className="mt-12 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#8bc3ff] hover:bg-[#087cff]/10"
                        aria-label="Edit payment method"
                      >
                        <Icon name="edit" className="text-[17px]" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-4 text-sm font-bold text-amber-200">
                Add a receiving payment method before selling {ad.crypto}.
              </div>
            )}

            <p className="mb-4 mt-5 text-sm text-slate-200">Add supported payment methods</p>
            <div className="space-y-2">
              {supportedRails.map((method) => (
                <button key={method.value} type="button" onClick={() => void addPaymentMethod(method.value)} className="flex h-12 w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 text-sm text-white">
                  <span className="flex items-center gap-3"><span className={`h-3.5 w-0.5 rounded-full ${method.value === "MPESA" ? "bg-[#05b957]" : "bg-[#facc15]"}`} />Add {p2pRailLabel(method.value, ad.fiat)}</span>
                  <Icon name="add" className="text-[18px]" />
                </button>
              ))}
            </div>
            {unsupportedRails.length > 0 && <button type="button" className="mx-auto mt-6 flex items-center gap-1 text-xs text-slate-500">
              View unsupported payment methods
              <Icon name="keyboard_arrow_down" className="text-[16px]" />
            </button>}
          </div>
        </div>
      </div>
    );
  }

  if (paymentScreen === "edit") {
    const isBankMethod = editingMethod?.name === "BANK" || editingMethod?.type === "BANK";
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="flex h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b11] text-white shadow-2xl sm:h-[720px] sm:rounded-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center px-4 py-4">
            <button type="button" onClick={() => setPaymentScreen("select")} className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/[0.06]">
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <h2 className="truncate text-center text-base font-black">
              {editingMethod?.id ? "Edit" : "Add"} {p2pRailLabel(editingMethod?.name ?? selectedPayment, ad.fiat)}
            </h2>
            <button
              type="button"
              onClick={() => void deletePaymentMethod()}
              disabled={!editingMethod?.id || savingMethod}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-200 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
              aria-label="Delete payment method"
            >
              <Icon name="delete" className="text-[20px]" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-5">
            <label className="mt-3 block text-sm text-slate-400">Name</label>
            <input
              value={editAccountName}
              onChange={(event) => setEditAccountName(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg bg-white/[0.08] px-3 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-[#087cff]/50"
            />
            <p className="mt-2 text-xs leading-4 text-slate-500">
              Use the exact name on the receiving account. Mismatched names can delay release or trigger disputes.
            </p>

            <label className="mt-8 block text-sm text-slate-400">{isBankMethod ? "Account number" : "Phone number"}</label>
            <input
              value={editAccountNo}
              onChange={(event) => setEditAccountNo(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg bg-white/[0.08] px-3 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-[#087cff]/50"
            />
            {isBankMethod && (
              <>
                <label className="mt-5 block text-sm text-slate-400">Bank name</label>
                <input
                  value={editBankName}
                  onChange={(event) => setEditBankName(event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg bg-white/[0.08] px-3 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-[#087cff]/50"
                />
              </>
            )}

            <button
              type="button"
              onClick={() => editingMethod?.id ? void savePaymentMethod() : void createPaymentMethod()}
              disabled={savingMethod}
              className="mt-auto h-12 w-full rounded-lg bg-[#087cff] text-sm font-black text-white shadow-lg shadow-[#087cff]/20 transition hover:bg-[#0a6ee0] disabled:opacity-60"
            >
              {savingMethod ? <LoadingDots label="Saving" /> : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/90 backdrop-blur-md pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[calc(100dvh-3.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0b11] text-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/[0.07] px-4 py-3 sm:px-5">
          <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center">
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-white hover:bg-white/[0.06]"
            >
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <div className="min-w-0 text-center">
              <h2 className="truncate text-[15px] font-black sm:text-base">{actionLabel} {ad.crypto}</h2>
              <p className="text-[11px] font-semibold text-slate-400">Price {formatFiat(ad.pricePerUnit, ad.fiat)}</p>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-white/[0.06] hover:text-white"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-5 sm:p-5">
          <section className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="mb-6 flex items-center justify-between border-b border-white/[0.06]">
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => { setInputMode("fiat"); setRawInput(""); }}
                  className={`pb-2 text-[12px] font-black ${inputMode === "fiat" ? "border-b-2 border-[#facc15] text-white" : "text-slate-500"}`}
                >
                  By {ad.fiat}
                </button>
                <button
                  type="button"
                  onClick={() => { setInputMode("crypto"); setRawInput(""); }}
                  className={`pb-2 text-[12px] font-black ${inputMode === "crypto" ? "border-b-2 border-[#facc15] text-white" : "text-slate-500"}`}
                >
                  By {ad.crypto}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                className="min-w-0 flex-1 appearance-none bg-transparent text-[28px] font-light text-white outline-none placeholder:text-slate-700 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                All
              </button>
              </div>
            {hasOrderLimits ? (
              <p className="mt-3 text-[11px] text-slate-500">
                Limit {inputMode === "crypto"
                  ? `${(ad.minLimit / ad.pricePerUnit).toFixed(2)} - ${(ad.maxLimit / ad.pricePerUnit).toFixed(2)} ${ad.crypto}`
                  : `${formatFiat(ad.minLimit, ad.fiat)} - ${formatFiat(ad.maxLimit, ad.fiat, { symbol: false })}`}
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-slate-500">Amount requested: {ad.availableAmount.toLocaleString("en-US", { maximumFractionDigits: 8 })} {ad.crypto}</p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Balance available in your P2P wallet
              <button type="button" className="ml-1 inline-grid h-4 w-4 place-items-center rounded-full border border-slate-600 text-[10px] text-slate-500">+</button>
            </p>
            <p className="mt-2 flex items-center justify-between text-[12px] text-slate-500">
              <span>{isBuyingCrypto ? "You Receive" : "You Receive"}</span>
              <span className="text-white">{isBuyingCrypto ? `${cryptoAmount > 0 ? cryptoAmount.toFixed(6) : "0"} ${ad.crypto}` : `${fiatNum > 0 ? formatFiat(fiatNum, ad.fiat, { symbol: false }) : "0"} ${ad.fiat}`}</span>
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

          <section className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            {isBuyingCrypto ? ad.paymentMethods.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setSelectedPayment(m);
                }}
                className={`flex w-full items-center justify-between text-left text-sm font-black transition-colors ${selectedPayment === m ? "text-white" : "text-slate-500"}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3.5 w-0.5 rounded-full bg-[#05b957]" />
                  <span className="truncate">{p2pRailLabel(m, ad.fiat)}</span>
                </span>
                {selectedPayment === m && <Icon name="check" className="text-[18px] text-[#087cff]" />}
              </button>
            )) : (
              <button
                type="button"
                onClick={() => setPaymentScreen("select")}
                className="flex w-full items-center justify-between text-left text-sm font-black text-white"
              >
                {selectedMethod ? (
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-3.5 w-0.5 rounded-full ${selectedMethod.name === "MPESA" ? "bg-[#05b957]" : "bg-[#facc15]"}`} />
                      <span className="truncate">{p2pRailLabel(selectedMethod.name, ad.fiat)}</span>
                    </span>
                    <span className="mt-1 block truncate pl-2 text-xs font-semibold text-slate-500">
                      {selectedMethod.accountName} · {selectedMethod.accountNo}
                    </span>
                  </span>
                ) : (
                  <span className="flex min-w-0 items-center gap-2 text-slate-300">
                    <span className="h-3.5 w-0.5 rounded-full bg-[#05b957]" />
                    Select a payment method
                  </span>
                )}
                <Icon name="edit" className="text-[18px] text-[#8bc3ff]" />
              </button>
            )}
          </section>

          <section className="border-t border-white/[0.07] pt-5">
            <h3 className="mb-4 text-sm font-black text-white">Advertiser&apos;s Info</h3>
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onMerchantClick(ad.merchant)}
                className="flex min-w-0 items-center gap-1 text-left text-sm font-bold text-white transition hover:text-[#8bc3ff]"
              >
                {ad.merchant.displayName}
                <VerifiedSeal />
                <Icon name="chevron_right" className="text-[15px] text-slate-500" />
              </button>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-[#05b957]" />
                Online
              </div>
            </div>
            <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-500">
              {ad.terms || "Merchants may include additional terms in their advertiser terms. Please review them carefully before placing an order."}
            </p>
          </section>
        </div>

        <div className="shrink-0 border-t border-white/[0.07] bg-[#0b0b11]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-5">
          <button
            onClick={submit}
            disabled={!valid || submitting}
              className={`h-12 w-full rounded-xl text-sm font-black text-white transition-all disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98] ${actionTone}`}
          >
            {submitting ? (
              <LoadingDots label="Placing order" />
              ) : "Place Order"}
          </button>
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
          : "flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] pl-1.5 pr-1.5 text-xs font-black text-white transition-colors hover:border-white/20"}
      >
        <img
          src={flagUrl(current.code)}
          alt=""
          className={inline ? "h-3 w-[18px] shrink-0 rounded-[2px] object-cover" : "h-4 w-6 shrink-0 rounded-[3px] object-cover"}
        />
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
          {CRYPTOS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${c === value ? "bg-[#087cff]/15" : "hover:bg-white/[0.06]"}`}
            >
              {c === "ALL" ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08]">
                  <Icon name="apps" className="text-[13px] text-[#75b8ff]" />
                </span>
              ) : (
                CRYPTO_ICONS[c] && <img src={CRYPTO_ICONS[c]} alt={c} className="h-5 w-5 rounded-full" />
              )}
              <span className="text-xs font-black text-white">{c === "ALL" ? "All assets" : c}</span>
              {c === value && <Icon name="check" className="ml-auto text-[15px] text-[#087cff]" />}
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
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-white/[0.06] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#087cff]/40 sm:px-4 lg:block lg:py-2 ${AD_GRID}`}
    >
      {/* ── Advertiser ── */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMerchantClick(ad.merchant);
        }}
        className="col-span-2 flex min-w-0 items-center gap-2 rounded-lg text-left transition hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-[#087cff]/40"
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
            <VerifiedSeal className="h-[13px] w-[13px]" />
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
      <div className="mt-2 min-w-0 lg:mt-0">
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
      <div className="mt-2 min-w-0 justify-self-end text-right lg:mt-0 lg:justify-self-auto lg:text-left">
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
      <div className="mt-2 min-w-0 lg:mt-0">
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
          className={`flex h-8 w-auto items-center justify-center gap-1.5 rounded-lg px-4 text-[12px] font-black text-white transition active:scale-[0.98] ${
            isMerchantSelling ? "bg-[#05b957] hover:bg-[#06d169]" : "bg-red-500 hover:bg-red-400"
          }`}
        >
          {actionLabel}
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
        prefetch={false}
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
          No {side === "SELL" ? "sell" : "buy"} offers available
        </p>
        <p className="text-sm text-slate-500">
          Try a different crypto or payment filter — or be the first to post.
        </p>
        {isSignedIn && (
          <Link
            href="/p2p/merchant"
            prefetch={false}
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
      prefetch={false}
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
    : "USDT";
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

  // On first load, if the user didn't pick a crypto via URL and the default
  // filter has no offers, auto-switch to whichever crypto has the most ads — so
  // they never land on a blank list. Runs once.
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current) return;
    if (VALID_CRYPTOS_SET.has(searchParams?.get("crypto") ?? "")) return; // explicit choice
    autoPickedRef.current = true;
    const params = new URLSearchParams({ side: tab === "BUY" ? "SELL" : "BUY", fiat });
    fetch(`/api/p2p/ads?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Ad[]) => {
        if (!Array.isArray(all) || all.length === 0) return;
        const counts = all.reduce<Record<string, number>>((acc, a) => {
          acc[a.crypto] = (acc[a.crypto] ?? 0) + 1;
          return acc;
        }, {});
        if ((counts[crypto] ?? 0) > 0) return; // current default already has ads
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (best && best !== crypto) setCrypto(best);
      })
      .catch(() => { /* ignore — keep default */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link from "Order again": open the merchant's profile modal once ads load.
  const merchantOpenedRef = useRef(false);
  useEffect(() => {
    if (merchantOpenedRef.current) return;
    const mid = searchParams?.get("merchant");
    if (!mid || loading) return;
    merchantOpenedRef.current = true;
    const fromAd = ads.find((a) => a.merchant.id === mid)?.merchant;
    setSelectedMerchant(
      fromAd ?? { id: mid, displayName: "Merchant", isOnline: false, completedTrades: 0, completionRate: 0, avgReleaseTime: 0 },
    );
  }, [ads, loading, searchParams]);

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
      {orderAd && <OrderModal ad={orderAd} onClose={() => setOrderAd(null)} onMerchantClick={setSelectedMerchant} />}
      {selectedMerchant && <MerchantProfileModal merchant={selectedMerchant} onClose={() => setSelectedMerchant(null)} />}

      <P2PSubNav />

      <div className="mx-auto w-full max-w-6xl px-3 py-2 sm:px-4 lg:px-3">

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
              <OffersTable title="Promoted offers" ads={promoted} marketRefs={marketRefs} onDetails={openOrder} onMerchantClick={setSelectedMerchant} promoted />
              <DirectBuyBanner />
              <OffersTable title="Other offers" ads={otherAds} marketRefs={marketRefs} onDetails={openOrder} onMerchantClick={setSelectedMerchant} />
            </>
          )}

          {visibleAds.length > 0 && <MerchantPromoBanner isSignedIn={!!isSignedIn} />}
        </div>
      </div>
    </>
  );
}
