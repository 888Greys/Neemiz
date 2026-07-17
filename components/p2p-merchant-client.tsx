"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { createClient } from "@/lib/supabase/client";
import { P2PSubNav } from "@/components/p2p-subnav";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { formatFiat, FIAT_CURRENCIES } from "@/lib/p2p/currencies";
import { paymentMethodLabel, accountIdentifierLabel, ALL_PAYMENT_CODES, methodAllowedForFiat } from "@/lib/p2p/payment-methods";
import { MARKETS, type Market } from "@/lib/payments/country-methods";
import { ACTIVE_LOCAL_COINS, isActiveLocalCoin } from "@/lib/p2p/local-coins";
import { PaymentLogo } from "@/components/p2p/payment-logo";
import { LoadingDots } from "@/components/loading-dots";
import { MerchantAvatar } from "@/components/p2p-merchant-avatar";
import { currencyFlagUrl } from "@/components/market-currency-picker";
import {
  WORLD_COUNTRIES,
  findCountryByCurrency,
  countryFlagUrl,
} from "@/lib/payments/world-countries";
import { convertFromKes } from "@/lib/currency-config";
import { PaymentMethodsSheet } from "@/components/p2p-market-chrome";

// ─── Supported P2P cryptos ────────────────────────────────────────────────────

// In-app local coins (KES Coin today; UG/TZ/… ready to switch on once the
// wallet can hold their currency) are generated from the shared registry so
// adding a country coin is a one-line change in lib/p2p/local-coins.ts.
const LOCAL_COIN_CRYPTOS = ACTIVE_LOCAL_COINS.map((c) => ({
  symbol: c.currency,
  name: `${c.name} · in-app`,
  icon: `https://flagcdn.com/w80/${c.flagCode}.png`,
  color: "#0a7e3f",
}));

const P2P_CRYPTOS: Array<{ symbol: string; name: string; icon: string; color: string }> = [
  { symbol: "USDT", name: "Tether",       icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg", color: "#26a17b" },
  { symbol: "USDC", name: "USD Coin",     icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg", color: "#2775ca" },
  { symbol: "BTC",  name: "Bitcoin",      icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",  color: "#f7931a" },
  { symbol: "ETH",  name: "Ethereum",     icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",  color: "#627eea" },
  { symbol: "BNB",  name: "BNB",          icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",  color: "#f0b90b" },
  ...LOCAL_COIN_CRYPTOS,
];

const P2P_SYMBOLS = P2P_CRYPTOS.map((c) => c.symbol);

const flagUrl = (currencyCode: string) => currencyFlagUrl(currencyCode);

// ─── Types ────────────────────────────────────────────────────────────────────

interface MerchantStatus {
  applied: boolean;
  id?: string;
  displayName?: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  kycStatus?: "PENDING" | "APPROVED" | "REJECTED";
  kycNote?: string | null;
  createdAt?: string;
  totalTrades?: number;
  completedTrades?: number;
  completionRate?: number;
  avgReleaseTime?: number;
  activeAds?: number;
  feedbackCount?: number;
  feedbackAverage?: number;
  positiveFeedbackRate?: number;
  feedback?: MerchantFeedback[];
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

interface Deposit {
  id: string;
  crypto: string;
  amount: number;
  txHash: string;
  network: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

interface Ad {
  id: string;
  side: "BUY" | "SELL";
  crypto: string;
  fiat: string;
  pricePerUnit: number;
  profitMarginPct?: number | null;
  availableAmount: number;
  totalAmount: number;
  minLimit: number;
  maxLimit: number;
  paymentMethods: string[];
  paymentWindow: number;
  terms: string | null;
  isActive: boolean;
  createdAt: string;
  validationError?: string | null;
}

// ─── Apply Landing Page ───────────────────────────────────────────────────────

// ─── Onboarding progress tracker ────────────────────────────────────────────────
// Reflects the merchant's real stage so the journey feels alive and trackable.
// current = index of the in-progress step; everything before it is complete.

/** Bybit-style My Ads empty shell (Active / All + Active Mode + empty CTA). */
function MyAdsEmptyShell({
  onPost,
  banner,
}: {
  onPost: () => void;
  banner?: ReactNode;
}) {
  const [adTab, setAdTab] = useState<"active" | "all">("active");
  const [activeMode, setActiveMode] = useState(false);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 pt-1 sm:px-4">
      <div className="mb-1 flex items-center justify-between py-2">
        <Link
          href="/p2p"
          prefetch={false}
          className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
          aria-label="Back"
        >
          <Icon name="arrow_back" className="text-[22px]" />
        </Link>
        <h1 className="text-[17px] font-bold text-white">My Ads</h1>
        <button
          type="button"
          onClick={onPost}
          className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          aria-label="More"
        >
          <Icon name="more_vert" className="text-[22px]" />
        </button>
      </div>

      <div className="flex items-end justify-between border-b border-white/[0.08]">
        <div className="flex gap-5">
          {(
            [
              { id: "active" as const, label: "Active(0)" },
              { id: "all" as const, label: "All" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAdTab(tab.id)}
              className={`relative pb-2.5 text-[15px] font-bold transition ${
                adTab === tab.id ? "text-white" : "text-slate-500"
              }`}
            >
              {tab.label}
              {adTab === tab.id && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onPost}
          className="mb-2 grid h-8 w-8 place-items-center rounded-full border border-white/[0.12] text-white transition hover:bg-white/[0.06]"
          aria-label="Post ad"
        >
          <Icon name="add" className="text-[20px]" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
        <span className="shrink-0 text-[13px] font-semibold text-white">Active Mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={activeMode}
          onClick={() => setActiveMode((v) => !v)}
          className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition ${
            activeMode ? "bg-[#05b957]" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition ${
              activeMode ? "left-[20px]" : "left-[2px]"
            }`}
          />
        </button>
        <span className="min-w-0 flex-1 text-right text-[12px] font-semibold text-[#087cff]">
          Automatic Inactive Mode
        </span>
      </div>

      {banner}

      <div className="flex min-h-[320px] flex-col items-center justify-center px-4 py-14 text-center">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          aria-hidden
          className="mb-4 text-slate-600"
        >
          <path
            d="M18 14h28l10 10v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M46 14v10h10" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M24 34h24M24 42h18M24 50h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <p className="text-[14px] font-medium text-slate-400">
          Oops, you do not have any active ads.
        </p>
        <button
          type="button"
          onClick={onPost}
          className="mt-6 rounded-full border border-dashed border-white/35 px-8 py-2.5 text-[14px] font-bold text-white transition hover:border-white/55 hover:bg-white/[0.04] active:scale-[0.98]"
        >
          Post Now
        </button>
      </div>
    </div>
  );
}

function ApplyLanding({ onApplied }: { onApplied: () => void }) {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const [submitting, setSubmitting] = useState(false);

  async function applyAsMerchant() {
    if (!isSignedIn) {
      openLogin();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/merchant/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(data.error ?? "Failed");
      toast.success("Advertiser application submitted. Verification usually completes within the hour.");
      onApplied();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MyAdsEmptyShell
      onPost={() => { void applyAsMerchant(); }}
      banner={
        submitting ? (
          <div className="mt-3 rounded-xl bg-[#087cff]/10 px-3.5 py-3 ring-1 ring-[#087cff]/25">
            <p className="text-[13px] font-bold text-[#087cff]">Submitting application…</p>
          </div>
        ) : undefined
      }
    />
  );
}

// ─── Pending / Rejected State ─────────────────────────────────────────────────

function ApplicationStatus({ status, onRefresh }: { status: MerchantStatus; onRefresh: () => void }) {
  const isRejected = status.kycStatus === "REJECTED";

  return (
    <MyAdsEmptyShell
      onPost={() => {
        if (isRejected) {
          toast.error("Your application was not approved. Contact support to re-apply.");
          return;
        }
        toast.info("Verification in progress — you can post ads once approved.");
      }}
      banner={
        <div
          className={`mt-3 rounded-xl px-3.5 py-3 ${
            isRejected
              ? "bg-red-500/10 ring-1 ring-red-500/25"
              : "bg-[#087cff]/10 ring-1 ring-[#087cff]/25"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <Icon
              name={isRejected ? "cancel" : "hourglass_top"}
              className={`mt-0.5 shrink-0 text-[18px] ${isRejected ? "text-red-400" : "text-[#087cff]"}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-bold ${isRejected ? "text-red-300" : "text-[#087cff]"}`}>
                {isRejected ? "Application not approved" : "Under review"}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-slate-400">
                {isRejected
                  ? status.kycNote || "Please contact support if you believe this is a mistake."
                  : "Your advertiser application is under review. Approval usually completes within the hour."}
              </p>
              {isRejected && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="mt-2 text-[12px] font-bold text-white underline underline-offset-2"
                >
                  Refresh status
                </button>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}

// ─── Deposit Status Badge ─────────────────────────────────────────────────────

function Badge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const styles = {
    PENDING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-[#05b957]/10 text-[#05b957] border-[#05b957]/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Deposit Section ──────────────────────────────────────────────────────────

// Network options per crypto
const NETWORK_OPTIONS: Record<string, string[]> = {
  USDT: ["TRC20", "ERC20", "BEP20"],
};

const NETWORK_LABELS: Record<string, string> = {
  TRC20: "Tron (TRC20)",
  ERC20: "Ethereum (ERC20)",
  BEP20: "BNB Smart Chain (BEP20)",
};

const NETWORK_WARN: Record<string, string> = {
  TRC20: "Only send USDT on the Tron network to this address.",
  ERC20: "Only send tokens on the Ethereum network to this address.",
  BEP20: "Only send tokens on the BNB Smart Chain to this address.",
};

interface CryptoBalance {
  crypto: string;
  total: number;
  available: number;
  locked: number;
}

interface WalletCryptoBalance {
  crypto: string;
  network: string;
  available: number;
  locked: number;
}

// ─── Payment methods (where buyers send funds for the merchant's ads) ────────
interface PayMethod {
  id: string; type: string; name: string;
  accountName: string; accountNo: string; bankName: string | null;
}
const BANKISH = new Set(["BANK", "KUDA", "FNB", "CAPITEC"]);

function fmtEscrowAmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 8, minimumFractionDigits: 0 });
  return s;
}

// Two-step payment-method picker (Noones-style): choose a country/market first,
// then a payment method available in that country. Same bottom-sheet chrome.
function MethodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"country" | "method">("country");
  const [market, setMarket] = useState<Market | null>(null);
  const [query, setQuery] = useState("");

  function close() { setOpen(false); }
  // Reset to the country step whenever the sheet closes.
  useEffect(() => { if (!open) { setStep("country"); setMarket(null); setQuery(""); } }, [open]);
  useEffect(() => { setQuery(""); }, [step]);

  const q = query.trim().toLowerCase();
  const countries = MARKETS.filter(
    (m) => !q || m.region.toLowerCase().includes(q) || m.label.toLowerCase().includes(q) || m.currency.toLowerCase().includes(q),
  );
  const methodCodes = (market?.methods ?? []).filter(
    (code) => !q || paymentMethodLabel(code).toLowerCase().includes(q) || code.toLowerCase().includes(q),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="col-span-2 flex h-12 w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-left transition hover:border-white/15 active:scale-[0.99]"
      >
        {value ? (
          <PaymentLogo code={value} size={28} />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06]">
            <Icon name="public" className="text-[16px] text-slate-300" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {value ? "Method" : "Country & method"}
          </span>
          <span className="block truncate text-[14px] font-black text-white">
            {value ? paymentMethodLabel(value) : "Choose your country"}
          </span>
        </span>
        <Icon name="expand_more" className="shrink-0 text-[22px] text-slate-500" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65" onClick={close}>
          <div
            className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#151518] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 px-4 py-3">
              {step === "method" && (
                <button
                  type="button"
                  onClick={() => { setStep("country"); setMarket(null); }}
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-300 hover:bg-white/[0.06]"
                  aria-label="Back to countries"
                >
                  <Icon name="arrow_back" className="text-[18px]" />
                </button>
              )}
              <h3 className="min-w-0 flex-1 truncate text-[17px] font-bold text-white">
                {step === "country" ? "Choose country" : `${market?.region} methods`}
              </h3>
              {step === "country" && <span className="text-[12px] font-semibold text-slate-500">{countries.length}</span>}
              <button
                type="button"
                onClick={close}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"
                aria-label="Close"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="shrink-0 px-4 pb-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3">
                <Icon name="search" className="text-[18px] text-slate-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={step === "country" ? "Search country or currency" : "Search method"}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {step === "country" ? (
                countries.length === 0 ? (
                  <p className="px-3 py-16 text-center text-[13px] font-semibold text-slate-500">No countries found</p>
                ) : (
                  countries.map((m) => (
                    <button
                      key={m.currency}
                      type="button"
                      onClick={() => { setMarket(m); setStep("method"); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flagUrl(m.currency)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-white">{m.region}</span>
                        <span className="block truncate text-[12px] font-semibold text-slate-500">{m.label}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-bold text-slate-500">{m.currency}</span>
                      <Icon name="chevron_right" className="shrink-0 text-[18px] text-slate-600" />
                    </button>
                  ))
                )
              ) : methodCodes.length === 0 ? (
                <p className="px-3 py-16 text-center text-[13px] font-semibold text-slate-500">No methods found</p>
              ) : (
                methodCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { onChange(code); close(); }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] ${
                      code === value ? "bg-white/[0.08]" : ""
                    }`}
                  >
                    <PaymentLogo code={code} size={32} />
                    <span className="min-w-0 flex-1 text-[14px] font-semibold text-white">{paymentMethodLabel(code)}</span>
                    {code === value && <Icon name="check" className="shrink-0 text-[18px] text-white" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Multi-select world payment catalogue for create-ad — same sheet chrome as MethodPicker. */
const MAX_AD_PAYMENT_METHODS = 5;

function maskAccountNo(no: string): string {
  const s = (no ?? "").trim();
  if (s.length <= 4) return s;
  return `•••• ${s.slice(-4)}`;
}

function PaymentMethodsSection({ openSignal = 0 }: { openSignal?: number }) {
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  // No default method — the user picks a country first, then a method in it.
  const [method, setMethod]   = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo]     = useState("");
  const [bankName, setBankName]       = useState("");
  const [saving, setSaving]   = useState(false);
  const isBank = BANKISH.has(method);

  // Jumped here from "Add a payment method" elsewhere → open the form + scroll.
  useEffect(() => {
    if (openSignal > 0) {
      setFormOpen(true);
      window.setTimeout(() => {
        document.getElementById("merchant-payment-methods")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }, [openSignal]);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/p2p/merchant/payment-methods"); if (r.ok) setMethods(await r.json()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!method) return toast.error("Choose a country and payment method");
    if (accountName.trim().length < 2) return toast.error("Enter the account holder name");
    if (accountNo.trim().length < 4)   return toast.error("Enter a valid account/phone number");
    if (isBank && !bankName.trim())    return toast.error("Enter the bank name");
    setSaving(true);
    try {
      const r = await fetch("/api/p2p/merchant/payment-methods", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, accountName: accountName.trim(), accountNo: accountNo.trim(), bankName: isBank ? bankName.trim() : undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success("Payment method saved");
      setMethod(""); setAccountName(""); setAccountNo(""); setBankName("");
      setFormOpen(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    setMethods((m) => m.filter((x) => x.id !== id));
    await fetch(`/api/p2p/merchant/payment-methods/${id}`, { method: "DELETE" }).catch(() => {});
  }

  const showForm = formOpen || (!loading && methods.length === 0);

  return (
    <div id="merchant-payment-methods" className="scroll-mt-24">
      <div className="mb-1 flex items-center justify-between py-1">
        <Link
          href="/p2p/merchant?tab=ads"
          prefetch={false}
          className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
          aria-label="Back"
        >
          <Icon name="arrow_back" className="text-[22px]" />
        </Link>
        <h2 className="text-[17px] font-bold text-white">Payment Method</h2>
        {methods.length > 0 ? (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.12] text-white transition hover:bg-white/[0.06]"
            aria-label={formOpen ? "Close" : "Add"}
          >
            <Icon name={formOpen ? "close" : "add"} className="text-[20px]" />
          </button>
        ) : (
          <span className="w-9" />
        )}
      </div>

      <p className="mb-4 text-center text-[12px] font-medium text-slate-500">
        Where buyers send fiat after opening an order.
      </p>

      {!loading && methods.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
          {methods.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center justify-between gap-2 px-3.5 py-3.5 ${
                i > 0 ? "border-t border-white/[0.06]" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <PaymentLogo code={m.name} size={32} />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white">{paymentMethodLabel(m.name)}{m.bankName ? ` · ${m.bankName}` : ""}</p>
                  <p className="truncate text-[12px] text-slate-400">{m.accountName} · <span className="font-mono">{m.accountNo}</span></p>
                </div>
              </div>
              <button type="button" onClick={() => del(m.id)} className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 active:scale-95" aria-label="Delete">
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-4">
          <MethodPicker value={method} onChange={setMethod} />
          {/* Account details appear only after a country + method are chosen. */}
          {method ? (
            <>
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name"
                className="col-span-2 h-12 rounded-xl border border-transparent bg-white/[0.06] px-3.5 text-[14px] font-semibold text-white outline-none placeholder:text-slate-500 focus:border-[#087cff]/40" />
              <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder={accountIdentifierLabel(method)}
                className={`${isBank ? "" : "col-span-2"} h-12 rounded-xl border border-transparent bg-white/[0.06] px-3.5 text-[14px] font-semibold text-white outline-none placeholder:text-slate-500 focus:border-[#087cff]/40`} />
              {isBank && (
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name"
                  className="h-12 rounded-xl border border-transparent bg-white/[0.06] px-3.5 text-[14px] font-semibold text-white outline-none placeholder:text-slate-500 focus:border-[#087cff]/40" />
              )}
              <button type="button" onClick={add} disabled={saving}
                className="col-span-2 flex h-12 items-center justify-center gap-1.5 rounded-full bg-[#087cff] text-[14px] font-bold text-white transition hover:bg-[#0570e8] active:scale-[0.99] disabled:opacity-50">
                <Icon name="add" className="text-base" /> {saving ? "Saving..." : "Save payment method"}
              </button>
            </>
          ) : (
            <p className="col-span-2 text-center text-[12px] font-medium text-slate-500">
              Pick your country, then the payment method you accept.
            </p>
          )}
        </div>
      )}

      {!loading && methods.length === 0 && !showForm && (
        <div className="flex min-h-[200px] flex-col items-center justify-center py-10 text-center">
          <p className="text-[14px] font-medium text-slate-400">No payment methods yet.</p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-6 rounded-full border border-dashed border-white/35 px-8 py-2.5 text-[14px] font-bold text-white transition hover:border-white/55 hover:bg-white/[0.04] active:scale-[0.98]"
          >
            Add Now
          </button>
        </div>
      )}
    </div>
  );
}

function DepositSection() {
  const { balance: fiatBalance } = useWalletBalance();
  const [open, setOpen]                   = useState(false);
  const [fundOpen, setFundOpen]           = useState(false);
  const [deposits, setDeposits]           = useState<Deposit[]>([]);
  const [loading, setLoading]             = useState(true);
  const [balances, setBalances]           = useState<CryptoBalance[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletCryptoBalance[]>([]);
  const [crypto, setCrypto]               = useState("USDT");
  const [network, setNetwork]             = useState("TRC20");
  const [addrLoading, setAddrLoading]     = useState(false);
  const [address, setAddress]             = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);
  // Fund escrow form state
  const [fundCrypto, setFundCrypto]       = useState("USDT");
  const [fundNetwork, setFundNetwork]     = useState("TRC20");
  const [fundAmount, setFundAmount]       = useState("");
  const [funding, setFunding]             = useState(false);
  // Escrow → wallet form state
  const [e2wOpen, setE2wOpen]             = useState(false);
  const [e2wCrypto, setE2wCrypto]         = useState("USDT");
  const [e2wAmount, setE2wAmount]         = useState("");
  const [e2wLoading, setE2wLoading]       = useState(false);
  const [mobileBalanceCrypto, setMobileBalanceCrypto] = useState("USDT");
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  const load = useCallback(async () => {
    try {
      const [depRes, balRes, walletRes] = await Promise.all([
        fetch("/api/p2p/merchant/deposit"),
        fetch("/api/p2p/merchant/balance"),
        fetch("/api/crypto/balance"),
      ]);
      if (depRes.ok) setDeposits(await depRes.json());
      if (balRes.ok) setBalances(await balRes.json());
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        const rows = Array.isArray(walletData)
          ? walletData
          : (walletData?.balances ?? []);
        setWalletBalances(rows);
      }
    }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load deposit info"); } finally { setLoading(false); }
  }, []);

  async function fundEscrow() {
    const amt = Number(fundAmount);
    if (!fundAmount || !Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    setFunding(true);
    try {
      const r = await fetch("/api/p2p/merchant/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crypto: fundCrypto, network: fundNetwork, amount: amt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success(`${amt} ${fundCrypto} moved to escrow`);
      setFundOpen(false);
      setFundAmount("");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setFunding(false);
    }
  }

  async function escrowToWallet() {
    const amt = Number(e2wAmount);
    if (!e2wAmount || !Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    setE2wLoading(true);
    try {
      const r = await fetch("/api/p2p/merchant/escrow-to-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crypto: e2wCrypto, amount: amt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success(`${amt} ${e2wCrypto} moved to your wallet`);
      setE2wOpen(false);
      setE2wAmount("");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setE2wLoading(false);
    }
  }

  // Unique cryptos the user actually holds in their wallet
  const fundableWalletBalances = walletBalances.filter((b) => b.crypto !== "KES");
  const walletCryptos = fundableWalletBalances
    .map((b) => b.crypto)
    .filter((c, i, arr) => arr.indexOf(c) === i);
  // Networks available for the currently selected fund crypto
  const fundNetworks  = fundableWalletBalances
    .filter((b) => b.crypto === fundCrypto && b.available > 0)
    .map((b) => b.network);

  // Wallet balance for the currently selected fund crypto/network
  const fundWalletBal = fundableWalletBalances.find(
    (b) => b.crypto === fundCrypto && b.network === fundNetwork,
  )?.available ?? 0;

  // Escrow available for currently selected e2w crypto
  const movableEscrowBalances = balances.filter((b) => b.crypto !== "KES" && Number(b.available) > 0);
  const e2wEscrowBal = Number(
    movableEscrowBalances.find((b) => b.crypto === e2wCrypto)?.available ?? 0,
  );
  const formatCoinAmount = (crypto: string, amount: number) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "0";
    if (crypto === "KES" || isActiveLocalCoin(crypto)) {
      return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return n.toFixed(6).replace(/\.?0+$/, "") || "0";
  };

  const activePanel = fundOpen ? "fund" : e2wOpen ? "wallet" : open ? "receive" : null;

  function setPanel(panel: "fund" | "wallet" | "receive" | null) {
    setFundOpen(panel === "fund");
    setE2wOpen(panel === "wallet");
    setOpen(panel === "receive");
    if (panel !== "receive") setAddress(null);
  }

  const balanceSymbols = [
    ...P2P_SYMBOLS,
    ...walletBalances.map((b) => b.crypto),
    ...balances.map((b) => b.crypto),
  ].filter((crypto, index, all) => all.indexOf(crypto) === index);

  const walletDisplayRows = balanceSymbols.map((crypto) => {
    if (crypto === "KES") {
      return {
        crypto,
        network: "fiat",
        available: fiatBalance,
        locked: 0,
      };
    }
    const rows = walletBalances.filter((b) => b.crypto === crypto);
    return {
      crypto,
      network: rows.length > 0
        ? rows.map((b) => b.network).filter((n, i, arr) => arr.indexOf(n) === i).join(", ")
        : crypto === "KES" ? "KES" : "wallet",
      available: rows.reduce((sum, b) => sum + Number(b.available), 0),
      locked: rows.reduce((sum, b) => sum + Number(b.locked), 0),
    };
  });

  const escrowDisplayRows = balanceSymbols.map((crypto) => {
    const escrow = balances.find((b) => b.crypto === crypto);
    return {
      crypto,
      available: crypto === "KES" ? 0 : Number(escrow?.available ?? 0),
      locked: Number(escrow?.locked ?? 0),
    };
  });

  const balanceTableRows = balanceSymbols.map((crypto) => {
    const wallet = walletDisplayRows.find((row) => row.crypto === crypto);
    const escrow = escrowDisplayRows.find((row) => row.crypto === crypto);
    return {
      crypto,
      network: wallet?.network ?? (crypto === "KES" ? "fiat" : "wallet"),
      walletAvailable: Number(wallet?.available ?? 0),
      walletLocked: Number(wallet?.locked ?? 0),
      escrowAvailable: Number(escrow?.available ?? 0),
      escrowLocked: Number(escrow?.locked ?? 0),
    };
  });
  const mobileBalanceOptions = balanceTableRows.filter((row) =>
    row.walletAvailable > 0 || row.escrowAvailable > 0 || row.walletLocked > 0 || row.escrowLocked > 0,
  );
  const mobileSelectableBalances = mobileBalanceOptions.length > 0 ? mobileBalanceOptions : balanceTableRows.slice(0, 1);
  const selectedMobileBalance =
    mobileSelectableBalances.find((row) => row.crypto === mobileBalanceCrypto)
    ?? mobileSelectableBalances[0]
    ?? balanceTableRows[0];
  const selectedMobileMeta = P2P_CRYPTOS.find((coin) => coin.symbol === selectedMobileBalance?.crypto);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedMobileBalance) return;
    if (!mobileSelectableBalances.some((row) => row.crypto === mobileBalanceCrypto)) {
      setMobileBalanceCrypto(selectedMobileBalance.crypto);
    }
  }, [mobileBalanceCrypto, mobileSelectableBalances, selectedMobileBalance]);

  // Auto-select first available wallet crypto/network when balances load
  useEffect(() => {
    if (fundableWalletBalances.length === 0) return;
    const match = fundableWalletBalances.find((b) => b.crypto === fundCrypto && b.available > 0);
    if (!match) {
      const first = fundableWalletBalances.find((b) => b.available > 0) ?? fundableWalletBalances[0];
      setFundCrypto(first.crypto);
      setFundNetwork(first.network);
    } else if (!fundableWalletBalances.find((b) => b.crypto === fundCrypto && b.network === fundNetwork)) {
      setFundNetwork(match.network);
    }
  }, [walletBalances]); // eslint-disable-line react-hooks/exhaustive-deps

  // When crypto changes, reset network to first valid option
  function handleCryptoChange(c: string) {
    setCrypto(c);
    setNetwork(NETWORK_OPTIONS[c][0]);
    setAddress(null);
  }

  async function fetchAddress() {
    setAddrLoading(true);
    setAddress(null);
    try {
      const r = await fetch(`/api/p2p/merchant/deposit-address?crypto=${crypto}&network=${network}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setAddress(d.address);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to get address");
    } finally {
      setAddrLoading(false);
    }
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const qrUrl = address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(address)}&bgcolor=0a0f1a&color=ffffff&margin=2`
    : null;

  const visibleBalanceRows = showZeroBalances
    ? balanceTableRows
    : balanceTableRows.filter(
        (row) => row.walletAvailable > 0 || row.escrowAvailable > 0 || row.walletLocked > 0 || row.escrowLocked > 0,
      );

  const actionBtn = (id: "fund" | "wallet" | "receive", label: string, icon: string) => {
    const on = activePanel === id;
    return (
      <button
        type="button"
        onClick={() => setPanel(on ? null : id)}
        className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-bold transition sm:flex-none sm:px-5 ${
          on
            ? "bg-[#087cff] text-white shadow-lg shadow-[#087cff]/25"
            : "border border-white/[0.1] bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        }`}
      >
        <Icon name={icon} className="text-[18px]" />
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-tight text-white">Wallet</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-slate-500">
              One wallet for deposits and sells. Listing a sell ad locks that amount until it fills or you pause it.
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {actionBtn("receive", "Receive", "qr_code")}
          </div>
        </div>

      {false && fundOpen && (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0d0f14] p-4">
          <p className="mb-3 text-[12px] text-slate-400">Move crypto from your wallet to merchant escrow so you can list sell ads.</p>
          {fundableWalletBalances.length === 0 ? (
            <p className="text-[13px] text-slate-500">No fundable wallet crypto to move. KES Coin uses fiat wallet balance automatically.</p>
          ) : (
          <div className="grid gap-3 sm:grid-cols-[160px_160px_minmax(0,1fr)_160px] sm:items-end">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Crypto</label>
              <div className="flex flex-wrap gap-1.5">
                {walletCryptos.map((c) => {
                  const firstNet = walletBalances.find((b) => b.crypto === c)?.network ?? "TRC20";
                  return (
                    <button key={c} type="button" onClick={() => { setFundCrypto(c); setFundNetwork(firstNet); }}
                      className={`rounded-lg border px-3 py-2 text-[12px] font-bold transition ${
                        fundCrypto === c ? "border-[#087cff] bg-[#087cff]/15 text-[#87b7ff]" : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/20"
                      }`}>{c}</button>
                  );
                })}
              </div>
            </div>
            {fundNetworks.length > 1 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Network</label>
              <div className="flex flex-wrap gap-1.5">
                {fundNetworks.map((n) => (
                  <button key={n} type="button" onClick={() => setFundNetwork(n)}
                    className={`rounded-lg border px-3 py-2 text-[12px] font-bold transition ${
                      fundNetwork === n ? "border-[#087cff] bg-[#087cff]/15 text-[#87b7ff]" : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/20"
                    }`}>{n}</button>
                ))}
              </div>
            </div>
            )}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Amount
                {fundWalletBal > 0 && (
                  <button type="button" onClick={() => setFundAmount(String(fundWalletBal))}
                    className="ml-2 normal-case text-[#087cff] hover:underline">
                    max {formatCoinAmount(fundCrypto, fundWalletBal)}
                  </button>
                )}
              </label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="0.00"
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-[14px] text-white outline-none placeholder:text-slate-600 focus:border-[#087cff]/50"
              />
            </div>
            <button
              type="button"
              onClick={fundEscrow}
              disabled={funding || !fundAmount}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#087cff] px-4 text-[13px] font-bold text-white transition hover:bg-[#0570e8] disabled:opacity-50"
            >
              {funding ? <LoadingDots label="Moving" /> : <><Icon name="arrow_forward" className="text-[18px]" /> Move to Escrow</>}
            </button>
          </div>
          )}
        </div>
      )}

      {false && e2wOpen && (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0d0f14] p-4">
          <p className="mb-3 text-[12px] text-slate-400">Move crypto from your merchant escrow back into your normal wallet.</p>
          {movableEscrowBalances.length === 0 ? (
            <p className="text-[13px] text-slate-500">No movable blockchain crypto in escrow. KES Coin is already backed by the fiat wallet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_160px] sm:items-end">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Crypto</label>
                <div className="flex flex-wrap gap-1.5">
                  {movableEscrowBalances.map((b) => (
                    <button key={b.crypto} type="button" onClick={() => setE2wCrypto(b.crypto)}
                      className={`rounded-lg border px-3 py-2 text-[12px] font-bold transition ${
                        e2wCrypto === b.crypto ? "border-[#087cff] bg-[#087cff]/15 text-[#87b7ff]" : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/20"
                      }`}>{b.crypto}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Amount
                  {e2wEscrowBal > 0 && (
                    <button type="button" onClick={() => setE2wAmount(String(e2wEscrowBal))}
                      className="ml-2 normal-case text-[#087cff] hover:underline">
                      max {formatCoinAmount(e2wCrypto, e2wEscrowBal)}
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  value={e2wAmount}
                  onChange={(e) => setE2wAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-[14px] text-white outline-none placeholder:text-slate-600 focus:border-[#087cff]/50"
                />
              </div>
              <button
                type="button"
                onClick={escrowToWallet}
                disabled={e2wLoading || !e2wAmount}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#087cff] px-4 text-[13px] font-bold text-white transition hover:bg-[#0570e8] disabled:opacity-50"
              >
                {e2wLoading ? <LoadingDots label="Moving" /> : <><Icon name="arrow_downward" className="text-[18px]" /> Move to Wallet</>}
              </button>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0d0f14] p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_180px] lg:items-end">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Crypto</label>
              <div className="flex gap-1.5">
                {["USDT"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCryptoChange(c)}
                    className={`flex-1 rounded-lg border py-2.5 text-[12px] font-bold transition ${
                      crypto === c
                        ? "border-[#087cff] bg-[#087cff]/15 text-[#87b7ff]"
                        : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Network</label>
              <div className="flex flex-wrap gap-1.5">
                {NETWORK_OPTIONS[crypto].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setNetwork(n); setAddress(null); }}
                    className={`rounded-lg border px-3 py-2.5 text-[12px] font-bold transition ${
                      network === n
                        ? "border-[#087cff] bg-[#087cff]/15 text-[#87b7ff]"
                        : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {!address && (
              <button
                type="button"
                onClick={fetchAddress}
                disabled={addrLoading}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#087cff] px-4 text-[13px] font-bold text-white transition hover:bg-[#0570e8] disabled:opacity-50"
              >
                {addrLoading ? <LoadingDots label="Generating" /> : <><Icon name="qr_code" className="text-[18px]" /> Get Address</>}
              </button>
            )}
          </div>

          {address && (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3">
                <Icon name="warning" className="mt-0.5 shrink-0 text-[16px] text-amber-400" />
                <p className="text-[12px] leading-relaxed text-amber-200">{NETWORK_WARN[network]}</p>
              </div>
              <div className="flex flex-col items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 sm:flex-row">
                {qrUrl && (
                  <div className="h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="Deposit QR" width={120} height={120} className="h-full w-full" />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Your {crypto} ({network}) deposit address
                  </p>
                  <p className="mb-3 break-all font-mono text-[12px] leading-relaxed text-white sm:text-[13px]">
                    {address}
                  </p>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold transition ${
                      copied
                        ? "border border-[#05b957]/40 bg-[#05b957]/15 text-[#05b957]"
                        : "border border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.12]"
                    }`}
                  >
                    <Icon name={copied ? "check" : "content_copy"} className="text-[14px]" />
                    {copied ? "Copied!" : "Copy Address"}
                  </button>
                </div>
              </div>
              <p className="flex items-center gap-2 text-[12px] text-slate-500">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#05b957]" />
                Detected on-chain automatically. Funds credit to your wallet in 1–5 minutes — then list a sell ad to lock what you want to sell.
              </p>
            </div>
          )}
        </div>
      )}
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-white">Balances</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Available to sell. Locked is reserved in active sell ads or open orders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowZeroBalances((v) => !v)}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            {showZeroBalances ? "Hide empty" : "Show all assets"}
          </button>
        </div>

        <div className="space-y-2 lg:hidden">
          {(visibleBalanceRows.length ? visibleBalanceRows : []).map((row) => {
            const meta = P2P_CRYPTOS.find((c) => c.symbol === row.crypto);
            const locked = row.walletLocked + row.escrowLocked;
            return (
              <div key={row.crypto} className="rounded-xl border border-white/[0.07] bg-[#0d0f14] p-3.5">
                <div className="mb-3 flex items-center gap-2.5">
                  {meta?.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meta.icon} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-[11px] font-bold text-slate-400">
                      {row.crypto.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <p className="text-[14px] font-bold text-white">{row.crypto}</p>
                    <p className="text-[11px] text-slate-500">{row.network}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Available</p>
                    <p className="mt-0.5 text-[13px] font-bold text-white">{formatCoinAmount(row.crypto, row.walletAvailable + row.escrowAvailable)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Locked</p>
                    <p className={`mt-0.5 text-[13px] font-bold ${locked > 0 ? "text-amber-400" : "text-slate-600"}`}>
                      {formatCoinAmount(row.crypto, locked)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {visibleBalanceRows.length === 0 && (
            <p className="py-8 text-center text-[13px] text-slate-500">No balances yet — receive crypto or show all assets.</p>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-white/[0.07] lg:block">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">Network</th>
                <th className="px-4 py-3 text-right font-semibold">Available</th>
                <th className="px-4 py-3 text-right font-semibold">Locked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {visibleBalanceRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No balances yet — receive crypto or show all assets.
                  </td>
                </tr>
              ) : (
                visibleBalanceRows.map((row) => {
                  const meta = P2P_CRYPTOS.find((c) => c.symbol === row.crypto);
                  const locked = row.walletLocked + row.escrowLocked;
                  return (
                    <tr key={row.crypto} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {meta?.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={meta.icon} alt="" className="h-7 w-7 rounded-full" />
                          ) : (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400">
                              {row.crypto.slice(0, 1)}
                            </span>
                          )}
                          <span className="font-bold text-white">{row.crypto}</span>
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 text-slate-500">{row.network}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-white">
                        {formatCoinAmount(row.crypto, row.walletAvailable + row.escrowAvailable)}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums ${locked > 0 ? "text-amber-400" : "text-slate-600"}`}>
                        {formatCoinAmount(row.crypto, locked)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { icon: "download", text: "Receive crypto to your wallet address first." },
          { icon: "lock", text: "Sell ads lock the listed amount from your wallet until filled or paused." },
          { icon: "percent", text: "Trade fees are deducted when the order releases." },
        ].map((t) => (
          <div key={t.text} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <Icon name={t.icon} className="mt-0.5 text-[16px] text-[#087cff]" />
            <span className="text-[12px] leading-5 text-slate-400">{t.text}</span>
          </div>
        ))}
      </div>

      {deposits.length > 0 && (
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
        <div className="border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
          <p className="text-[14px] font-bold text-white">Recent movements</p>
          <p className="mt-0.5 text-[12px] text-slate-500">Historical escrow transfers (legacy).</p>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.05] text-[11px] uppercase tracking-wider text-slate-500">
                  {[
                    { h: "Date", hide: false },
                    { h: "Crypto", hide: false },
                    { h: "Amount", hide: false },
                    { h: "Network", hide: true },
                    { h: "TX Hash", hide: true },
                    { h: "Status", hide: false },
                  ].map(({ h, hide }) => (
                    <th key={h} className={`px-4 py-3 text-left font-semibold ${hide ? "hidden sm:table-cell" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <tr key={d.id} className={`${i < deposits.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02]`}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</td>
                    <td className="px-4 py-3 font-bold text-white">{d.crypto}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-white">{formatCoinAmount(d.crypto, Number(d.amount))}</td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">{d.network}</td>
                    <td className="hidden px-4 py-3 font-mono text-[11px] text-slate-500 sm:table-cell">
                      {d.txHash ? (
                        <span title={d.txHash}>{d.txHash.length > 14 ? `${d.txHash.slice(0, 7)}…${d.txHash.slice(-7)}` : d.txHash}</span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
      )}
    </div>
  );
}

// ─── Create Ad Modal ──────────────────────────────────────────────────────────

function CreateAdModal({ ad, onClose, onCreated, onSetupPayments }: { ad?: Ad | null; onClose: () => void; onCreated: () => void; onSetupPayments?: () => void }) {
  const isEditing = !!ad;
  const { balance: fiatBalance } = useWalletBalance();
  const [form, setForm] = useState({
    side: ad?.side ?? "SELL",
    crypto: ad?.crypto ?? "USDT",
    fiat: ad?.fiat ?? "KES",
    pricePerUnit: ad ? String(ad.pricePerUnit) : "",
    profitMarginPct: ad?.profitMarginPct != null ? String(ad.profitMarginPct) : "",
    totalAmount: ad ? String(ad.totalAmount) : "",
    minLimit: ad ? String(ad.minLimit) : "",
    maxLimit: ad ? String(ad.maxLimit) : "",
    paymentMethods: ad?.paymentMethods ?? [] as string[],
    paymentWindow: ad ? String(ad.paymentWindow) : "15",
    terms: ad?.terms ?? "",
  });
  const [priceMode, setPriceMode] = useState<"MARKET" | "FIXED">(
    ad?.profitMarginPct != null ? "MARKET" : ad ? "FIXED" : "MARKET",
  );
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0); // 0=Type & Price · 1=Amount & Method · 2=Conditions
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoQuery, setCryptoQuery] = useState("");
  const [fiatOpen, setFiatOpen] = useState(false);
  const [fiatQuery, setFiatQuery] = useState("");
  const [pickerMounted, setPickerMounted] = useState(false);
  const [spotRate, setSpotRate] = useState<number | null>(null);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [escrowBalances, setEscrowBalances] = useState<CryptoBalance[]>([]);
  // In-app local coins + on-chain sells both read from the user wallet.
  const [walletCoinBalances, setWalletCoinBalances] = useState<{ crypto: string; available: number }[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [walletBalancesLoading, setWalletBalancesLoading] = useState(true);
  const [fxToKes, setFxToKes] = useState<Record<string, number> | null>(null);
  // KES already committed to backing the merchant's active sell ads. Subtracted
  // from the wallet so the max sellable amount we offer can actually be created
  // (mirrors the server's getTotalKesReservedForMerchant single source of truth).
  const [reservedKes, setReservedKes] = useState(0);
  const f = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => { setPickerMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/p2p/fx")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { toKES?: Record<string, number> } | null) => {
        if (!cancelled && d?.toKES) setFxToKes(d.toKES);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Only relevant when creating a sell ad; editing sizes off the existing ad.
    if (isEditing) return;
    let cancelled = false;
    fetch("/api/p2p/ads/backing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { reservedKes?: number } | null) => {
        if (!cancelled && typeof d?.reservedKes === "number") setReservedKes(d.reservedKes);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isEditing]);

  useEffect(() => {
    if (!cryptoOpen && !fiatOpen && !paySheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [cryptoOpen, fiatOpen, paySheetOpen]);

  const fiatCountry = useMemo(
    () => findCountryByCurrency(form.fiat) ?? WORLD_COUNTRIES.find((c) => c.currency === form.fiat),
    [form.fiat],
  );

  const filteredCountries = useMemo(() => {
    const q = fiatQuery.trim().toLowerCase();
    if (!q) return WORLD_COUNTRIES;
    return WORLD_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.currencyName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [fiatQuery]);

  // Coins the merchant can sell: wallet holdings (on-chain + local) and fiat KES.
  const heldSymbols = useMemo(() => {
    const held = new Set<string>();
    for (const b of walletCoinBalances) {
      if (Number(b.available) > 0) held.add(b.crypto.toUpperCase());
    }
    // merchant/balance also surfaces wallet + any legacy escrow available.
    for (const b of escrowBalances) {
      if (b.crypto !== "KES" && Number(b.available) > 0) held.add(b.crypto.toUpperCase());
    }
    if (Number(fiatBalance) > 0) held.add("KES");
    return held;
  }, [escrowBalances, walletCoinBalances, fiatBalance]);

  // Free KES = wallet minus what already backs the merchant's active sell ads.
  // Sizing the sellable amount off this (not the raw wallet) keeps the offered
  // max within what the server's backing check will actually allow.
  const freeKes = Math.max(0, Number(fiatBalance) - reservedKes);

  // Sellable amount per in-app coin: own balance + FREE KES converted at FX.
  const localSellableBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    const rates = fxToKes ?? { KES: 1 };
    for (const c of ACTIVE_LOCAL_COINS) {
      const sym = c.currency;
      if (sym === "KES") {
        map.set(sym, Math.max(0, freeKes));
        continue;
      }
      const own = walletCoinBalances
        .filter((b) => b.crypto.toUpperCase() === sym)
        .reduce((sum, b) => sum + Number(b.available), 0);
      const fromKes = convertFromKes(freeKes, sym, rates);
      map.set(sym, Math.max(0, own + fromKes));
    }
    return map;
  }, [fxToKes, freeKes, walletCoinBalances]);

  // Wait for BOTH wallet + merchant balance so USDT isn't greyed out while still loading.
  const balancesReady = !balancesLoading && !walletBalancesLoading;
  const restrictToHeld = form.side === "SELL" && !isEditing && balancesReady;

  const sellableCryptos = useMemo(() => P2P_CRYPTOS, []);

  const filteredCryptos = useMemo(() => {
    const q = cryptoQuery.trim().toLowerCase();
    if (!q) return sellableCryptos;
    return sellableCryptos.filter(
      (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [cryptoQuery, sellableCryptos]);

  function canPickCrypto(symbol: string): boolean {
    if (!restrictToHeld) return true;
    if (isActiveLocalCoin(symbol)) return true;
    return heldSymbols.has(symbol.toUpperCase());
  }

  // On a fresh SELL ad, jump off unheld real crypto onto a held coin or KES.
  useEffect(() => {
    if (!restrictToHeld) return;
    if (canPickCrypto(form.crypto)) return;
    const first =
      P2P_CRYPTOS.find((c) => heldSymbols.has(c.symbol)) ??
      P2P_CRYPTOS.find((c) => c.symbol === "KES") ??
      P2P_CRYPTOS.find((c) => isActiveLocalCoin(c.symbol));
    if (!first) return;
    setForm((p) => ({
      ...p,
      crypto: first.symbol,
      pricePerUnit: isActiveLocalCoin(first.symbol) ? "1" : "",
      profitMarginPct: isActiveLocalCoin(first.symbol) ? "0" : "",
    }));
  }, [restrictToHeld, heldSymbols, form.crypto]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/p2p/merchant/balance")
      .then((response) => response.ok ? response.json() : [])
      .then((balances: CryptoBalance[]) => {
        if (!cancelled) setEscrowBalances(balances);
      })
      .finally(() => {
        if (!cancelled) setBalancesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crypto/balance")
      .then((response) => response.ok ? response.json() : null)
      .then((data: unknown) => {
        if (cancelled || !data) return;
        const rows = Array.isArray(data) ? data : ((data as { balances?: unknown }).balances ?? []);
        // Sum available across networks so USDT/TRC20 + USDT/ERC20 both count.
        const byCrypto = new Map<string, number>();
        for (const row of rows as Array<{ crypto: string; available: number | string }>) {
          const sym = String(row.crypto ?? "").toUpperCase();
          if (!sym) continue;
          byCrypto.set(sym, (byCrypto.get(sym) ?? 0) + Number(row.available));
        }
        setWalletCoinBalances(
          [...byCrypto.entries()].map(([crypto, available]) => ({ crypto, available })),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWalletBalancesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function formatPriceInput(value: number, fiat: string): string {
    if (!Number.isFinite(value) || value <= 0) return "";
    const decimals = fiat === "KES" ? 2 : 4;
    return value.toFixed(decimals).replace(/\.?0+$/, "");
  }

  function setPriceFromMargin(value: string) {
    setForm((p) => {
      const pct = Number(value);
      const isPartialNumber = value === "" || value === "-" || value === "+" || value === "." || value === "-." || value === "+.";
      if (!spotRate || isPartialNumber || !Number.isFinite(pct) || pct <= -100) {
        return { ...p, profitMarginPct: value };
      }
      return {
        ...p,
        profitMarginPct: value,
        pricePerUnit: formatPriceInput(spotRate * (1 + pct / 100), p.fiat),
      };
    });
  }

  function setFixedPrice(value: string) {
    setForm((p) => {
      const price = Number(value);
      if (!spotRate || !Number.isFinite(price) || price <= 0) {
        return { ...p, pricePerUnit: value, profitMarginPct: value === "" ? "" : p.profitMarginPct };
      }
      return {
        ...p,
        pricePerUnit: value,
        profitMarginPct: (((price / spotRate) - 1) * 100).toFixed(2),
      };
    });
  }

  function switchPriceMode(mode: "MARKET" | "FIXED") {
    setPriceMode(mode);
    if (mode === "MARKET" && spotRate) {
      const pct = Number(form.profitMarginPct);
      if (Number.isFinite(pct) && pct > -100) {
        setPriceFromMargin(form.profitMarginPct || "0");
      } else {
        setPriceFromMargin("0");
      }
    }
  }


  // Reference rate for the margin readout. Real cryptos use a live market rate;
  // in-app local coins are pegged 1:1 (no market) so reference is always 1.00.
  useEffect(() => {
    let cancelled = false;
    if (isActiveLocalCoin(form.crypto)) {
      setSpotRate(1);
      setForm((p) => {
        if (isEditing && Number(p.pricePerUnit) > 0) return p;
        if (Number(p.pricePerUnit) > 0 && p.crypto === form.crypto) return p;
        return { ...p, pricePerUnit: p.pricePerUnit || "1", profitMarginPct: p.profitMarginPct || "0" };
      });
      return () => { cancelled = true; };
    }
    setSpotRate(null);
    fetch(`/api/p2p/spot?crypto=${form.crypto}&fiat=${form.fiat}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { rate?: number | null } | null) => {
        if (!cancelled && typeof d?.rate === "number" && d.rate > 0) {
          setSpotRate(d.rate);
          setForm((p) => {
            const currentPrice = Number(p.pricePerUnit);
            // Empty field on open (or after switching asset/currency): prefill with
            // the live market price so the merchant starts from the spot rate.
            if (currentPrice <= 0) {
              if (isEditing) return p;
              return { ...p, pricePerUnit: formatPriceInput(d.rate!, p.fiat), profitMarginPct: "0" };
            }
            return { ...p, profitMarginPct: (((currentPrice / d.rate!) - 1) * 100).toFixed(2) };
          });
        }
      })
      .catch(() => { /* no live rate */ });
    return () => { cancelled = true; };
  }, [form.crypto, form.fiat]);

  const priceNum = Number(form.pricePerUnit) || 0;
  const marginPct = spotRate && priceNum > 0 ? ((priceNum / spotRate) - 1) * 100 : null;
  const canUseMarginPricing = !!spotRate;
  const isKesCoinForm = isActiveLocalCoin(form.crypto); // pegged 1:1; merchant sets a spread %
  const totalAmountNum = Number(form.totalAmount) || 0;
  const maxLimitNum = Number(form.maxLimit) || 0;
  // Create flow: ad size is implied by max order ÷ unit price (no separate "total" field).
  // Edit flow: keep the listed total from the existing ad.
  const effectiveTotalAmount = isEditing
    ? totalAmountNum
    : priceNum > 0 && maxLimitNum > 0
      ? Math.floor((maxLimitNum / priceNum) * 1e8) / 1e8
      : 0;
  const selectedEscrow = escrowBalances.find((balance) => balance.crypto === form.crypto);
  const walletAvailForCrypto = walletCoinBalances
    .filter((b) => b.crypto.toUpperCase() === form.crypto.toUpperCase())
    .reduce((sum, b) => sum + Number(b.available), 0);
  // On-chain sells lock amount + platform fee (~2%) from wallet at ad create.
  // merchant/balance returns wallet available (and auto-drains legacy escrow).
  const ON_CHAIN_FEE_RATE = 0.02;
  const onChainAvailable = Math.max(walletAvailForCrypto, Number(selectedEscrow?.available ?? 0));
  const sellableBalance = isActiveLocalCoin(form.crypto)
    ? Math.max(0, (localSellableBySymbol.get(form.crypto) ?? 0) / 1.01)
    : Math.max(0, onChainAvailable / (1 + ON_CHAIN_FEE_RATE));
  // Max-order shortcut: full fiat value of what's sellable (create) or already listed (edit).
  const fullOrderValue = (() => {
    if (priceNum <= 0) return 0;
    if (isEditing && totalAmountNum > 0) return Math.floor(totalAmountNum * priceNum * 100) / 100;
    if (form.side === "SELL" && sellableBalance > 0) return Math.floor(sellableBalance * priceNum * 100) / 100;
    return 0;
  })();
  const exceedsSellableBalance = !isEditing && form.side === "SELL" && effectiveTotalAmount > sellableBalance;
  const requiredKesBacking = effectiveTotalAmount > 0 ? parseFloat((effectiveTotalAmount * 1.01).toFixed(2)) : 0;
  const needsKesBacking = !isEditing && form.side === "SELL" && form.crypto === "KES" && requiredKesBacking > 0 && freeKes < requiredKesBacking;
  const priceRangeMin = spotRate ? spotRate * 0.8 : priceNum > 0 ? priceNum * 0.8 : null;
  const priceRangeMax = spotRate ? spotRate * 2 : priceNum > 0 ? priceNum * 2 : null;
  const highestOrderPrice = spotRate ? spotRate * 1.1 : priceNum > 0 ? priceNum * 1.1 : null;

  async function submit() {
    // Payment methods are optional — merchants can arrange the rail in chat.
    if (
      !form.pricePerUnit ||
      !form.minLimit || !form.maxLimit
    )
      return toast.error("Please fill all required fields");

    // Order limits now apply to both Buy and Sell ads.
    const minLimit = Number(form.minLimit);
    const maxLimit = Number(form.maxLimit);
    const profitMarginPct = Number(form.profitMarginPct);
    if (priceMode === "MARKET" && canUseMarginPricing && (!Number.isFinite(profitMarginPct) || profitMarginPct <= -100)) {
      return toast.error("Margin must be greater than -100%");
    }
    if (!isEditing && effectiveTotalAmount <= 0) {
      return toast.error(`Enter a max order so we can size the ${form.crypto} amount`);
    }
    if (needsKesBacking) {
      return toast.error(`Top up your fiat wallet first. This KES Coin sell ad needs KSh ${requiredKesBacking.toLocaleString("en-KE")} including the 1% seller fee.`);
    }
    if (exceedsSellableBalance) {
      return toast.error(
        sellableBalance > 0
          ? `You can sell up to ${fmtEscrowAmt(sellableBalance)} ${form.crypto}`
          : isActiveLocalCoin(form.crypto)
          ? `Top up your KES wallet to sell ${form.crypto}`
          : `No ${form.crypto} in your wallet yet`,
      );
    }

    setSubmitting(true);
    try {
      const r = await fetch(isEditing ? "/api/p2p/ads/mine" : "/api/p2p/ads", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ad?.id,
          side: form.side,
          crypto: form.crypto,
          fiat: form.fiat,
          pricePerUnit: Number(form.pricePerUnit),
          profitMarginPct:
            priceMode === "MARKET" && Number.isFinite(Number(form.profitMarginPct))
              ? Number(form.profitMarginPct)
              : null,
          totalAmount: isEditing ? Number(form.totalAmount) : effectiveTotalAmount,
          minLimit,
          maxLimit,
          paymentMethods: form.paymentMethods,
          paymentWindow: Number(form.paymentWindow),
          terms: form.terms || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success(isEditing ? "Ad updated successfully!" : "Ad created successfully!");
      window.dispatchEvent(new CustomEvent("wallet-refresh"));
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  }

  // Validate the current step before advancing. Each guard mirrors a rule that
  // submit() enforces, so the user can't reach the final step with bad input.
  function goNext() {
    if (step === 0) {
      if (priceNum <= 0) return toast.error("Enter a valid price first");
      if (priceMode === "MARKET" && canUseMarginPricing) {
        const pct = Number(form.profitMarginPct);
        if (Number.isFinite(pct) && pct <= -100) return toast.error("Margin must be greater than -100%");
      }
      return setStep(1);
    }
    if (step === 1) {
      if (!form.minLimit || !form.maxLimit) return toast.error("Enter min and max order limits");
      if (!isEditing && effectiveTotalAmount <= 0) return toast.error("Enter a valid max order amount");
      if (needsKesBacking) return toast.error(`Top up your fiat wallet first. This KES Coin sell ad needs KSh ${requiredKesBacking.toLocaleString("en-KE")}.`);
      if (exceedsSellableBalance) return toast.error(`You can sell up to ${sellableBalance.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${form.crypto} from your wallet.`);
      // Payment methods are optional — no "select at least one" gate.
      if (!isEditing) f("totalAmount", String(effectiveTotalAmount));
      return setStep(2);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/90 backdrop-blur-md p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="no-scrollbar flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden border-white/10 bg-[#151518] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:rounded-2xl sm:border md:max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {/* ── Header + stepper ── */}
        <div className="shrink-0 border-b border-white/[0.07] bg-[#151518] px-4 pb-5 pt-[calc(1.1rem+env(safe-area-inset-top))]">
          <div className="mb-6 flex items-center justify-between">
            <button onClick={step === 0 ? onClose : () => setStep((s) => s - 1)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/[0.06] active:scale-95">
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <h3 className="text-[15px] font-black tracking-wide text-white">{isEditing ? "Edit offer" : "Create an offer"}</h3>
            <span className="h-10 w-10" aria-hidden />
          </div>

          <div className="relative grid grid-cols-3 text-center">
            <div className="absolute left-[16.66%] right-[16.66%] top-[11px] h-0.5 -translate-y-1/2 bg-white/[0.08]" />
            <div className="absolute left-[16.66%] top-[11px] h-0.5 -translate-y-1/2 bg-[#087cff] transition-all duration-300" style={{ width: step === 0 ? "0%" : step === 1 ? "33.33%" : "66.66%" }} />
            {["Set Type & Price", "Set Amount & Method", "Set Conditions"].map((label, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <div key={label} className="relative z-[1] flex flex-col items-center">
                  <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-black transition-colors ${active ? "bg-[#087cff] text-white" : done ? "bg-[#087cff]/20 text-[#55aaff]" : "bg-white/[0.06] text-slate-500"}`}>
                    {done ? <Icon name="check" className="text-[14px]" /> : index + 1}
                  </span>
                  <span className={`mt-2.5 max-w-[92px] text-[10px] font-black leading-4 ${active ? "text-white" : done ? "text-slate-300" : "text-slate-500"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">

          {/* ════ STEP 1 — Set Type & Price ════ */}
          {step === 0 && (
          <div className="grid gap-5">
          {/* Side selector */}
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">I want to</label>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#151518]/60 p-1">
              {["BUY","SELL"].map((s) => (
                <button key={s} onClick={() => !isEditing && f("side", s)}
                  disabled={isEditing}
                  className={`h-9 rounded-lg text-[12px] font-black capitalize transition-all ${form.side === s ? (s === "BUY" ? "bg-[#05b957] text-white shadow shadow-[#05b957]/20" : "bg-red-500 text-white shadow shadow-red-500/20") : "text-slate-400 hover:text-white"} ${isEditing ? "cursor-not-allowed opacity-70" : ""}`}>
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
          {/* Crypto — full-page picker (same pattern as fiat) */}
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">Asset</label>
            <button
              type="button"
              disabled={isEditing}
              onClick={() => { if (!isEditing) { setCryptoOpen(true); setCryptoQuery(""); } }}
              className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[14px] font-black text-white transition-colors hover:border-white/20 active:scale-[0.99] disabled:opacity-60"
            >
              {(() => {
                const m = P2P_CRYPTOS.find((c) => c.symbol === form.crypto);
                return m ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.icon} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      <span className="block font-black">{m.symbol}</span>
                      <span className="block truncate text-[11px] font-semibold text-slate-500">{m.name}</span>
                    </span>
                  </>
                ) : <span>{form.crypto}</span>;
              })()}
              {!isEditing && <Icon name="expand_more" className="ml-auto shrink-0 text-[22px] text-slate-500" />}
            </button>
          </div>

          {/* Fiat — full-page country picker */}
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">With Fiat</label>
            <button
              type="button"
              onClick={() => { setFiatOpen(true); setFiatQuery(""); }}
              className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[14px] font-black text-white transition-colors hover:border-white/20 active:scale-[0.99]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fiatCountry ? countryFlagUrl(fiatCountry.code) : flagUrl(form.fiat)}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
              />
              <span className="min-w-0 flex-1 truncate text-left">
                <span className="block font-black">{form.fiat}</span>
                <span className="block truncate text-[11px] font-semibold text-slate-500">
                  {fiatCountry?.name ?? FIAT_CURRENCIES.find((c) => c.code === form.fiat)?.name}
                </span>
              </span>
              <Icon name="expand_more" className="ml-auto shrink-0 text-[22px] text-slate-500" />
            </button>
          </div>
          </div>

          {pickerMounted && cryptoOpen && !isEditing && createPortal(
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={() => setCryptoOpen(false)}>
              <div
                className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#151518] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-h-[min(32rem,80dvh)] sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <h3 className="text-[17px] font-bold text-white">Select Coin</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-500">{filteredCryptos.length}</span>
                  <button
                    type="button"
                    onClick={() => setCryptoOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"
                    aria-label="Close"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
              </div>
              <div className="shrink-0 px-4 pb-2">
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3">
                  <Icon name="search" className="text-[18px] text-slate-500" />
                  <input
                    autoFocus
                    value={cryptoQuery}
                    onChange={(e) => setCryptoQuery(e.target.value)}
                    placeholder="Search Coin"
                    className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                {filteredCryptos.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-[13px] font-semibold text-slate-400">No coins match</p>
                  </div>
                )}
                {filteredCryptos.map((c, index) => {
                  const prev = filteredCryptos[index - 1];
                  const showOnChainHeader = index === 0 && !isActiveLocalCoin(c.symbol);
                  const showInAppHeader =
                    isActiveLocalCoin(c.symbol) && (!prev || !isActiveLocalCoin(prev.symbol));
                  const pickable = canPickCrypto(c.symbol);
                  const localAvail = isActiveLocalCoin(c.symbol)
                    ? localSellableBySymbol.get(c.symbol)
                    : undefined;
                  const escrowAvail = !isActiveLocalCoin(c.symbol)
                    ? escrowBalances.find((b) => b.crypto === c.symbol)
                    : undefined;
                  const walletAvail = !isActiveLocalCoin(c.symbol)
                    ? walletCoinBalances
                        .filter((b) => b.crypto.toUpperCase() === c.symbol.toUpperCase())
                        .reduce((sum, b) => sum + Number(b.available), 0)
                    : 0;
                  const onChainAvail = Math.max(walletAvail, Number(escrowAvail?.available ?? 0));
                  const availLabel = !balancesReady
                    ? "Loading…"
                    : localAvail != null
                    ? `${localAvail.toLocaleString("en-US", { maximumFractionDigits: 2 })} avail`
                    : onChainAvail > 0
                    ? `${onChainAvail.toLocaleString("en-US", { maximumFractionDigits: 8 })} wallet`
                    : !isActiveLocalCoin(c.symbol) && restrictToHeld
                    ? "Deposit to sell"
                    : null;
                  return (
                  <div key={c.symbol}>
                    {showOnChainHeader && (
                      <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        On-chain crypto
                      </p>
                    )}
                    {showInAppHeader && (
                      <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        In-app coins · from KES
                      </p>
                    )}
                  <button
                    type="button"
                    disabled={!pickable}
                    onClick={() => {
                      if (!pickable) return;
                      setForm((p) => ({
                        ...p,
                        crypto: c.symbol,
                        pricePerUnit: isActiveLocalCoin(c.symbol) ? "1" : "",
                        profitMarginPct: isActiveLocalCoin(c.symbol) ? "0" : "",
                      }));
                      setCryptoOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
                      !pickable
                        ? "cursor-not-allowed opacity-45"
                        : form.crypto === c.symbol
                        ? "bg-white/[0.08] hover:bg-white/[0.04]"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold text-white">{c.symbol}</span>
                      <span className="block truncate text-[12px] font-semibold text-slate-500">
                        {c.name}
                        {availLabel ? ` · ${availLabel}` : ""}
                      </span>
                    </span>
                    {form.crypto === c.symbol && pickable && <Icon name="check" className="shrink-0 text-[18px] text-white" />}
                  </button>
                  </div>
                  );
                })}
              </div>
              </div>
            </div>,
            document.body,
          )}

          {pickerMounted && fiatOpen && createPortal(
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={() => setFiatOpen(false)}>
              <div
                className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#151518] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-h-[min(32rem,80dvh)] sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex shrink-0 items-center justify-between px-4 py-3">
                <h3 className="text-[17px] font-bold text-white">Choose country</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-500">{filteredCountries.length}</span>
                  <button
                    type="button"
                    onClick={() => setFiatOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-white/[0.06]"
                    aria-label="Close"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
              </div>
              <div className="shrink-0 px-4 pb-2">
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3">
                  <Icon name="search" className="text-[18px] text-slate-500" />
                  <input
                    autoFocus
                    value={fiatQuery}
                    onChange={(e) => setFiatQuery(e.target.value)}
                    placeholder="Search country or currency"
                    className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                {filteredCountries.length === 0 && (
                  <p className="py-12 text-center text-[13px] font-semibold text-slate-500">No countries found</p>
                )}
                {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          fiat: c.currency,
                          paymentMethods: p.paymentMethods.filter((m) => methodAllowedForFiat(m, c.currency)),
                          pricePerUnit: p.crypto === "KES" ? p.pricePerUnit : "",
                          profitMarginPct: p.crypto === "KES" ? p.profitMarginPct : "",
                        }));
                        setFiatOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] ${
                        form.fiat === c.currency ? "bg-white/[0.08]" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={countryFlagUrl(c.code)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-white">{c.name}</span>
                        <span className="block truncate text-[12px] font-semibold text-slate-500">{c.currencyName}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-bold text-slate-500">{c.currency}</span>
                      {form.fiat === c.currency && <Icon name="check" className="shrink-0 text-[18px] text-white" />}
                    </button>
                  ))}
              </div>
              </div>
            </div>,
            document.body,
          )}

          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">Price type</label>
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.04] p-1">
              {([
                { id: "MARKET" as const, label: "Market", hint: "Track spot + margin %" },
                { id: "FIXED" as const, label: "Fixed", hint: "Set your own price" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => switchPriceMode(opt.id)}
                  className={`rounded-lg px-3 py-2.5 text-left transition ${
                    priceMode === opt.id
                      ? "bg-white/[0.1] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="block text-[13px] font-bold">{opt.label}</span>
                  <span className={`block text-[10px] font-medium ${priceMode === opt.id ? "text-slate-400" : "text-slate-600"}`}>
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] font-semibold leading-4 text-slate-500">
              {priceMode === "MARKET"
                ? "Your price tracks the live market by the margin you set below."
                : "Enter the exact unit price buyers/sellers will see on your ad."}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-semibold text-slate-500">Your Price</span>
              <span className="ml-auto text-[16px] font-black text-white">{priceNum > 0 ? formatFiat(priceNum, form.fiat) : "--"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-semibold text-slate-500">Highest Order Price</span>
              <span className="ml-auto text-[16px] font-black text-white">{highestOrderPrice ? formatFiat(highestOrderPrice, form.fiat) : "--"}</span>
              <Icon name="loyalty" className="text-[22px] text-[#55aaff]" />
            </div>
            {form.pricePerUnit && marginPct !== null ? (
              <p className="text-[10px] font-bold">
                <span className={marginPct > 0.01 ? "text-amber-400" : marginPct < -0.01 ? "text-[#05b957]" : "text-slate-400"}>
                  {marginPct > 0 ? "+" : ""}{marginPct.toFixed(2)}%
                </span>
                <span className="text-slate-500">
                  {isKesCoinForm
                    ? ` spread on 1:1 · ${formatFiat(spotRate!, form.fiat)}/${form.crypto} Coin`
                    : ` vs live market · ${formatFiat(spotRate!, form.fiat)}/${form.crypto}`}
                </span>
              </p>
            ) : null}
          </div>

          {priceMode === "MARKET" ? (
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">
              {isKesCoinForm ? "Spread margin (%)" : "Your margin (%)"}
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                inputMode="text"
                value={form.profitMarginPct}
                onChange={(e) => setPriceFromMargin(e.target.value)}
                disabled={!canUseMarginPricing}
                placeholder={canUseMarginPricing ? "e.g. 3.5 or -10" : "Market rate unavailable"}
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[14px] text-white placeholder:text-slate-600 outline-none transition-colors focus:border-[#087cff]/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!canUseMarginPricing}
                onClick={() => setPriceFromMargin("0")}
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-xs font-black text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                0%
              </button>
            </div>
            {!canUseMarginPricing ? (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                Live market rate is temporarily unavailable for {form.crypto}/{form.fiat}. Please try again shortly.
              </p>
            ) : isKesCoinForm ? (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                {form.crypto} Coin is pegged 1:1. Your % is the spread buyers pay on top.
                {form.crypto !== "KES" ? " Sell inventory is funded from your KES at live FX." : ""}
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                Live market {formatFiat(spotRate!, form.fiat)}/{form.crypto} × your margin = your price.
              </p>
            )}
          </div>
          ) : (
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">
              Fixed price ({form.fiat})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.pricePerUnit}
              onChange={(e) => setFixedPrice(e.target.value)}
              placeholder={spotRate ? formatPriceInput(spotRate, form.fiat) : "0.00"}
              className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[14px] font-bold text-white placeholder:text-slate-600 outline-none transition-colors focus:border-[#087cff]/40"
            />
            {spotRate ? (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                Spot {formatFiat(spotRate, form.fiat)}/{form.crypto}
                {marginPct != null ? ` · your price is ${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(2)}% vs market` : ""}
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                Enter the unit price for this ad.
              </p>
            )}
          </div>
          )}
          </div>
          )}

          {/* ════ STEP 2 — Set Amount & Method ════ */}
          {step === 1 && (
          <div className="grid gap-5">
          {needsKesBacking && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] font-bold text-amber-300 lg:col-span-2">
              Top up your fiat wallet first. This KES Coin sell ad needs KSh {requiredKesBacking.toLocaleString("en-KE")} including the 1% seller fee; you have KSh {freeKes.toLocaleString("en-KE")} free{reservedKes > 0 ? ` (KSh ${reservedKes.toLocaleString("en-KE")} is backing your other active sell ads)` : ""}.
            </div>
          )}

          {form.side === "SELL" && !isEditing && balancesReady && sellableBalance <= 0 && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] font-bold text-amber-300">
              No {form.crypto} in your wallet yet — deposit before listing a sell ad.
            </div>
          )}

          {exceedsSellableBalance && !needsKesBacking && (
            <p className="text-[11px] font-semibold leading-snug text-amber-300/90">
              Max order is above what you can sell — available {fmtEscrowAmt(sellableBalance)} {form.crypto}
              {fullOrderValue > 0 ? ` (≈ ${form.fiat} ${fullOrderValue.toLocaleString("en-KE", { maximumFractionDigits: 2 })})` : ""}.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Min order ({form.fiat})</label>
              <input
                type="number"
                value={form.minLimit}
                onChange={(e) => f("minLimit", e.target.value)}
                placeholder="500"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-sm text-white placeholder:text-slate-700 outline-none transition-colors focus:border-[#087cff]/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Max order ({form.fiat})</label>
              <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] pr-2 focus-within:border-[#087cff]/40">
                <input
                  type="number"
                  value={form.maxLimit}
                  onChange={(e) => f("maxLimit", e.target.value)}
                  placeholder="50000"
                  className="min-w-0 flex-1 bg-transparent px-4 py-1.5 text-sm text-white placeholder:text-slate-700 outline-none"
                />
                <button
                  type="button"
                  disabled={fullOrderValue <= 0}
                  onClick={() => f("maxLimit", String(fullOrderValue))}
                  className="ml-2 rounded-lg bg-[#087cff]/15 px-2.5 py-1 text-[11px] font-black text-[#55aaff] transition hover:bg-[#087cff]/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Max
                </button>
              </div>
            </div>
          </div>
          <p className="-mt-1 text-[10px] text-slate-600 lg:col-span-2">
            Ad size follows your max order
            {form.side === "SELL" && !isEditing && fullOrderValue > 0
              ? ` · Max fills your wallet (≈ ${form.fiat} ${fullOrderValue.toLocaleString("en-KE", { maximumFractionDigits: 2 })})`
              : ""}.
          </p>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
              Payment methods <span className="font-semibold normal-case text-slate-600">(optional)</span>
            </label>
            <p className="mb-2 text-[11px] leading-4 text-slate-500">
              Same rails as browse — pick which methods buyers can use. Leave empty to agree in chat.
            </p>
            <button
              type="button"
              onClick={() => setPaySheetOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-left transition hover:border-white/20"
            >
              <Icon name="account_balance_wallet" className="text-[20px] text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-white">
                  {form.paymentMethods.length === 0
                    ? "All payment methods"
                    : form.paymentMethods.length === 1
                    ? paymentMethodLabel(form.paymentMethods[0])
                    : `${form.paymentMethods.length} methods selected`}
                </span>
                <span className="block truncate text-[11px] font-medium text-slate-500">
                  {form.paymentMethods.length === 0
                    ? "Tap to choose M-Pesa, bank, cards…"
                    : form.paymentMethods.map((m) => paymentMethodLabel(m)).join(", ")}
                </span>
              </span>
              <Icon name="expand_more" className="shrink-0 text-[22px] text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => (onSetupPayments ?? onClose)()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2.5 text-[12px] font-bold text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              <Icon name="add" className="text-[16px]" />
              Save account details (for buyers to pay you)
            </button>
          </div>
          </div>
          )}

          {/* ════ STEP 3 — Set Conditions ════ */}
          {step === 2 && (
          <div className="grid gap-5">
          <div>
            <label className="text-[11px] font-black text-slate-400 mb-2 block uppercase tracking-wide">Payment window</label>
            <select value={form.paymentWindow} onChange={(e) => f("paymentWindow", e.target.value)}
              className="h-12 w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-bold text-white outline-none transition-colors hover:border-white/20 focus:border-[#087cff]/40">
              {[10,15,20,30].map((w) => <option key={w} value={w} style={{ background: "#18191f", color: "#fff" }}>{w} minutes</option>)}
            </select>
            <p className="mt-1.5 text-[10px] font-semibold text-slate-500">Buyers must complete payment within this window or the order expires.</p>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-400 mb-2 block uppercase tracking-wide">Trade terms <span className="normal-case text-slate-600">(optional)</span></label>
            <textarea value={form.terms} onChange={(e) => f("terms", e.target.value)} placeholder="Any specific requirements for buyers…" rows={3}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-700 outline-none transition-colors focus:border-[#087cff]/40" />
          </div>

          {/* Review summary */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <p className="mb-2.5 text-[11px] font-black uppercase tracking-wide text-slate-500">Review</p>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between"><span className="text-slate-500">You want to</span><span className={`font-black ${form.side === "BUY" ? "text-[#05b957]" : "text-red-400"}`}>{form.side === "BUY" ? "Buy" : "Sell"} {form.crypto}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Price</span><span className="font-black text-white">{priceNum > 0 ? formatFiat(priceNum, form.fiat) : "--"}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Amount</span><span className="font-black text-white">{effectiveTotalAmount > 0 ? `${effectiveTotalAmount.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${form.crypto}` : "--"}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Order limits</span><span className="font-black text-white">{form.minLimit && form.maxLimit ? `${form.fiat} ${Number(form.minLimit).toLocaleString()} – ${Number(form.maxLimit).toLocaleString()}` : "--"}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Payment</span><span className="font-black text-white">{form.paymentMethods.length ? form.paymentMethods.map((m) => paymentMethodLabel(m)).join(", ") : "--"}</span></div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5"><span className="text-slate-500">Platform fee</span><span className="font-black text-[#05b957]">Applied per completed trade</span></div>
            </div>
          </div>
          </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-white/[0.07] bg-[#151518]/95 px-4 py-3 pb-[calc(1.1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-2.5">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)}
                className="flex h-12 flex-1 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-[13px] font-black text-slate-200 transition hover:bg-white/[0.08]">
                Back
              </button>
            )}
            <button onClick={step === 2 ? submit : goNext}
              disabled={step === 2 && (submitting || exceedsSellableBalance)}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl text-[13px] font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                step === 2
                  ? "bg-[#05b957] shadow-[#05b957]/25 hover:bg-[#06d169]"
                  : "bg-[#087cff] shadow-[#087cff]/20 hover:bg-[#1a78ff]"
              } ${step > 0 ? "flex-1" : "w-full"}`}>
              {step === 2
                ? (submitting ? <LoadingDots label={isEditing ? "Saving" : "Creating"} /> : isEditing ? "Save Changes" : "Place an offer")
                : "Next"}
            </button>
          </div>
        </div>
      </div>

      {/* Portaled outside step panels — button lives on step 2 (amount & methods). */}
      {pickerMounted && createPortal(
        <PaymentMethodsSheet
          open={paySheetOpen}
          fiat={form.fiat}
          multi
          allowAll={false}
          value={form.paymentMethods}
          onClose={() => setPaySheetOpen(false)}
          onConfirm={(codes) => {
            if (!Array.isArray(codes)) return;
            f(
              "paymentMethods",
              codes.filter((c) => ALL_PAYMENT_CODES.has(c)),
            );
          }}
        />,
        document.body,
      )}
    </div>
  );
}

// ─── Merchant Dashboard ───────────────────────────────────────────────────────

function MerchantDashboard({ status }: { status: MerchantStatus }) {
  const { user } = useSupabaseAuth();
  const [ads, setAds]           = useState<Ad[]>([]);
  const [loading, setLoading]   = useState(true);
  const [createOpen, setCreate] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [section, setSection] = useState<"overview" | "reputation" | "wallet" | "payments" | "ads">("overview");
  const [rep, setRep] = useState<MerchantStatus>(status);
  const [showFeedback, setShowFeedback] = useState(false);

  // Deep-link from bottom nav Ads tab: /p2p/merchant?tab=ads
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "ads" || tab === "payments" || tab === "wallet" || tab === "overview" || tab === "reputation") {
      setSection(tab);
    }
  }, []);

  useEffect(() => {
    fetch("/api/p2p/merchant/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MerchantStatus | null) => {
        if (data) setRep((current) => ({ ...current, ...data, applied: true }));
      })
      .catch(() => {});
  }, []);
  // Bumped to jump from an ad's "Add payment method" straight into the Payment
  // Methods tab with the add form open.
  const [payFormSignal, setPayFormSignal] = useState(0);
  const goToAddPayment = useCallback(() => {
    setCreate(false);
    setEditingAd(null);
    setSection("payments");
    setPayFormSignal((n) => n + 1);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "payments");
      window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
    }
  }, []);
  const [adFilter, setAdFilter] = useState<"ALL" | "ACTIVE" | "PAUSED" | "EXHAUSTED">("ACTIVE");
  const [adPage, setAdPage] = useState(1);
  const [openAdMenu, setOpenAdMenu] = useState<string | null>(null);

  // Editable display name
  const [displayName, setDisplayName] = useState(status.displayName ?? "");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState(status.displayName ?? "");
  const [savingName, setSavingName]   = useState(false);

  async function saveName() {
    const n = nameInput.trim();
    if (n.length < 2 || n.length > 30) return toast.error("Name must be 2–30 characters");
    setSavingName(true);
    try {
      const r = await fetch("/api/p2p/merchant/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: n }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setDisplayName(n); setEditingName(false);
      toast.success("Display name updated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSavingName(false); }
  }
  const [avatarUploading, setAvatarUploading] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2 MB");

    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "avatar");
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) throw new Error(upJson.error || "Upload failed");
      const publicUrl: string = upJson.url;

      const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (updErr) throw updErr;

      const avatarSync = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });
      if (!avatarSync.ok) throw new Error("Failed to save profile picture");

      // Persist to the merchant profile too, so it shows on the public offer cards.
      await fetch("/api/p2p/merchant/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      }).catch(() => {});

      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }

  const [fx, setFx] = useState<{ toKES: Record<string, number>; live: boolean }>({ toKES: { KES: 1 }, live: false });

  const loadAds = useCallback(async () => {
    try { const r = await fetch("/api/p2p/ads/mine"); if (r.ok) setAds(await r.json()); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load ads"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAds(); }, [loadAds]);

  useEffect(() => {
    fetch("/api/p2p/fx")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { toKES?: Record<string, number>; live?: boolean } | null) => {
        if (d?.toKES) setFx({ toKES: d.toKES, live: !!d.live });
      })
      .catch(() => { /* keep KES-only fallback */ });
  }, []);

  async function toggleActive(ad: Ad) {
    const previousAds = ads;
    setAds((current) => current.map((item) => item.id === ad.id ? { ...item, isActive: !item.isActive } : item));
    try {
      const r = await fetch("/api/p2p/ads/mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ad.id, isActive: !ad.isActive }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      window.dispatchEvent(new CustomEvent("wallet-refresh"));
      toast.success(!ad.isActive ? "Ad reactivated" : "Ad paused");
    } catch (err: unknown) {
      setAds(previousAds);
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function deleteAd(ad: Ad) {
    if (!window.confirm(`Delete this ${ad.crypto} ad permanently?`)) return;
    try {
      const r = await fetch(`/api/p2p/ads/mine?id=${encodeURIComponent(ad.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to delete ad");
      setAds((current) => current.filter((item) => item.id !== ad.id));
      window.dispatchEvent(new CustomEvent("wallet-refresh"));
      toast.success("Ad deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete ad");
    }
  }

  const activeAds = ads.filter((ad) => ad.isActive);
  const exhaustedAds = ads.filter((ad) => Number(ad.availableAmount) <= 0 || !!ad.validationError);
  const totalListed = ads.reduce((sum, ad) => sum + Number(ad.totalAmount), 0);
  const totalAvailable = ads.reduce((sum, ad) => sum + Number(ad.availableAmount), 0);
  const listedKES = ads.reduce((sum, ad) => {
    const valueInFiat = Number(ad.availableAmount) * Number(ad.pricePerUnit);
    return sum + valueInFiat * (fx.toKES[ad.fiat] ?? 1);
  }, 0);
  const cryptos = ads.map((ad) => ad.crypto).filter((crypto, index, values) => values.indexOf(crypto) === index);
  const filteredAds = ads.filter((ad) => {
    if (adFilter === "ACTIVE") return ad.isActive;
    if (adFilter === "PAUSED") return !ad.isActive && Number(ad.availableAmount) > 0 && !ad.validationError;
    if (adFilter === "EXHAUSTED") return Number(ad.availableAmount) <= 0 || !!ad.validationError;
    return true;
  });
  const adsPerPage = 8;
  const adPageCount = Math.max(1, Math.ceil(filteredAds.length / adsPerPage));
  const visibleAds = filteredAds.slice((adPage - 1) * adsPerPage, adPage * adsPerPage);

  // Ads + profile + escrow match the browse market width; payments stay phone-width.
  // Ads/profile/payments/wallet hide the dashboard chrome (they have their own headers).
  const phoneShell = section === "payments";
  const hideDashboardChrome =
    section === "ads" || section === "payments" || section === "wallet" || section === "reputation";

  const completed = Number(rep.completedTrades ?? status.completedTrades ?? 0);
  const totalTrades = Number(rep.totalTrades ?? status.totalTrades ?? completed);
  const completion = Number(rep.completionRate ?? status.completionRate ?? 0);
  const release = Number(rep.avgReleaseTime ?? status.avgReleaseTime ?? 0);
  const positive = Number(rep.positiveFeedbackRate ?? 0);
  const feedbackCount = Number(rep.feedbackCount ?? 0);
  const feedbackAverage = Number(rep.feedbackAverage ?? 0);
  const feedback = rep.feedback ?? [];
  const registeredDays = (rep.createdAt ?? status.createdAt)
    ? Math.max(0, Math.floor((Date.now() - new Date((rep.createdAt ?? status.createdAt)!).getTime()) / 86_400_000))
    : null;

  return (
    <div className={`mx-auto w-full px-3 py-4 sm:px-4 ${phoneShell ? "max-w-lg sm:max-w-xl" : "max-w-6xl"}`}>
      {createOpen && <CreateAdModal onClose={() => setCreate(false)} onCreated={loadAds} onSetupPayments={goToAddPayment} />}
      {editingAd && <CreateAdModal ad={editingAd} onClose={() => setEditingAd(null)} onCreated={loadAds} onSetupPayments={goToAddPayment} />}

      {!hideDashboardChrome && (
      <>
      {/* Merchant header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <label
            className="group relative h-12 w-12 shrink-0 cursor-pointer"
            title="Change profile picture"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
              className="sr-only"
            />
            <MerchantAvatar
              id={status.displayName ?? "merchant"}
              name={status.displayName ?? "Merchant"}
              avatarUrl={user?.user_metadata?.avatar_url || status.avatarUrl}
              size={48}
              rounded="xl"
              className="pointer-events-none h-12 w-12 [&_img]:shadow-lg [&_img]:shadow-black/30"
            />
            {/* Hover / uploading overlay */}
            <div className={`absolute inset-0 flex items-center justify-center rounded-xl bg-black/55 transition-opacity lg:rounded-lg ${avatarUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <Icon name={avatarUploading ? "progress_activity" : "photo_camera"} className={`text-[18px] text-white ${avatarUploading ? "animate-spin" : ""}`} />
            </div>
          </label>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <span className="flex items-center gap-1">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    autoFocus
                    maxLength={30}
                    className="h-7 w-40 rounded-md border border-white/[0.12] bg-[#151518] px-2 text-base font-black text-white outline-none focus:border-[#087cff]/50"
                  />
                  <button type="button" onClick={saveName} disabled={savingName} className="grid h-7 w-7 place-items-center rounded-md bg-[#05b957]/15 text-[#05b957] hover:bg-[#05b957]/25 disabled:opacity-50" aria-label="Save">
                    <Icon name="check" className="text-[16px]" />
                  </button>
                  <button type="button" onClick={() => { setEditingName(false); setNameInput(displayName); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06]" aria-label="Cancel">
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </span>
              ) : (
                <>
                  <h1 className="text-base font-black text-white">{displayName}</h1>
                  <button type="button" onClick={() => { setNameInput(displayName); setEditingName(true); }} className="grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-white/[0.06] hover:text-white" aria-label="Edit name">
                    <Icon name="edit" className="text-[14px]" />
                  </button>
                </>
              )}
              <div className="flex items-center gap-1 bg-[#05b957]/10 border border-[#05b957]/20 rounded-full px-2 py-0.5">
                <Icon name="verified" className="text-[#05b957] text-xs" />
                <span className="text-[#05b957] text-[10px] font-black">Verified</span>
              </div>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Merchant Center
              {status.createdAt && (
                <span className="ml-2 text-slate-600">· since {new Date(status.createdAt).toLocaleDateString("en-KE", { month: "short", year: "numeric" })}</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreate(true)}
          className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-[#087cff] px-4 text-[13px] font-black text-white shadow-lg shadow-[#087cff]/25 transition hover:bg-[#0570e8] active:scale-95"
        >
          <Icon name="add" className="text-base" />
          <span>Post ad</span>
        </button>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101118] p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {([
          ["overview", "Overview", "dashboard"],
          ["reputation", "Reputation", "star"],
          ["wallet", "Escrow", "account_balance_wallet"],
          ["payments", "Payments", "payments"],
          ["ads", `Ads · ${ads.length}`, "campaign"],
        ] as const).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-[12px] font-black transition active:scale-95 ${
              section === id ? "bg-[#087cff] text-white shadow-md shadow-[#087cff]/20" : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <Icon name={icon} className="shrink-0 text-base" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      </>
      )}

      {section === "overview" && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {/* Active Ads */}
            <div className="rounded-lg border border-white/[0.06] bg-[#18191f] p-3 transition-colors hover:border-[#087cff]/20">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-500 text-xs">Active Ads</p>
                <Icon name="campaign" className="text-[#087cff] text-sm opacity-60" />
              </div>
              <p className="text-lg font-black text-[#087cff]">{activeAds.length}</p>
              <p className="text-slate-600 text-[11px] mt-1">{ads.length} total · {ads.length - activeAds.length} paused</p>
            </div>

            {/* Listed crypto */}
            <div className="rounded-lg border border-white/[0.06] bg-[#18191f] p-3 transition-colors hover:border-[#05b957]/20">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-500 text-xs">Listed Crypto</p>
                <Icon name="currency_bitcoin" className="text-[#05b957] text-sm opacity-60" />
              </div>
              <p className="text-lg font-black text-[#05b957]">{totalAvailable.toFixed(4)}</p>
              <p className="text-slate-600 text-[11px] mt-1">{totalListed.toFixed(4)} total · {cryptos.join(", ") || "—"}</p>
            </div>

            {/* KES value */}
            <div className="rounded-lg border border-white/[0.06] bg-[#18191f] p-3 transition-colors hover:border-amber-500/20">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-500 text-xs">Est. KES Value</p>
                <Icon name="payments" className="text-amber-400 text-sm opacity-60" />
              </div>
              <p className="text-lg font-black text-amber-400">
                {listedKES >= 1000 ? `${(listedKES/1000).toFixed(1)}K` : listedKES.toFixed(0)}
              </p>
              <p className="text-slate-600 text-[11px] mt-1">
                {fx.live ? "live FX · all currencies" : "approx FX · all currencies"}
              </p>
            </div>

            {/* Account */}
            <div className="rounded-lg border border-white/[0.06] bg-[#18191f] p-3 transition-colors hover:border-[#05b957]/20">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-500 text-xs">Account</p>
                <Icon name="shield" className="text-[#05b957] text-sm opacity-60" />
              </div>
              <div className="mb-1 flex items-center gap-1.5">
                <Icon name="verified" className="text-[#05b957] text-sm" />
                <p className="font-black text-sm text-[#05b957]">Verified</p>
              </div>
              <p className="text-slate-600 text-[11px]">
                {status.createdAt ? `Since ${new Date(status.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}` : "Active"}
              </p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <button onClick={() => setSection("wallet")} className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4 text-left transition hover:border-[#05b957]/25 hover:bg-[#18191f]">
              <Icon name="account_balance_wallet" className="text-xl text-[#05b957]" />
              <p className="mt-3 text-sm font-black text-white">Manage liquidity</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Receive crypto and manage balances. Sell ads lock from this wallet.</p>
            </button>
            <button onClick={() => setSection("ads")} className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4 text-left transition hover:border-[#087cff]/25 hover:bg-[#18191f]">
              <Icon name="campaign" className="text-xl text-[#087cff]" />
              <p className="mt-3 text-sm font-black text-white">Manage ads</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{activeAds.length} active, {exhaustedAds.length} exhausted or needing attention.</p>
            </button>
            <button onClick={() => setSection("reputation")} className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4 text-left transition hover:border-[#087cff]/25 hover:bg-[#18191f]">
              <Icon name="star" className="text-xl text-[#087cff]" />
              <p className="mt-3 text-sm font-black text-white">Reputation</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {feedbackCount > 0
                  ? `${feedbackAverage.toFixed(1)}/5 · ${completion.toFixed(0)}% completion`
                  : "Completion rate, release time, and trader feedback."}
              </p>
            </button>
          </div>
        </>
      )}

      {section === "reputation" && (
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-3 flex items-center justify-between py-1">
            <button
              type="button"
              onClick={() => {
                setSection("ads");
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "ads");
                  window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
              aria-label="Back"
            >
              <Icon name="arrow_back" className="text-[22px]" />
            </button>
            <h2 className="text-[17px] font-bold text-white">Reputation</h2>
            <span className="w-9" />
          </div>
          <p className="mb-4 text-center text-[12px] font-medium text-slate-500">
            What buyers see on your ads — completion, release speed, and feedback.
          </p>

          <div className="mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 sm:px-5">
            {[
              ["Completed orders (30d)", `${completed} Order(s)`],
              ["Completion rate", `${completion.toFixed(0)}%`],
              ["Avg. release time", release > 0 ? `${release.toFixed(0)} Minute(s)` : "—"],
              ["Positive feedback", feedbackCount > 0 ? `${positive.toFixed(0)}%` : "—"],
              ["All trades", `${totalTrades.toLocaleString()} Time(s)`],
              ["Registered", registeredDays != null ? `${registeredDays.toLocaleString()} Day(s)` : "—"],
              ["Rating", feedbackCount > 0 ? `${feedbackAverage.toFixed(1)} / 5 · ${feedbackCount} review${feedbackCount === 1 ? "" : "s"}` : "No reviews yet"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2 text-[13px] sm:py-2.5 sm:text-[14px]">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFeedback((v) => !v)}
            className="mb-3 flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
          >
            <Icon name="thumb_up" className="text-[20px] text-slate-300" />
            <span className="flex-1 text-[14px] font-semibold text-white">Recent feedback</span>
            <span className="text-[13px] font-semibold text-slate-400">
              {feedbackCount > 0 ? (feedbackAverage > 0 ? `${feedbackAverage.toFixed(1)} / 5` : `${positive.toFixed(0)}%`) : "—"}
            </span>
            <Icon name={showFeedback ? "expand_less" : "expand_more"} className="text-[18px] text-slate-600" />
          </button>

          {showFeedback && (
            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
              {feedback.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-slate-500">
                  No written feedback yet. Buyers can leave reviews after a completed trade.
                </p>
              ) : (
                feedback.map((item, i) => (
                  <div
                    key={item.id}
                    className={`px-4 py-3.5 sm:px-5 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <MerchantAvatar
                        id={item.fromUser.displayName}
                        name={item.fromUser.displayName}
                        avatarUrl={item.fromUser.imageUrl}
                        size={32}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-white">{item.fromUser.displayName}</p>
                        <p className="text-[11px] font-bold text-[#05b957]">
                          {"★".repeat(item.rating)}
                          {"☆".repeat(5 - item.rating)}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-600">
                        {new Date(item.createdAt).toLocaleDateString("en-KE", { month: "short", day: "2-digit" })}
                      </span>
                    </div>
                    {item.comment && <p className="mt-2 text-[12px] leading-5 text-slate-400">{item.comment}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {section === "wallet" && (
        <div>
          <div className="mb-3 flex items-center justify-between py-1">
            <Link
              href="/p2p/merchant?tab=ads"
              prefetch={false}
              className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
              aria-label="Back"
            >
              <Icon name="arrow_back" className="text-[22px]" />
            </Link>
            <h2 className="text-[17px] font-bold text-white">Escrow</h2>
            <span className="w-9" />
          </div>
          <DepositSection />
        </div>
      )}
      {section === "payments" && <PaymentMethodsSection openSignal={payFormSignal} />}

      {/* Ads list */}
      {section === "ads" && <div>
        <div className="mb-1 flex items-center justify-between py-1">
          <Link
            href="/p2p"
            prefetch={false}
            className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
            aria-label="Back"
          >
            <Icon name="arrow_back" className="text-[22px]" />
          </Link>
          <h2 className="text-[17px] font-bold text-white">My Ads</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSection("reputation");
                setShowFeedback(true);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "reputation");
                  window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
                }
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Reputation & feedback"
              title="Reputation & feedback"
            >
              <Icon name="star" className="text-[20px]" />
            </button>
            <button
              type="button"
              onClick={() => setCreate(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.12] text-white transition hover:bg-white/[0.06]"
              aria-label="Post ad"
            >
              <Icon name="add" className="text-[20px]" />
            </button>
          </div>
        </div>

        {/* Quick reputation snapshot — full details via the star button */}
        <button
          type="button"
          onClick={() => {
            setSection("reputation");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", "reputation");
              window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
            }
          }}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-left transition hover:bg-white/[0.04]"
        >
          <Icon name="star" className="text-[20px] text-[#087cff]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-white">Reputation</span>
            <span className="block text-[11px] font-medium text-slate-500">
              {feedbackCount > 0
                ? `${feedbackAverage.toFixed(1)}/5 · ${completion.toFixed(0)}% completion · ${feedbackCount} review${feedbackCount === 1 ? "" : "s"}`
                : `${completion.toFixed(0)}% completion · tap for ratings & feedback`}
            </span>
          </span>
          <Icon name="chevron_right" className="text-[18px] text-slate-600" />
        </button>

        <div className="mb-3 flex items-end gap-5 border-b border-white/[0.08]">
          {(
            [
              { id: "ACTIVE" as const, label: `Active(${activeAds.length})` },
              { id: "ALL" as const, label: "All" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setAdFilter(tab.id);
                setAdPage(1);
                setOpenAdMenu(null);
              }}
              className={`relative pb-2.5 text-[15px] font-bold transition ${
                adFilter === tab.id ? "text-white" : "text-slate-500"
              }`}
            >
              {tab.label}
              {adFilter === tab.id && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
          <span className="shrink-0 text-[13px] font-semibold text-white">Active Mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={activeAds.length > 0}
            onClick={() => {
              if (activeAds.length === 0) {
                toast.info("Post an ad first to use Active Mode");
                return;
              }
              const target = ads.find((a) => a.isActive) ?? ads[0];
              if (target) void toggleActive(target);
            }}
            className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition ${
              activeAds.length > 0 ? "bg-[#05b957]" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition ${
                activeAds.length > 0 ? "left-[20px]" : "left-[2px]"
              }`}
            />
          </button>
          <span className="min-w-0 flex-1 text-right text-[12px] font-semibold text-[#087cff]">
            Automatic Inactive Mode
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-4 py-14 text-center">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="mb-4 text-slate-600">
              <path d="M18 14h28l10 10v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M46 14v10h10" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M24 34h24M24 42h18M24 50h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <p className="text-[14px] font-medium text-slate-400">
              {ads.length ? `No ${adFilter === "ACTIVE" ? "active" : "matching"} ads.` : "Oops, you do not have any active ads."}
            </p>
            <button
              type="button"
              onClick={() => setCreate(true)}
              className="mt-6 rounded-full border border-dashed border-white/35 px-8 py-2.5 text-[14px] font-bold text-white transition hover:border-white/55 hover:bg-white/[0.04] active:scale-[0.98]"
            >
              Post Now
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAds.map((ad) => {
              const pmLabel = (m: string) => paymentMethodLabel(m);
              const dotColor = P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)?.color ?? "#087cff";
              return (
                <div key={ad.id} className="relative grid w-full grid-cols-[minmax(0,1fr)_44px] gap-3 rounded-xl bg-white/[0.03] px-3 py-3 ring-1 ring-white/[0.07] transition hover:bg-white/[0.04] hover:ring-white/[0.14] sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_44px] lg:items-center lg:gap-4 lg:py-4">
                  <div className="min-w-0 lg:contents">
                    {/* Advertiser / asset */}
                    <div className="mb-1.5 flex min-w-0 items-center gap-2 lg:mb-0">
                      {P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)?.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)!.icon} alt={ad.crypto} className="h-5 w-5 shrink-0 rounded-full lg:h-8 lg:w-8" />
                      ) : (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-black lg:h-8 lg:w-8" style={{ backgroundColor: dotColor }}>
                          {ad.crypto.charAt(0)}
                        </div>
                      )}
                      <span className="text-[12px] font-black text-white lg:text-[15px]">{ad.crypto}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black lg:text-[10px] ${
                        ad.side === "SELL" ? "bg-red-500/12 text-red-400" : "bg-[#05b957]/12 text-[#05b957]"
                      }`}>{ad.side}</span>
                      <span className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black lg:ml-0 ${
                        ad.isActive ? "bg-[#05b957]/10 text-[#05b957]" : "bg-white/[0.05] text-slate-500"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ad.isActive ? "bg-[#05b957] animate-pulse" : "bg-slate-600"}`} />
                        {ad.isActive ? "Active" : "Paused"}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="mb-2.5 lg:mb-0">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold leading-3 text-white/45 lg:text-[11px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={flagUrl(ad.fiat)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                        {ad.fiat}
                      </p>
                      <p className="text-[16px] font-black leading-tight text-white tabular-nums lg:text-[20px]">
                        {formatFiat(Number(ad.pricePerUnit), ad.fiat, { symbol: false, decimals: 2 })}
                      </p>
                    </div>

                    {/* Limits + quantity + payments */}
                    <div className="space-y-0.5 text-[10px] font-semibold leading-4 text-white/40 lg:space-y-1 lg:text-[12px] lg:leading-5">
                      <p>Limits <span className="text-white/65">{formatFiat(Number(ad.minLimit), ad.fiat, { symbol: false })} – {formatFiat(Number(ad.maxLimit), ad.fiat, { symbol: false })} {ad.fiat}</span></p>
                      <p>{ad.side === "SELL" ? "Quantity" : "Buying"} <span className="text-white/65">{Number(ad.availableAmount).toLocaleString("en-US", { maximumFractionDigits: 4 })} {ad.crypto}</span></p>
                      <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 gap-y-1 lg:mt-1">
                        {ad.paymentMethods.map((m) => (
                          <span key={m} className="flex items-center gap-1 text-[10px] font-semibold text-white/45 lg:text-[11px]">
                            <span className={`h-3 w-0.5 rounded-full ${m === "MPESA" ? "bg-[#05b957]" : "bg-[#f59e0b]"}`} />
                            {pmLabel(m)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Validation error */}
                    {ad.validationError && (
                      <div className="mt-2 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/[0.08] px-2 py-1.5 text-[10px] font-semibold text-[#f59e0b] lg:col-span-3">
                        {ad.validationError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-end lg:items-center">
                    <button
                      type="button"
                      onClick={() => setOpenAdMenu((current) => current === ad.id ? null : ad.id)}
                      className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.07] hover:text-white"
                      aria-label="Ad actions"
                    >
                      <Icon name="more_vert" className="text-lg" />
                    </button>
                    {openAdMenu === ad.id && (
                      <div className="absolute right-3 top-12 z-20 w-36 overflow-hidden rounded-xl border border-white/[0.10] bg-[#0d0f15] p-1 shadow-2xl">
                        <button onClick={() => { setEditingAd(ad); setOpenAdMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-300 hover:bg-white/[0.06]">
                          <Icon name="edit" className="text-sm" /> Edit
                        </button>
                        <button onClick={() => { void toggleActive(ad); setOpenAdMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-300 hover:bg-white/[0.06]">
                          <Icon name={ad.isActive ? "pause" : "play_arrow"} className="text-sm" /> {ad.isActive ? "Pause" : "Resume"}
                        </button>
                        <button onClick={() => { void deleteAd(ad); setOpenAdMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-red-400 hover:bg-red-500/10">
                          <Icon name="delete" className="text-sm" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {adPageCount > 1 && (
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                <p className="text-xs text-slate-600">
                  Page {adPage} of {adPageCount} · {filteredAds.length} ads
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={adPage === 1}
                    onClick={() => setAdPage((page) => Math.max(1, page - 1))}
                    className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-bold text-slate-400 transition hover:border-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={adPage === adPageCount}
                    onClick={() => setAdPage((page) => Math.min(adPageCount, page + 1))}
                    className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-bold text-slate-400 transition hover:border-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function P2PMerchantClient() {
  const { isSignedIn } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [status, setStatus] = useState<MerchantStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try { const r = await fetch("/api/p2p/merchant/apply"); setStatus(await r.json()); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed to load merchant status"); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isSignedIn) check();
    else setLoading(false);
  }, [isSignedIn, check]);

  // While an application is pending, poll so the "Under Review" screen
  // clears on its own once auto-verification kicks in (no manual refresh).
  useEffect(() => {
    if (!status?.applied || status.kycStatus !== "PENDING") return;
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [status?.applied, status?.kycStatus, check]);

  // Legacy /p2p/merchant?tab=profile → Ads (account Profile lives in shared app chrome).
  useEffect(() => {
    if (tab !== "profile") return;
    router.replace("/p2p/merchant?tab=ads");
  }, [tab, router]);

  if (tab === "profile") {
    return (
      <>
        <P2PSubNav />
        <div className="flex min-h-[260px] items-center justify-center px-4 py-5">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />
        </div>
      </>
    );
  }

  return (
    <>
      <P2PSubNav />
      {!isSignedIn ? (
        <ApplyLanding onApplied={check} />
      ) : loading || !status ? (
        <div className="flex min-h-[260px] items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
          <div className="w-8 h-8 border-2 border-white/10 border-t-[#087cff] rounded-full animate-spin" />
        </div>
      ) : !status.applied ? (
        <ApplyLanding onApplied={check} />
      ) : status.kycStatus !== "APPROVED" ? (
        <ApplicationStatus status={status} onRefresh={() => { setStatus(null); check(); }} />
      ) : (
        <MerchantDashboard status={status} />
      )}
    </>
  );
}
