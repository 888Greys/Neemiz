"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { createClient } from "@/lib/supabase/client";
import { P2PSubNav } from "@/components/p2p-subnav";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { formatFiat, FIAT_CURRENCIES } from "@/lib/p2p/currencies";
import { GLOBAL_PAYMENT_METHODS, paymentMethodsByCategory, paymentMethodLabel, methodAllowedForFiat, accountIdentifierLabel } from "@/lib/p2p/payment-methods";
import { PaymentLogo } from "@/components/p2p/payment-logo";
import { LoadingDots } from "@/components/loading-dots";
import { MerchantAvatar } from "@/components/p2p-merchant-avatar";

// ─── Supported P2P cryptos ────────────────────────────────────────────────────

const P2P_CRYPTOS: Array<{ symbol: string; name: string; icon: string; color: string }> = [
  { symbol: "USDT", name: "Tether",       icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg", color: "#26a17b" },
  { symbol: "USDC", name: "USD Coin",     icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg", color: "#2775ca" },
  { symbol: "BTC",  name: "Bitcoin",      icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",  color: "#f7931a" },
  { symbol: "ETH",  name: "Ethereum",     icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",  color: "#627eea" },
  { symbol: "BNB",  name: "BNB",          icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",  color: "#f0b90b" },
  { symbol: "KES",  name: "KES Coin · in-app", icon: "https://flagcdn.com/w80/ke.png",                                       color: "#0a7e3f" },
];

const P2P_SYMBOLS = P2P_CRYPTOS.map((c) => c.symbol);

const flagUrl = (currencyCode: string) =>
  `https://flagcdn.com/w40/${currencyCode.slice(0, 2).toLowerCase()}.png`;

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

const MERCHANT_STEPS = [
  { icon: "edit_note",               label: "Apply",          desc: "Submit your display name" },
  { icon: "manage_search",           label: "KYC Review",     desc: "Reviewed in under 24h" },
  { icon: "account_balance_wallet",  label: "Fund escrow",    desc: "Receive crypto, then fund" },
  { icon: "storefront",              label: "Post ads",       desc: "Go live and start trading" },
];

function MerchantProgress({ current, failed = false }: { current: number; failed?: boolean }) {
  const pct = MERCHANT_STEPS.length > 1 ? (current / (MERCHANT_STEPS.length - 1)) * 100 : 0;
  return (
    <div className="mb-3 rounded-lg border border-white/[0.06] bg-[#18191f] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-black text-white">Your merchant journey</h2>
        <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Step {Math.min(current + 1, MERCHANT_STEPS.length)} of {MERCHANT_STEPS.length}
        </span>
      </div>

      <div className="relative">
        {/* Track */}
        <div className="absolute left-4 right-4 top-4 hidden h-0.5 -translate-y-1/2 bg-white/[0.07] sm:block" />
        <div
          className={`absolute left-4 top-4 hidden h-0.5 -translate-y-1/2 transition-all duration-500 sm:block ${failed ? "bg-red-500/60" : "bg-[#087cff]"}`}
          style={{ width: `calc((100% - 2rem) * ${pct / 100})` }}
        />

        <div className="grid gap-4 sm:grid-cols-4 sm:gap-2">
          {MERCHANT_STEPS.map((s, i) => {
            const done    = i < current;
            const active  = i === current;
            const isFail  = active && failed;
            return (
              <div key={s.label} className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center">
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-black transition-colors ${
                    isFail
                      ? "border-red-500/40 bg-red-500/15 text-red-400"
                      : done
                      ? "border-[#05b957]/40 bg-[#05b957]/15 text-[#05b957]"
                      : active
                      ? "border-[#087cff]/40 bg-[#087cff]/15 text-[#087cff]"
                      : "border-white/10 bg-white/[0.03] text-slate-600"
                  }`}
                >
                  {done ? (
                    <Icon name="check" className="text-[16px]" />
                  ) : isFail ? (
                    <Icon name="close" className="text-[16px]" />
                  ) : (
                    <Icon name={s.icon} className="text-[15px]" />
                  )}
                  {active && !failed && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#087cff]/30" />
                  )}
                </div>
                <div className="min-w-0 sm:mt-2">
                  <p className={`text-sm font-black ${active || done ? "text-white" : "text-slate-500"}`}>{s.label}</p>
                  <p className="text-xs leading-5 text-slate-600">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApplyLanding({ onApplied }: { onApplied: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!displayName.trim()) return toast.error("Display name required");
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/merchant/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Application submitted! Your account is usually verified within the hour.");
      onApplied();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
      {/* Hero */}
      <div className="relative mb-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#18191f] p-4 sm:p-5 lg:p-4">
        <div className="relative flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#087cff]/25 bg-[#087cff]/15 shadow-xl shadow-[#087cff]/10">
            <Icon name="storefront" className="text-2xl text-[#087cff]" />
          </div>
          <div className="min-w-0">
            <h1 className="mb-1 text-2xl font-black text-white lg:text-xl">Become a Merchant</h1>
            <p className="max-w-3xl text-sm leading-5 text-slate-400">
              Post buy &amp; sell ads, set your own prices, and earn from every trade.
              Nezeem holds crypto in escrow — your funds are always safe.
            </p>
          </div>
        </div>
      </div>

      {/* Benefits grid */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: "price_change",   label: "Your Prices",     desc: "Set your own spread and profit per trade" },
          { icon: "lock",           label: "Escrow Safe",     desc: "Crypto secured by Nezeem before any release" },
          { icon: "verified",       label: "Trust Badge",     desc: "Verified badge builds buyer confidence" },
          { icon: "payments",       label: "Local Payments",  desc: "M-Pesa and bank transfers supported" },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-[#18191f] p-3 transition-colors hover:border-[#087cff]/20">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#087cff]/10">
              <Icon name={icon} className="text-[#087cff] text-sm" />
            </div>
            <p className="text-white font-black text-sm mb-1">{label}</p>
            <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Live progress tracker */}
      <MerchantProgress current={0} />

      {/* Application form */}
      <div className="max-w-lg">
        <div className="rounded-lg border border-white/[0.07] bg-[#18191f] p-4">
          <h2 className="mb-1 text-lg font-black text-white">Start your application</h2>
          <p className="mb-4 text-sm text-slate-500">Takes less than a minute. Verification usually completes within the hour.</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wide">Merchant display name</label>
              <input
                autoFocus
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="e.g. CryptoKing_KE"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/50 transition-colors text-sm"
              />
              <p className="text-slate-600 text-xs mt-1.5">This name will be shown to buyers and sellers on your ads.</p>
            </div>

            <button
              onClick={submit}
              disabled={!displayName.trim() || submitting}
              className="w-full py-3.5 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#087cff]/20"
            >
              {submitting ? (
                <LoadingDots label="Submitting" />
              ) : (
                <><Icon name="send" className="text-base" /> Submit Application</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pending / Rejected State ─────────────────────────────────────────────────

function ApplicationStatus({ status, onRefresh }: { status: MerchantStatus; onRefresh: () => void }) {
  const isRejected = status.kycStatus === "REJECTED";
  const isPending  = status.kycStatus === "PENDING";

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
      <MerchantProgress current={1} failed={isRejected} />
      <div className="max-w-lg">
        {/* Status card */}
        <div className={`rounded-2xl border p-6 mb-6 ${
          isRejected ? "bg-red-500/[0.06] border-red-500/20" : "bg-amber-500/[0.06] border-amber-500/20"
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isRejected ? "bg-red-500/15" : "bg-amber-500/15"
            }`}>
              <Icon name={isRejected ? "cancel" : "hourglass_top"} className={`text-2xl ${isRejected ? "text-red-400" : "text-amber-400"}`} />
            </div>
            <div>
              <h2 className="text-white font-black text-lg">
                {isRejected ? "Application Not Approved" : "Under Review"}
              </h2>
              <p className="text-slate-500 text-sm">
                {isRejected ? `Submitted ${status.createdAt ? new Date(status.createdAt).toLocaleDateString() : "—"}` : "Usually reviewed within 24 hours"}
              </p>
            </div>
          </div>

          {isPending && (
            <div className="space-y-2">
              {[
                { icon: "task_alt", text: "Application received" },
                { icon: "manage_search", text: "Identity review in progress…" },
                { icon: "check_circle", text: "Approval & account activation", dim: true },
              ].map(({ icon, text, dim }) => (
                <div key={text} className={`flex items-center gap-2.5 text-sm ${dim ? "text-slate-700" : "text-slate-400"}`}>
                  <Icon name={icon} className={`text-base ${dim ? "text-slate-700" : "text-amber-400"}`} />
                  {text}
                </div>
              ))}
            </div>
          )}

          {isRejected && status.kycNote && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-3">
              <p className="text-xs font-black text-red-400 uppercase tracking-wide mb-1">Rejection reason</p>
              <p className="text-slate-300 text-sm">{status.kycNote}</p>
            </div>
          )}
        </div>

        {isRejected && (
          <div className="bg-[#18191f] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-slate-400 text-sm mb-4">
              You can re-apply with updated information. Make sure your display name follows our guidelines.
            </p>
            <button
              onClick={onRefresh}
              className="w-full py-3 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] transition-all text-sm"
            >
              Re-apply
            </button>
          </div>
        )}

        <div className="text-center mt-4">
          <Link href="/p2p" className="text-slate-600 text-sm hover:text-slate-400 transition-colors">
            ← Back to P2P marketplace
          </Link>
        </div>
      </div>
    </div>
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
const PAY_RAILS = GLOBAL_PAYMENT_METHODS;                 // full world catalogue
const PAY_RAILS_BY_CATEGORY = paymentMethodsByCategory(); // grouped for the picker
const BANKISH = new Set(["BANK", "KUDA", "FNB", "CAPITEC"]);

// Custom, searchable payment-method picker — replaces the native <select> whose
// OS dropdown rendered as a bare radio list. Shows a real brand logo per method,
// grouped by category. The open panel is in-flow (pushes content) so it can
// never be clipped by an overflow-hidden ancestor and scrolls with the page.
function MethodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const q = query.trim().toLowerCase();
  const groups = Object.entries(PAY_RAILS_BY_CATEGORY)
    .map(([cat, list]) => [cat, list.filter((r) => !q || r.label.toLowerCase().includes(q) || r.value.toLowerCase().includes(q))] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <div ref={ref} className="relative col-span-2">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-[#151518] px-2.5 text-[13px] font-bold text-white outline-none">
        <PaymentLogo code={value} size={20} />
        <span className="truncate">{paymentMethodLabel(value)}</span>
        <Icon name="expand_more" className={`ml-auto shrink-0 text-lg text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#15151d] shadow-2xl shadow-black/60">
          <div className="border-b border-white/[0.06] p-2">
            <div className="flex h-9 items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 ring-1 ring-white/[0.06] focus-within:ring-[#087cff]/50">
              <Icon name="search" className="text-[16px] text-slate-500" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payment methods"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-slate-600" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1 [scrollbar-width:thin]">
            {groups.length === 0 && <p className="px-2.5 py-6 text-center text-xs font-bold text-slate-600">No methods found</p>}
            {groups.map(([cat, list]) => (
              <div key={cat}>
                <p className="px-2.5 pb-1 pt-2 text-[9px] font-black uppercase tracking-widest text-slate-600">{cat}</p>
                {list.map((r) => (
                  <button key={r.value} type="button" onClick={() => { onChange(r.value); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${r.value === value ? "bg-[#087cff]/15" : "hover:bg-white/[0.06]"}`}>
                    <PaymentLogo code={r.value} />
                    <span className="text-[13px] font-bold text-white">{r.label}</span>
                    {r.value === value && <Icon name="check" className="ml-auto shrink-0 text-[15px] text-[#087cff]" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentMethodsSection({ openSignal = 0 }: { openSignal?: number }) {
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [method, setMethod]   = useState(PAY_RAILS[0]?.value ?? "MPESA");
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
      setAccountName(""); setAccountNo(""); setBankName("");
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
    <div id="merchant-payment-methods" className="mb-3 scroll-mt-24 overflow-hidden rounded-lg border border-white/[0.06] bg-[#18191f]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-3 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-white">Payment Methods</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Where buyers send fiat after opening an order.</p>
        </div>
        {methods.length > 0 && (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#087cff] px-3 text-[11px] font-black text-white transition hover:bg-[#0570e8]"
          >
            <Icon name={formOpen ? "close" : "add"} className="text-sm" />
            {formOpen ? "Close" : "Add"}
          </button>
        )}
      </div>

      {/* Saved methods */}
      {!loading && methods.length > 0 && (
        <div className="space-y-1.5 px-3 py-3">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
              <div className="flex min-w-0 items-center gap-2.5">
                <PaymentLogo code={m.name} size={26} />
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-white">{paymentMethodLabel(m.name)}{m.bankName ? ` · ${m.bankName}` : ""}</p>
                  <p className="text-[11px] text-slate-400 truncate">{m.accountName} · <span className="font-mono">{m.accountNo}</span></p>
                </div>
              </div>
              <button type="button" onClick={() => del(m.id)} className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition" aria-label="Delete">
                <Icon name="delete" className="text-[16px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/[0.05] px-3 py-3">
          <MethodPicker value={method} onChange={setMethod} />
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name"
            className="col-span-2 h-9 rounded-lg border border-white/[0.08] bg-[#151518] px-2.5 text-[13px] text-white outline-none placeholder:text-slate-600" />
          <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder={accountIdentifierLabel(method)}
            className={`${isBank ? "" : "col-span-2"} h-9 rounded-lg border border-white/[0.08] bg-[#151518] px-2.5 text-[13px] text-white outline-none placeholder:text-slate-600`} />
          {isBank && (
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name"
              className="h-9 rounded-lg border border-white/[0.08] bg-[#151518] px-2.5 text-[13px] text-white outline-none placeholder:text-slate-600" />
          )}
          <button type="button" onClick={add} disabled={saving}
            className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#087cff] text-[13px] font-black text-white transition hover:bg-[#0570e8] disabled:opacity-50">
            <Icon name="add" className="text-base" /> {saving ? "Saving..." : "Add payment method"}
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
  const formatCoinAmount = (crypto: string, amount: number) =>
    Number(amount).toFixed(crypto === "KES" ? 2 : 6);

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

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#18191f]">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:py-2.5">
        <div className="min-w-0">
          <h2 className="text-base font-black text-white">Wallet &amp; Escrow</h2>
          <p className="mt-0.5 text-xs leading-4 text-slate-500">Receive crypto, fund escrow, and track KES Coin backed by your fiat wallet.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
          <button
            onClick={() => { setFundOpen((v) => !v); setE2wOpen(false); setOpen(false); }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#05b957] px-2 py-2 text-[11px] font-black text-white shadow-lg shadow-[#05b957]/20 transition-colors hover:bg-[#28af52] lg:h-9 lg:px-4 lg:text-sm"
          >
            <Icon name="arrow_upward" className="text-base" />
            <span className="whitespace-nowrap">Fund Escrow</span>
          </button>
          <button
            onClick={() => { setE2wOpen((v) => !v); setFundOpen(false); setOpen(false); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-2 text-[11px] font-black text-slate-300 transition-colors hover:bg-white/[0.08] lg:h-9 lg:px-3 lg:text-sm"
          >
            <Icon name="arrow_downward" className="text-base" />
            <span className="whitespace-nowrap">To Wallet</span>
          </button>
          <button
            onClick={() => { setOpen((v) => !v); setFundOpen(false); setE2wOpen(false); setAddress(null); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-2 text-[11px] font-black text-slate-300 transition-colors hover:bg-white/[0.08] lg:h-9 lg:px-3 lg:text-sm"
          >
            <Icon name="qr_code" className="text-base" />
            <span className="whitespace-nowrap">Receive</span>
          </button>
        </div>
      </div>

      {/* Fund Escrow panel */}
      {fundOpen && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-400 mb-3">Move crypto from your wallet to merchant escrow so you can list sell ads.</p>
          {fundableWalletBalances.length === 0 ? (
            <p className="text-slate-600 text-sm">No fundable wallet crypto to move. KES Coin uses fiat wallet balance automatically.</p>
          ) : (
          <div className="grid gap-3 sm:grid-cols-[160px_160px_minmax(0,1fr)_140px] sm:items-end">
            {/* Crypto — driven by actual wallet holdings */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Crypto</label>
              <div className="flex gap-1.5 flex-wrap">
                {walletCryptos.map((c) => {
                  const firstNet = walletBalances.find((b) => b.crypto === c)?.network ?? "TRC20";
                  return (
                    <button key={c} onClick={() => { setFundCrypto(c); setFundNetwork(firstNet); }}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                        fundCrypto === c ? "bg-[#05b957]/15 border-[#05b957] text-[#05b957]" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                      }`}>{c}</button>
                  );
                })}
              </div>
            </div>
            {/* Network — show only if multiple networks exist for selected crypto */}
            {fundNetworks.length > 1 && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Network</label>
              <div className="flex gap-1.5 flex-wrap">
                {fundNetworks.map((n) => (
                  <button key={n} onClick={() => setFundNetwork(n)}
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                      fundNetwork === n ? "bg-[#087cff]/15 border-[#087cff] text-[#087cff]" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                    }`}>{n}</button>
                ))}
              </div>
            </div>
            )}
            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
                Amount
                {fundWalletBal > 0 && (
                  <button onClick={() => setFundAmount(String(fundWalletBal))}
                    className="ml-2 normal-case text-[#087cff] hover:underline">
                    max {fundWalletBal.toFixed(4)}
                  </button>
                )}
              </label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-slate-700 outline-none focus:border-[#087cff]/40 transition-colors"
              />
            </div>
            {/* Submit */}
            <button
              onClick={fundEscrow}
              disabled={funding || !fundAmount}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#05b957] px-4 text-sm font-black text-white transition-all hover:bg-[#28af52] disabled:opacity-50"
            >
              {funding
                ? <LoadingDots label="Moving" />
                : <><Icon name="arrow_forward" className="text-base" /> Move to Escrow</>}
            </button>
          </div>
          )}
        </div>
      )}

      {/* Escrow → Wallet panel */}
      {e2wOpen && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-400 mb-3">Move crypto from your merchant escrow back into your normal wallet.</p>
          {movableEscrowBalances.length === 0 ? (
            <p className="text-slate-600 text-sm">No movable blockchain crypto in escrow. KES Coin is already backed by the fiat wallet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_140px] sm:items-end">
              {/* Crypto selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Crypto</label>
                <div className="flex gap-1.5 flex-wrap">
                  {movableEscrowBalances.map((b) => (
                    <button key={b.crypto} onClick={() => setE2wCrypto(b.crypto)}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                        e2wCrypto === b.crypto ? "bg-[#05b957]/15 border-[#05b957] text-[#05b957]" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                      }`}>{b.crypto}</button>
                  ))}
                </div>
              </div>
              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">
                  Amount
                  {e2wEscrowBal > 0 && (
                    <button onClick={() => setE2wAmount(String(e2wEscrowBal))}
                      className="ml-2 normal-case text-[#087cff] hover:underline">
                      max {e2wEscrowBal.toFixed(4)}
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  value={e2wAmount}
                  onChange={(e) => setE2wAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-slate-700 outline-none focus:border-[#087cff]/40 transition-colors"
                />
              </div>
              {/* Submit */}
              <button
                onClick={escrowToWallet}
                disabled={e2wLoading || !e2wAmount}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#087cff] px-4 text-sm font-black text-white transition-all hover:bg-[#0570e8] disabled:opacity-50"
              >
                {e2wLoading
                  ? <LoadingDots label="Moving" />
                  : <><Icon name="arrow_downward" className="text-base" /> Move to Wallet</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deposit address panel */}
      {open && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-4">
          {/* Crypto + Network selectors */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_220px] lg:items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Crypto</label>
              <div className="flex gap-1.5">
                {["USDT"].map((c) => (
                  <button
                    key={c}
                    onClick={() => handleCryptoChange(c)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-black transition-all ${
                      crypto === c
                        ? "bg-[#05b957]/15 border-[#05b957] text-[#05b957]"
                        : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Network</label>
              <div className="flex gap-1.5 flex-wrap">
                {NETWORK_OPTIONS[crypto].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setNetwork(n); setAddress(null); }}
                    className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                      network === n
                        ? "bg-[#087cff]/15 border-[#087cff] text-[#087cff]"
                        : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Get address button */}
            {!address && (
              <button
                onClick={fetchAddress}
                disabled={addrLoading}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#05b957] px-4 text-sm font-black text-white transition-all hover:bg-[#28af52] disabled:opacity-50"
              >
                {addrLoading
                  ? <LoadingDots label="Generating" />
                  : <><Icon name="qr_code" className="text-base" /> Get Address</>}
              </button>
            )}
          </div>

          {/* Address display */}
          {address && (
            <div className="mt-4 space-y-3">
              {/* Warning */}
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                <Icon name="warning" className="text-amber-400 text-sm shrink-0 mt-0.5" />
                <p className="text-amber-300 text-xs leading-relaxed">{NETWORK_WARN[network]}</p>
              </div>

              {/* QR + Address */}
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:flex-row">
                {/* QR code */}
                {qrUrl && (
                  <div className="shrink-0 w-[120px] h-[120px] rounded-xl overflow-hidden border border-white/10 bg-white p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="Deposit QR" width={120} height={120} className="w-full h-full" />
                  </div>
                )}

                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-slate-500 text-xs mb-2 font-bold uppercase tracking-wide">
                    Your {crypto} ({network}) deposit address
                  </p>
                  <p className="font-mono text-white text-xs sm:text-sm break-all leading-relaxed mb-3">
                    {address}
                  </p>
                  <button
                    onClick={copyAddress}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all mx-auto sm:mx-0 ${
                      copied
                        ? "bg-[#05b957]/20 border border-[#05b957] text-[#05b957]"
                        : "bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12]"
                    }`}
                  >
                    <Icon name={copied ? "check" : "content_copy"} className="text-sm" />
                    {copied ? "Copied!" : "Copy Address"}
                  </button>
                </div>
              </div>

              {/* Auto-detect notice */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-[#05b957] animate-pulse shrink-0" />
                Detected automatically on-chain. Funds credit to your wallet within 1–5 minutes — then use Fund Escrow to move them.
              </div>

              <button
                onClick={() => { setAddress(null); setOpen(false); }}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Wallet + Escrow balance rows */}
      <div className="border-b border-white/[0.06] bg-white/[0.01] px-3 py-3 lg:hidden">
        <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Asset</label>
        <div className="relative mb-3">
          <select
            value={selectedMobileBalance?.crypto ?? mobileBalanceCrypto}
            onChange={(event) => setMobileBalanceCrypto(event.target.value)}
            className="h-12 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#18191f] pl-12 pr-10 text-sm font-black text-white outline-none focus:border-[#087cff]/50"
          >
            {mobileSelectableBalances.map((row) => (
              <option key={row.crypto} value={row.crypto} style={{ background: "#18191f", color: "#fff" }}>
                {row.crypto} · {P2P_CRYPTOS.find((coin) => coin.symbol === row.crypto)?.name ?? "Crypto"}
              </option>
            ))}
          </select>
          {selectedMobileMeta?.icon ? (
            <img src={selectedMobileMeta.icon} alt="" className="pointer-events-none absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full" />
          ) : (
            <div className="pointer-events-none absolute left-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-white/[0.06] text-[10px] font-black text-slate-400">
              {selectedMobileBalance?.crypto?.slice(0, 1) ?? "?"}
            </div>
          )}
          <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-500" />
        </div>

        {selectedMobileBalance && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {selectedMobileMeta?.icon && <img src={selectedMobileMeta.icon} alt="" className="h-8 w-8 shrink-0 rounded-full" />}
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{selectedMobileBalance.crypto}</p>
                  <p className="truncate text-[10px] font-semibold text-slate-600">{selectedMobileBalance.network}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
              <div className="px-3 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <Icon name="account_balance_wallet" className="text-[13px]" />
                  Wallet
                </p>
                <p className={selectedMobileBalance.walletAvailable > 0 ? "text-base font-black text-white" : "text-base font-black text-slate-700"}>
                  {formatCoinAmount(selectedMobileBalance.crypto, selectedMobileBalance.walletAvailable)}
                </p>
              </div>
              <div className="px-3 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <Icon name="lock" className="text-[13px]" />
                  Escrow
                </p>
                <p className={selectedMobileBalance.escrowAvailable > 0 ? "text-base font-black text-white" : "text-base font-black text-slate-700"}>
                  {formatCoinAmount(selectedMobileBalance.crypto, selectedMobileBalance.escrowAvailable)}
                </p>
              </div>
            </div>
            {(selectedMobileBalance.walletLocked + selectedMobileBalance.escrowLocked) > 0 && (
              <div className="border-t border-white/[0.05] px-3 py-2 text-[11px] font-bold text-amber-400">
                {formatCoinAmount(selectedMobileBalance.crypto, selectedMobileBalance.walletLocked + selectedMobileBalance.escrowLocked)} locked in active orders
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden border-b border-white/[0.06] bg-white/[0.01] px-4 py-3 lg:block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Balances</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
              Deposits land in wallet. Escrow backs ads; locked funds are in active orders.
            </p>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Icon name="account_balance_wallet" className="text-lg" />
            <Icon name="lock" className="text-lg" />
          </div>
        </div>

        <div className="max-h-[320px] overflow-auto rounded-lg border border-white/[0.06] [scrollbar-width:thin]">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#14141c] text-[10px] font-black uppercase tracking-wide text-slate-600">
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Network</th>
                <th className="px-3 py-2 text-right">Wallet</th>
                <th className="px-3 py-2 text-right">Escrow</th>
                <th className="px-3 py-2 text-right">Locked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {balanceTableRows.map((row) => {
                const lockedTotal = row.walletLocked + row.escrowLocked;
                const hasValue = row.walletAvailable > 0 || row.escrowAvailable > 0 || lockedTotal > 0;
                return (
                  <tr key={row.crypto} className="bg-white/[0.015] transition hover:bg-white/[0.035]">
                    <td className="px-3 py-2.5">
                      <span className={hasValue ? "font-black text-white" : "font-black text-slate-600"}>{row.crypto}</span>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 font-semibold text-slate-600">{row.network}</td>
                    <td className={row.walletAvailable > 0 ? "px-3 py-2.5 text-right font-black text-white" : "px-3 py-2.5 text-right font-black text-slate-700"}>
                      {formatCoinAmount(row.crypto, row.walletAvailable)}
                    </td>
                    <td className={row.escrowAvailable > 0 ? "px-3 py-2.5 text-right font-black text-white" : "px-3 py-2.5 text-right font-black text-slate-700"}>
                      {formatCoinAmount(row.crypto, row.escrowAvailable)}
                    </td>
                    <td className={lockedTotal > 0 ? "px-3 py-2.5 text-right font-black text-amber-400" : "px-3 py-2.5 text-right font-black text-slate-700"}>
                      {formatCoinAmount(row.crypto, lockedTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hidden gap-2 border-b border-white/[0.06] px-4 py-3 text-[11px] text-slate-500 sm:grid sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <Icon name="download" className="mt-0.5 text-sm text-[#087cff]" />
          <span>Receive crypto to wallet addresses.</span>
        </div>
        <div className="flex items-start gap-2">
          <Icon name="arrow_upward" className="mt-0.5 text-sm text-[#05b957]" />
          <span>Fund escrow for crypto ads. KES Coin uses fiat wallet automatically.</span>
        </div>
        <div className="flex items-start gap-2">
          <Icon name="percent" className="mt-0.5 text-sm text-amber-400" />
          <span>Trade fees are deducted on release.</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
        <div>
          <p className="text-xs font-black text-white">Recent Escrow Movements</p>
          <p className="mt-0.5 text-[11px] text-slate-600">Funds moved into merchant escrow.</p>
        </div>
      </div>

      {/* Escrow movement history table */}
      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[#05b957] rounded-full animate-spin" />
        </div>
      ) : deposits.length === 0 ? (
        <div className="flex min-h-[78px] flex-col items-center justify-center px-4 py-3 text-center">
          <Icon name="account_balance_wallet" className="mb-2 text-2xl text-slate-700" />
          <p className="text-slate-500 text-sm">No escrow movements yet</p>
          <p className="text-slate-600 text-xs mt-1">Use Fund Escrow above to move wallet crypto here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {[
                  { h: "Date",    hide: false },
                  { h: "Crypto",  hide: false },
                  { h: "Amount",  hide: false },
                  { h: "Network", hide: true },
                  { h: "TX Hash", hide: true },
                  { h: "Status",  hide: false },
                ].map(({ h, hide }) => (
                  <th key={h} className={`px-3 py-3 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest sm:px-4 ${hide ? "hidden sm:table-cell" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deposits.map((d, i) => (
                <tr key={d.id} className={`${i < deposits.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}>
                  <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap sm:px-4">{new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</td>
                  <td className="px-3 py-3 text-white font-black text-xs sm:px-4">{d.crypto}</td>
                  <td className="px-3 py-3 text-white font-black text-xs sm:px-4 sm:text-sm">{Number(d.amount).toFixed(6)}</td>
                  <td className="hidden px-3 py-3 text-slate-400 text-xs sm:table-cell sm:px-4">{d.network}</td>
                  <td className="hidden px-3 py-3 font-mono text-slate-500 text-xs sm:table-cell sm:px-4">
                    {d.txHash ? (
                      <span title={d.txHash}>{d.txHash.length > 14 ? `${d.txHash.slice(0, 7)}…${d.txHash.slice(-7)}` : d.txHash}</span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 sm:px-4"><Badge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
    profitMarginPct: "",
    totalAmount: ad ? String(ad.totalAmount) : "",
    minLimit: ad ? String(ad.minLimit) : "",
    maxLimit: ad ? String(ad.maxLimit) : "",
    paymentMethods: ad?.paymentMethods ?? [] as string[],
    paymentWindow: ad ? String(ad.paymentWindow) : "15",
    terms: ad?.terms ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0); // 0=Type & Price · 1=Amount & Method · 2=Conditions
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [fiatOpen, setFiatOpen] = useState(false);
  const [fiatQuery, setFiatQuery] = useState("");
  const [spotRate, setSpotRate] = useState<number | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<PayMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [escrowBalances, setEscrowBalances] = useState<CryptoBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const f = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/p2p/merchant/payment-methods")
      .then((response) => response.ok ? response.json() : [])
      .then((methods: PayMethod[]) => {
        if (cancelled) return;
        setSavedPaymentMethods(methods);
        const savedCodes = new Set(methods.map((method) => method.name));
        setForm((current) => ({
          ...current,
          paymentMethods: current.paymentMethods.filter((method) => savedCodes.has(method)),
        }));
      })
      .finally(() => {
        if (!cancelled) setPaymentMethodsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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


  // Reference rate for the margin readout. Real cryptos use a live market rate;
  // KES Coin is pegged 1:1 to fiat (no market) so its reference is always 1.00,
  // and the merchant's % is a spread on top of the peg (their cash-in/out rate).
  useEffect(() => {
    let cancelled = false;
    if (form.crypto === "KES") {
      setSpotRate(1);
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
  const isKesCoinForm = form.crypto === "KES"; // pegged 1:1 reference; merchant sets a spread %
  const totalAmountNum = Number(form.totalAmount) || 0;
  const fullOrderValue = totalAmountNum > 0 && priceNum > 0
    ? Math.floor(totalAmountNum * priceNum * 100) / 100
    : 0;
  const selectedEscrow = escrowBalances.find((balance) => balance.crypto === form.crypto);
  const sellableBalance = form.crypto === "KES"
    ? Math.max(0, fiatBalance / 1.01)
    : Number(selectedEscrow?.available ?? 0);
  const exceedsSellableBalance = !isEditing && form.side === "SELL" && totalAmountNum > sellableBalance;
  const requiredKesBacking = totalAmountNum > 0 ? parseFloat((totalAmountNum * 1.01).toFixed(2)) : 0;
  const needsKesBacking = !isEditing && form.side === "SELL" && form.crypto === "KES" && requiredKesBacking > 0 && fiatBalance < requiredKesBacking;
  const priceRangeMin = spotRate ? spotRate * 0.8 : priceNum > 0 ? priceNum * 0.8 : null;
  const priceRangeMax = spotRate ? spotRate * 2 : priceNum > 0 ? priceNum * 2 : null;
  const highestOrderPrice = spotRate ? spotRate * 1.1 : priceNum > 0 ? priceNum * 1.1 : null;

  function togglePm(m: string) {
    setForm((p) => ({ ...p, paymentMethods: p.paymentMethods.includes(m) ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m] }));
  }

  // Only offer saved methods that make sense for the selected fiat — a KES-only
  // merchant picking NGN shouldn't see M-Pesa; universal rails (Bank, PayPal…)
  // stay available for every currency.
  const fiatSavedMethods = savedPaymentMethods.filter((m) => methodAllowedForFiat(m.name, form.fiat));

  // When the fiat changes, drop any already-selected methods that no longer
  // apply so an ad never ships with a currency-mismatched payment method.
  useEffect(() => {
    setForm((p) => {
      const kept = p.paymentMethods.filter((code) => methodAllowedForFiat(code, p.fiat));
      return kept.length === p.paymentMethods.length ? p : { ...p, paymentMethods: kept };
    });
  }, [form.fiat]);

  async function submit() {
    if (savedPaymentMethods.length === 0) {
      return toast.error("Add a payment method in Merchant Center before posting an ad");
    }
    if (
      !form.pricePerUnit ||
      !form.totalAmount ||
      !form.paymentMethods.length ||
      !form.minLimit || !form.maxLimit
    )
      return toast.error("Please fill all required fields");

    // Order limits now apply to both Buy and Sell ads.
    const minLimit = Number(form.minLimit);
    const maxLimit = Number(form.maxLimit);
    const profitMarginPct = Number(form.profitMarginPct);
    if (canUseMarginPricing && (!Number.isFinite(profitMarginPct) || profitMarginPct <= -100)) {
      return toast.error("Margin must be greater than -100%");
    }
    if (needsKesBacking) {
      return toast.error(`Top up your fiat wallet first. This KES Coin sell ad needs KSh ${requiredKesBacking.toLocaleString("en-KE")} including the 1% seller fee.`);
    }
    if (exceedsSellableBalance) {
      return toast.error(`You can sell up to ${sellableBalance.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${form.crypto} from escrow.`);
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
          totalAmount: Number(form.totalAmount),
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
      if (canUseMarginPricing) {
        const pct = Number(form.profitMarginPct);
        if (Number.isFinite(pct) && pct <= -100) return toast.error("Margin must be greater than -100%");
      }
      return setStep(1);
    }
    if (step === 1) {
      if (savedPaymentMethods.length === 0) return toast.error("Add a payment method in Merchant Center before posting an ad");
      if (!isEditing && totalAmountNum <= 0) return toast.error(`Enter the total ${form.crypto} amount`);
      if (needsKesBacking) return toast.error(`Top up your fiat wallet first. This KES Coin sell ad needs KSh ${requiredKesBacking.toLocaleString("en-KE")}.`);
      if (exceedsSellableBalance) return toast.error(`You can sell up to ${sellableBalance.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${form.crypto} from escrow.`);
      if (!form.minLimit || !form.maxLimit) return toast.error("Enter min and max order limits");
      if (!form.paymentMethods.length) return toast.error("Select at least one payment method");
      return setStep(2);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/90 backdrop-blur-md p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="no-scrollbar flex h-[100dvh] w-full max-w-[420px] flex-col overflow-hidden border border-white/10 bg-[#151518] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* ── Header + stepper ── */}
        <div className="shrink-0 border-b border-white/[0.07] bg-[#151518] px-4 pb-5 pt-[calc(1.1rem+env(safe-area-inset-top))]">
          <div className="mb-6 flex items-center justify-between">
            <button onClick={step === 0 ? onClose : () => setStep((s) => s - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/[0.06]">
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
            <h3 className="text-[15px] font-black tracking-wide text-white">{isEditing ? "Edit Ad" : "Post Normal Ad"}</h3>
            <span className="h-9 w-9" aria-hidden />
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
          {/* Crypto dropdown */}
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">Asset</label>
            <div className="relative">
              <button
                type="button"
                disabled={isEditing}
                onClick={() => !isEditing && setCryptoOpen((v) => !v)}
                className="flex h-12 w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[14px] font-black text-white transition-colors hover:border-white/20 disabled:opacity-60"
              >
                {(() => { const m = P2P_CRYPTOS.find((c) => c.symbol === form.crypto); return m ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.icon} alt={m.symbol} className="h-5 w-5 rounded-full" />
                    <span className="font-black">{m.symbol}</span>
                  </>
                ) : <span>{form.crypto}</span>; })()}
                {!isEditing && <Icon name="arrow_drop_down" className={`ml-auto text-[22px] text-slate-500 transition-transform ${cryptoOpen ? "rotate-180" : ""}`} />}
              </button>
              {cryptoOpen && !isEditing && (
                <>
                  <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setCryptoOpen(false)} />
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#18191f] p-1 shadow-2xl shadow-black/60">
                    {P2P_CRYPTOS.map((c) => (
                      <button
                        key={c.symbol}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            crypto: c.symbol,
                            // Reset price so the spot-rate effect prefills the new asset's market price.
                            pricePerUnit: c.symbol === "KES" ? "1" : "",
                            profitMarginPct: c.symbol === "KES" ? "0" : "",
                          }));
                          setCryptoOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${form.crypto === c.symbol ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.icon} alt={c.symbol} className="h-5 w-5 rounded-full" />
                        <span className="text-sm font-black text-white">{c.symbol}</span>
                        <span className="truncate text-xs font-semibold text-slate-500">{c.name}</span>
                        {form.crypto === c.symbol && <Icon name="check" className="ml-auto shrink-0 text-[16px] text-[#55aaff]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fiat currency selector — real flags */}
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">With Fiat</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setFiatOpen((v) => !v); setFiatQuery(""); }}
                className="flex h-12 w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[14px] font-black text-white transition-colors hover:border-white/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flagUrl(form.fiat)} alt="" className="h-4 w-6 shrink-0 rounded-[3px] object-cover" />
                <span className="font-black">{form.fiat}</span>
                <Icon name="arrow_drop_down" className={`ml-auto text-[22px] text-slate-500 transition-transform ${fiatOpen ? "rotate-180" : ""}`} />
              </button>
              {fiatOpen && (
                <>
                  <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setFiatOpen(false)} />
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#18191f] shadow-2xl shadow-black/60">
                    <div className="p-2">
                      <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                        <Icon name="search" className="text-[16px] text-slate-500" />
                        <input
                          autoFocus
                          value={fiatQuery}
                          onChange={(e) => setFiatQuery(e.target.value)}
                          placeholder="Search currency"
                          className="h-9 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto px-1 pb-2 [scrollbar-width:thin]">
                      {FIAT_CURRENCIES
                        .filter((c) => { const q = fiatQuery.trim().toLowerCase(); return !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q); })
                        .map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              // Keep selections that the merchant actually has
                              // configured — payment methods are NOT restricted
                              // by the ad's fiat (a merchant may accept PayPal,
                              // Wise, etc. for any currency).
                              const allowed = new Set(savedPaymentMethods.map((m) => m.name));
                              setForm((p) => ({
                                ...p,
                                fiat: c.code,
                                paymentMethods: p.paymentMethods.filter((m) => allowed.has(m)),
                                // Reset price so it refills with the live rate in the new currency.
                                pricePerUnit: p.crypto === "KES" ? p.pricePerUnit : "",
                                profitMarginPct: p.crypto === "KES" ? p.profitMarginPct : "",
                              }));
                              setFiatOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${form.fiat === c.code ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={flagUrl(c.code)} alt="" className="h-4 w-6 shrink-0 rounded-[3px] object-cover" />
                            <span className="text-sm font-black text-white">{c.code}</span>
                            <span className="truncate text-xs font-semibold text-slate-500">{c.name}</span>
                            {form.fiat === c.code && <Icon name="check" className="ml-auto shrink-0 text-[16px] text-[#55aaff]" />}
                          </button>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">Price</label>
            <p className="text-[11px] font-semibold leading-4 text-slate-500">
              Your price tracks the live market by the margin you set below — you pick your %.
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
                    ? ` spread on 1:1 · ${formatFiat(spotRate!, form.fiat)}/KES Coin`
                    : ` vs live market · ${formatFiat(spotRate!, form.fiat)}/${form.crypto}`}
                </span>
              </p>
            ) : null}
          </div>

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
                Market
              </button>
            </div>
            {!canUseMarginPricing ? (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                Live market rate is temporarily unavailable for {form.crypto}/{form.fiat}. Please try again shortly.
              </p>
            ) : isKesCoinForm ? (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                KES Coin is pegged 1:1. Your % is the spread buyers pay on top.
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] font-semibold text-slate-500">
                Live market {formatFiat(spotRate!, form.fiat)}/{form.crypto} × your margin = your price.
              </p>
            )}
          </div>
          </div>
          )}

          {/* ════ STEP 2 — Set Amount & Method ════ */}
          {step === 1 && (
          <div className="grid gap-5">
          {!isEditing && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Total {form.crypto} to {form.side === "SELL" ? "sell" : "buy"}
                </label>
                {form.side === "SELL" && (
                  <span className="text-right text-[10px] font-semibold text-slate-500">
                    {balancesLoading
                      ? "Loading balance..."
                      : <>Available <strong className="text-white">{sellableBalance.toLocaleString("en-US", { maximumFractionDigits: 8 })} {form.crypto}</strong></>}
                  </span>
                )}
              </div>
              <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#15161d] pr-2 focus-within:border-[#087cff]/40">
                <input
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) => f("totalAmount", e.target.value)}
                  placeholder={form.crypto === "BTC" ? "e.g. 0.001" : form.crypto === "ETH" ? "e.g. 0.01" : "e.g. 10"}
                  className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder:text-slate-700 outline-none"
                />
                <span className="text-xs font-black text-slate-500">{form.crypto}</span>
                {form.side === "SELL" && (
                  <button
                    type="button"
                    disabled={balancesLoading || sellableBalance <= 0}
                    onClick={() => f("totalAmount", String(Number(sellableBalance.toFixed(8))))}
                    className="ml-2 rounded-lg bg-[#087cff]/15 px-2.5 py-1.5 text-[11px] font-black text-[#55aaff] transition hover:bg-[#087cff]/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Max
                  </button>
                )}
              </div>
              {form.side === "SELL" && !balancesLoading && (
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold">
                  <span className={sellableBalance > 0 ? "text-[#05b957]" : "text-amber-300"}>
                    {sellableBalance > 0 ? "Ready in merchant escrow" : "No sellable balance in escrow"}
                  </span>
                  {Number(selectedEscrow?.locked ?? 0) > 0 && (
                    <span className="text-right text-amber-300">{Number(selectedEscrow?.locked).toLocaleString()} locked in orders</span>
                  )}
                </div>
              )}
            </div>
          )}

          {needsKesBacking && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] font-bold text-amber-300 lg:col-span-2">
              Top up your fiat wallet first. This KES Coin sell ad needs KSh {requiredKesBacking.toLocaleString("en-KE")} including the 1% seller fee; you have KSh {fiatBalance.toLocaleString("en-KE")}.
            </div>
          )}
          {exceedsSellableBalance && !needsKesBacking && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-[12px] font-bold text-red-300 lg:col-span-2">
              Amount exceeds your available escrow balance of {sellableBalance.toLocaleString("en-US", { maximumFractionDigits: 8 })} {form.crypto}.
            </div>
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
            Order limits apply to both buy and sell ads. Max fills the full backed value of {fullOrderValue > 0 ? `${form.fiat} ${fullOrderValue.toLocaleString("en-KE", { maximumFractionDigits: 2 })}` : "the ad"}.
          </p>

          <div className="lg:col-span-2">
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">Payment methods</label>
            {paymentMethodsLoading ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-xs font-semibold text-slate-500">
                Loading saved payment methods...
              </div>
            ) : savedPaymentMethods.length === 0 ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-3">
                <p className="text-xs font-black text-amber-300">Payment setup required</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">
                  Add the account where buyers should send payment. Ads cannot be posted without saved payout details.
                </p>
                <button
                  type="button"
                  onClick={() => (onSetupPayments ?? onClose)()}
                  className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-300 px-3 text-xs font-black text-black"
                >
                  <Icon name="add" className="text-sm" />
                  Add payment method
                </button>
              </div>
            ) : fiatSavedMethods.length === 0 ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-3">
                <p className="text-xs font-black text-amber-300">No {form.fiat} payment method</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">
                  None of your saved payment methods work for {form.fiat}. Add a method buyers can use to pay in {form.fiat}.
                </p>
                <button
                  type="button"
                  onClick={() => (onSetupPayments ?? onClose)()}
                  className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-300 px-3 text-xs font-black text-black"
                >
                  <Icon name="add" className="text-sm" />
                  Add a {form.fiat} method
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {fiatSavedMethods.map((method) => {
                  const value = method.name;
                  return (
                    <button key={value} type="button" onClick={() => togglePm(value)}
                      className={`rounded-xl border py-2 text-xs font-bold transition-all ${form.paymentMethods.includes(value) ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"}`}>
                      {paymentMethodLabel(value)}{method.bankName ? ` · ${method.bankName}` : ""}
                    </button>
                  );
                })}
              </div>
            )}
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
              <div className="flex items-center justify-between"><span className="text-slate-500">Amount</span><span className="font-black text-white">{totalAmountNum > 0 ? `${totalAmountNum.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${form.crypto}` : "--"}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Order limits</span><span className="font-black text-white">{form.minLimit && form.maxLimit ? `${form.fiat} ${Number(form.minLimit).toLocaleString()} – ${Number(form.maxLimit).toLocaleString()}` : "--"}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Payment</span><span className="font-black text-white">{form.paymentMethods.length ? form.paymentMethods.map((m) => paymentMethodLabel(m)).join(", ") : "--"}</span></div>
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
              disabled={step === 2 && (submitting || paymentMethodsLoading || savedPaymentMethods.length === 0 || exceedsSellableBalance)}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-[#087cff] text-[13px] font-black text-white shadow-lg shadow-[#087cff]/20 transition-all hover:bg-[#1a78ff] active:scale-[0.98] disabled:opacity-50 ${step > 0 ? "flex-1" : "w-full"}`}>
              {step === 2
                ? (submitting ? <LoadingDots label={isEditing ? "Saving" : "Creating"} /> : isEditing ? "Save Changes" : "Post ad")
                : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Merchant Dashboard ───────────────────────────────────────────────────────

function MerchantDashboard({ status }: { status: MerchantStatus }) {
  const { user } = useSupabaseAuth();
  const [ads, setAds]           = useState<Ad[]>([]);
  const [loading, setLoading]   = useState(true);
  const [merchantProfile, setMerchantProfile] = useState<MerchantStatus>(status);
  const [createOpen, setCreate] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [section, setSection] = useState<"overview" | "profile" | "wallet" | "payments" | "ads">("overview");
  // Bumped to jump from an ad's "Add payment method" straight into the Payment
  // Methods tab with the add form open.
  const [payFormSignal, setPayFormSignal] = useState(0);
  const goToAddPayment = useCallback(() => {
    setCreate(false);
    setEditingAd(null);
    setSection("payments");
    setPayFormSignal((n) => n + 1);
  }, []);
  const [adFilter, setAdFilter] = useState<"ALL" | "ACTIVE" | "PAUSED" | "EXHAUSTED">("ALL");
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
      setMerchantProfile((current) => ({ ...current, displayName: n }));
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
      setMerchantProfile((current) => ({ ...current, avatarUrl: publicUrl }));

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

  const loadMerchantProfile = useCallback(async () => {
    try {
      const r = await fetch("/api/p2p/merchant/profile", { cache: "no-store" });
      if (r.ok) setMerchantProfile(await r.json());
    } catch {
      /* keep initial profile payload */
    }
  }, []);

  useEffect(() => { loadMerchantProfile(); }, [loadMerchantProfile]);

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
  const profileCreatedAt = merchantProfile.createdAt ?? status.createdAt;
  const profileCompleted = Number(merchantProfile.completedTrades ?? 0);
  const profileTotal = Number(merchantProfile.totalTrades ?? profileCompleted);
  const profileCompletion = Number(merchantProfile.completionRate ?? 0);
  const profileRelease = Number(merchantProfile.avgReleaseTime ?? 0);
  const profileFeedbackCount = Number(merchantProfile.feedbackCount ?? 0);
  const profileFeedbackAverage = Number(merchantProfile.feedbackAverage ?? 0);
  const profilePositiveRate = Number(merchantProfile.positiveFeedbackRate ?? 0);
  const profileFeedback = merchantProfile.feedback ?? [];
  const profileRegistered = profileCreatedAt
    ? `${Math.max(0, Math.floor((Date.now() - new Date(profileCreatedAt).getTime()) / 86_400_000)).toLocaleString()} Day(s) ago`
    : "—";
  const profileReleaseLabel = profileRelease > 0 ? `${profileRelease.toFixed(2)} Minute(s)` : "—";

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
      {createOpen && <CreateAdModal onClose={() => setCreate(false)} onCreated={loadAds} onSetupPayments={goToAddPayment} />}
      {editingAd && <CreateAdModal ad={editingAd} onClose={() => setEditingAd(null)} onCreated={loadAds} onSetupPayments={goToAddPayment} />}

      {/* Merchant header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label
            className="group relative h-12 w-12 shrink-0 cursor-pointer lg:h-10 lg:w-10"
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
              className="pointer-events-none h-12 w-12 lg:h-10 lg:w-10 [&_img]:shadow-lg [&_img]:shadow-black/30 lg:[&_img]:rounded-lg"
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
        {/* Post Ad — icon-only on mobile, full button on sm+ */}
        <button
          onClick={() => setCreate(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[#087cff] p-2.5 text-sm font-black text-white shadow-lg shadow-[#087cff]/20 transition-colors hover:bg-[#0570e8] sm:px-4 sm:py-2 lg:h-9"
        >
          <Icon name="add" className="text-base" />
          <span className="hidden sm:inline">Post Ad</span>
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#101118] p-1 sm:flex sm:overflow-x-auto">
        {([
          ["overview", "Overview", "dashboard"],
          ["profile", "Profile", "person"],
          ["wallet", "Wallet & Escrow", "account_balance_wallet"],
          ["payments", "Payment Methods", "payments"],
          ["ads", `Ads ${ads.length}`, "campaign"],
        ] as const).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition sm:shrink-0 sm:justify-start sm:px-4 ${
              section === id ? "bg-[#087cff] text-white shadow-lg shadow-[#087cff]/15" : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <Icon name={icon} className="shrink-0 text-base" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

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
              <p className="mt-1 text-xs leading-5 text-slate-500">Fund escrow, withdraw to wallet, receive crypto and review movements.</p>
            </button>
            <button onClick={() => setSection("ads")} className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4 text-left transition hover:border-[#087cff]/25 hover:bg-[#18191f]">
              <Icon name="campaign" className="text-xl text-[#087cff]" />
              <p className="mt-3 text-sm font-black text-white">Manage ads</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{activeAds.length} active, {exhaustedAds.length} exhausted or needing attention.</p>
            </button>
            <button onClick={() => setSection("payments")} className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4 text-left transition hover:border-amber-400/25 hover:bg-[#18191f]">
              <Icon name="payments" className="text-xl text-amber-400" />
              <p className="mt-3 text-sm font-black text-white">Payment rails</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Control the M-Pesa, Airtel Money and bank accounts shown in orders.</p>
            </button>
          </div>
        </>
      )}

      {section === "profile" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4">
            <p className="mb-4 text-xs font-black uppercase tracking-wide text-slate-500">Public profile stats</p>

            <div className="divide-y divide-white/[0.06]">
              {[
                ["30d Trades", profileCompleted.toLocaleString()],
                ["30d Completion Rate", `${profileCompletion.toFixed(1)}%`],
                ["Avg. Release Time", profileReleaseLabel],
                ["Positive Feedback", `${profilePositiveRate.toFixed(1)}%`],
                ["Avg. Rating", profileFeedbackCount > 0 ? `${profileFeedbackAverage.toFixed(1)} / 5` : "—"],
                ["Registered", profileRegistered],
                ["All Trades", `${profileTotal.toLocaleString()} Time(s)`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-right font-black text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-[#18191f] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">Received Feedback</h2>
                <p className="mt-0.5 text-xs text-slate-500">{profileFeedbackCount} review{profileFeedbackCount === 1 ? "" : "s"} from completed trades</p>
              </div>
              <span className="rounded-lg bg-[#05b957]/10 px-2.5 py-1 text-xs font-black text-[#05b957]">
                {profileFeedbackCount > 0 ? `${profileFeedbackAverage.toFixed(1)} / 5` : "New"}
              </span>
            </div>

            {profileFeedback.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-8 text-center">
                <Icon name="rate_review" className="mx-auto text-2xl text-slate-600" />
                <p className="mt-2 text-sm font-black text-white">No feedback yet</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Feedback will appear here after completed traders submit reviews.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {profileFeedback.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <MerchantAvatar
                        id={item.fromUser.displayName}
                        name={item.fromUser.displayName}
                        avatarUrl={item.fromUser.imageUrl}
                        size={32}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{item.fromUser.displayName}</p>
                        <p className="text-[11px] font-bold text-[#05b957]">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</p>
                      </div>
                      <span className="text-[10px] text-slate-600">{new Date(item.createdAt).toLocaleDateString("en-KE", { month: "short", day: "2-digit" })}</span>
                    </div>
                    {item.comment && <p className="mt-2 text-xs leading-5 text-slate-400">{item.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {section === "wallet" && <DepositSection />}
      {section === "payments" && <PaymentMethodsSection openSignal={payFormSignal} />}

      {/* Ads list */}
      {section === "ads" && <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-white font-black text-base">My Ads</h2>
            <p className="text-slate-500 text-xs mt-0.5">{activeAds.length} active · {ads.length} total</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-white/[0.03] p-1">
            {(["ALL", "ACTIVE", "PAUSED", "EXHAUSTED"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setAdFilter(filter);
                  setAdPage(1);
                  setOpenAdMenu(null);
                }}
                className={`rounded-md px-3 py-1.5 text-[10px] font-black transition ${
                  adFilter === filter ? "bg-white/[0.10] text-white" : "text-slate-600 hover:text-slate-300"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.03] px-6 py-5 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <Icon name="post_add" className="text-xl text-slate-500" />
            </div>
            <p className="mb-1 text-base font-black text-white">{ads.length ? `No ${adFilter.toLowerCase()} ads` : "No ads yet"}</p>
            <p className="mb-4 max-w-sm text-sm leading-6 text-slate-500">{ads.length ? "Choose another filter to view your inventory." : "Create your first ad to start trading."}</p>
            <button onClick={() => setCreate(true)} className="px-5 py-2.5 rounded-xl bg-[#087cff] text-white font-black text-sm hover:bg-[#0570e8] transition-colors">
              {ads.length ? "Post New Ad" : "Create First Ad"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAds.map((ad) => {
              const pmLabel = (m: string) => paymentMethodLabel(m);
              const filled = Number(ad.totalAmount) - Number(ad.availableAmount);
              const fillPct = Number(ad.totalAmount) > 0 ? (filled / Number(ad.totalAmount)) * 100 : 0;
              const dotColor = P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)?.color ?? "#087cff";
              return (
                <div key={ad.id} className="relative grid w-full grid-cols-[minmax(0,1fr)_44px] gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.07] transition hover:bg-white/[0.03] hover:ring-white/[0.14] sm:px-4 lg:items-center">
                  <div className="min-w-0">
                    {/* Row 1: crypto dot + name + side badge + status */}
                    <div className="mb-1.5 flex min-w-0 items-center gap-2 lg:mb-0">
                      {P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)?.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)!.icon} alt={ad.crypto} className="h-5 w-5 shrink-0 rounded-full" />
                      ) : (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-black" style={{ backgroundColor: dotColor }}>
                          {ad.crypto.charAt(0)}
                        </div>
                      )}
                      <span className="text-[12px] font-black text-white">{ad.crypto}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                        ad.side === "SELL" ? "bg-red-500/12 text-red-400" : "bg-[#05b957]/12 text-[#05b957]"
                      }`}>{ad.side}</span>
                      <span className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                        ad.isActive ? "bg-[#05b957]/10 text-[#05b957]" : "bg-white/[0.05] text-slate-500"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ad.isActive ? "bg-[#05b957] animate-pulse" : "bg-slate-600"}`} />
                        {ad.isActive ? "Active" : "Paused"}
                      </span>
                    </div>

                    {/* Row 2: large price */}
                    <div className="mb-2.5 lg:mb-0">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold leading-3 text-white/45">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={flagUrl(ad.fiat)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                        {ad.fiat}
                      </p>
                      <p className="text-[16px] font-black leading-tight text-white tabular-nums lg:text-base">
                        {formatFiat(Number(ad.pricePerUnit), ad.fiat, { symbol: false, decimals: 2 })}
                      </p>
                    </div>

                    {/* Row 3: limits + quantity */}
                    <div className="space-y-0.5 text-[10px] font-semibold leading-4 text-white/40 lg:flex lg:flex-wrap lg:gap-x-4 lg:space-y-0">
                      <p>Limits <span className="text-white/65">{formatFiat(Number(ad.minLimit), ad.fiat, { symbol: false })} – {formatFiat(Number(ad.maxLimit), ad.fiat, { symbol: false })} {ad.fiat}</span></p>
                      <p>{ad.side === "SELL" ? "Quantity" : "Buying"} <span className="text-white/65">{Number(ad.availableAmount).toLocaleString("en-US", { maximumFractionDigits: 4 })} {ad.crypto}</span></p>
                    </div>

                    {/* Row 4: payment methods */}
                    <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2 gap-y-1 lg:mt-1">
                      {ad.paymentMethods.map((m) => (
                        <span key={m} className="flex items-center gap-1 text-[10px] font-semibold text-white/45">
                          <span className={`h-3 w-0.5 rounded-full ${m === "MPESA" ? "bg-[#05b957]" : "bg-[#f59e0b]"}`} />
                          {pmLabel(m)}
                        </span>
                      ))}
                    </div>

                    {/* Fill bar */}
                    <div className="mt-2 flex items-center gap-2 lg:mt-1">
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[#087cff] transition-all" style={{ width: `${fillPct}%` }} />
                      </div>
                      <span className="text-[10px] text-white/30">{fillPct.toFixed(0)}% filled</span>
                    </div>

                    {/* Validation error */}
                    {ad.validationError && (
                      <div className="mt-2 rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/[0.08] px-2 py-1.5 text-[10px] font-semibold text-[#f59e0b]">
                        {ad.validationError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-end">
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
  const { isSignedIn, user } = useSupabaseAuth();
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

  return (
    <>
      <P2PSubNav />
      <div className="mx-auto w-full max-w-6xl px-3 pt-2 sm:px-4 lg:px-3">
        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#18191f] px-4 py-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-blue-400">Liquidity operations</p>
            <h1 className="mt-0.5 text-lg font-black tracking-tight text-white">Merchant command</h1>
            <p className="text-[9px] text-slate-600">Manage ads, escrow balances, payment rails and settlement capacity.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[9px] font-black text-slate-500 sm:flex">
            <Icon name="shield" className="text-[13px] text-emerald-400" />
            LIVE RISK CHECKS
          </div>
        </div>
      </div>
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
