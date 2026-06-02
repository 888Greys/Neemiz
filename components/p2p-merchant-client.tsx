"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { P2PSubNav } from "@/components/p2p-subnav";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { formatFiat, FIAT_CURRENCIES } from "@/lib/p2p/currencies";
import { paymentMethodsForFiat, paymentMethodLabel } from "@/lib/p2p/payment-methods";
import { LoadingDots } from "@/components/loading-dots";

// ─── Supported P2P cryptos ────────────────────────────────────────────────────

const P2P_CRYPTOS: Array<{ symbol: string; name: string; icon: string; color: string }> = [
  { symbol: "USDT", name: "Tether",       icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg", color: "#26a17b" },
  { symbol: "USDC", name: "USD Coin",     icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg", color: "#2775ca" },
  { symbol: "BTC",  name: "Bitcoin",      icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",  color: "#f7931a" },
  { symbol: "ETH",  name: "Ethereum",     icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",  color: "#627eea" },
  { symbol: "BNB",  name: "BNB",          icon: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",  color: "#f0b90b" },
];

const flagUrl = (currencyCode: string) =>
  `https://flagcdn.com/w40/${currencyCode.slice(0, 2).toLowerCase()}.png`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MerchantStatus {
  applied: boolean;
  id?: string;
  displayName?: string;
  isVerified?: boolean;
  kycStatus?: "PENDING" | "APPROVED" | "REJECTED";
  kycNote?: string | null;
  createdAt?: string;
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
      toast.success("Application submitted! We&apos;ll review within 24 hours.");
      onApplied();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
      {/* Hero */}
      <div className="relative mb-3 overflow-hidden rounded-lg border border-[#1e1e30] bg-[#111118] p-4 sm:p-5 lg:p-4">
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
          <div key={label} className="rounded-lg border border-white/[0.06] bg-[#111118] p-3 transition-colors hover:border-[#087cff]/20">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#087cff]/10">
              <Icon name={icon} className="text-[#087cff] text-sm" />
            </div>
            <p className="text-white font-black text-sm mb-1">{label}</p>
            <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mb-3 rounded-lg border border-white/[0.06] bg-[#111118] p-4">
        <h2 className="mb-3 text-base font-black text-white">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: "1", icon: "edit_note",     label: "Apply",         desc: "Fill in your display name and submit" },
            { step: "2", icon: "manage_search", label: "KYC Review",    desc: "We review your application in under 24h" },
            { step: "3", icon: "account_balance_wallet", label: "Receive Crypto",  desc: "Receive to your wallet, then fund escrow" },
            { step: "4", icon: "storefront",    label: "Post Ads",      desc: "Go live and start trading" },
          ].map(({ step, icon, label, desc }, i, arr) => (
            <div key={step} className="flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#087cff]/15 border border-[#087cff]/30 flex items-center justify-center text-[#087cff] font-black text-sm">
                  {step}
                </div>
                {i < arr.length - 1 && <div className="hidden sm:block w-px flex-1 bg-white/[0.06] mt-2 mb-2 min-h-[20px]" />}
              </div>
              <div className="pt-1 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon name={icon} className="text-[#087cff] text-sm" />
                  <p className="text-white font-bold text-sm">{label}</p>
                </div>
                <p className="text-slate-500 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Application form */}
      <div className="max-w-lg">
        <div className="rounded-lg border border-white/[0.07] bg-[#111118] p-4">
          <h2 className="mb-1 text-lg font-black text-white">Start your application</h2>
          <p className="mb-4 text-sm text-slate-500">Takes less than a minute. Reviewed within 24 hours.</p>

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
    <div className="w-full px-3 py-3 sm:px-4 lg:px-3 lg:py-2">
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
          <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5">
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

function DepositSection() {
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

  const load = useCallback(async () => {
    try {
      const [depRes, balRes, walletRes] = await Promise.all([
        fetch("/api/p2p/merchant/deposit"),
        fetch("/api/p2p/merchant/balance"),
        fetch("/api/crypto/balance"),
      ]);
      if (depRes.ok) setDeposits(await depRes.json());
      if (balRes.ok) setBalances(await balRes.json());
      if (walletRes.ok) setWalletBalances(await walletRes.json());
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
  const walletCryptos = walletBalances
    .map((b) => b.crypto)
    .filter((c, i, arr) => arr.indexOf(c) === i);
  // Networks available for the currently selected fund crypto
  const fundNetworks  = walletBalances
    .filter((b) => b.crypto === fundCrypto && b.available > 0)
    .map((b) => b.network);

  // Wallet balance for the currently selected fund crypto/network
  const fundWalletBal = walletBalances.find(
    (b) => b.crypto === fundCrypto && b.network === fundNetwork,
  )?.available ?? 0;

  // Escrow available for currently selected e2w crypto
  const e2wEscrowBal = Number(
    balances.find((b) => b.crypto === e2wCrypto)?.available ?? 0,
  );

  useEffect(() => { load(); }, [load]);

  // Auto-select first available wallet crypto/network when balances load
  useEffect(() => {
    if (walletBalances.length === 0) return;
    const match = walletBalances.find((b) => b.crypto === fundCrypto && b.available > 0);
    if (!match) {
      const first = walletBalances.find((b) => b.available > 0) ?? walletBalances[0];
      setFundCrypto(first.crypto);
      setFundNetwork(first.network);
    } else if (!walletBalances.find((b) => b.crypto === fundCrypto && b.network === fundNetwork)) {
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
    <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#111118]">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:py-2.5">
        <div className="min-w-0">
          <h2 className="text-white font-black text-base">Merchant Balances</h2>
          <p className="text-slate-500 text-xs mt-0.5">Deposits land in your wallet — move to escrow when ready to trade</p>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center">
          <button
            onClick={() => { setFundOpen((v) => !v); setE2wOpen(false); setOpen(false); }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#05b957] px-2 py-2 text-[11px] font-black text-white shadow-lg shadow-[#05b957]/20 transition-colors hover:bg-[#28af52] lg:h-9 lg:px-4 lg:text-sm"
          >
            <Icon name="arrow_upward" className="text-base" />
            <span className="whitespace-nowrap">Fund</span>
            <span className="hidden whitespace-nowrap lg:inline">Escrow</span>
          </button>
          <button
            onClick={() => { setE2wOpen((v) => !v); setFundOpen(false); setOpen(false); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-2 text-[11px] font-black text-slate-300 transition-colors hover:bg-white/[0.08] lg:h-9 lg:px-3 lg:text-sm"
          >
            <Icon name="arrow_downward" className="text-base" />
            <span className="whitespace-nowrap">Wallet</span>
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

      {/* Wallet + Escrow balance rows */}
      {(walletBalances.length > 0 || balances.length > 0) && (
        <div className="grid grid-cols-2 divide-x divide-white/[0.04] border-b border-white/[0.06] bg-white/[0.01]">
          {/* Wallet (UserCryptoBalance) */}
          <div className="flex flex-wrap gap-4 px-4 py-2.5">
            <p className="w-full text-[10px] font-black text-slate-600 uppercase tracking-wide mb-0.5">In Wallet</p>
            {walletBalances.length === 0 ? (
              <p className="text-slate-700 text-xs">—</p>
            ) : walletBalances.map((b) => (
              <div key={`${b.crypto}-${b.network}`}>
                <p className="text-[10px] text-slate-500 font-bold">{b.crypto} <span className="text-slate-700">({b.network})</span></p>
                <p className="text-white font-black text-sm">{Number(b.available).toFixed(6)}</p>
              </div>
            ))}
          </div>
          {/* Escrow (P2PCryptoBalance) */}
          <div className="flex flex-wrap gap-4 px-4 py-2.5">
            <p className="w-full text-[10px] font-black text-slate-600 uppercase tracking-wide mb-0.5">In Escrow</p>
            {balances.length === 0 ? (
              <p className="text-slate-700 text-xs">—</p>
            ) : balances.map((b) => (
              <div key={b.crypto} className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold">{b.crypto}</p>
                  <p className="text-white font-black text-sm">{Number(b.available).toFixed(6)}</p>
                </div>
                {Number(b.locked) > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-600 font-bold">Locked</p>
                    <p className="text-amber-400 font-black text-sm">{Number(b.locked).toFixed(6)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fund Escrow panel */}
      {fundOpen && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-400 mb-3">Move crypto from your wallet to merchant escrow so you can list sell ads.</p>
          {walletBalances.length === 0 ? (
            <p className="text-slate-600 text-sm">No wallet crypto balance to move. Receive crypto first.</p>
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
          {balances.length === 0 ? (
            <p className="text-slate-600 text-sm">No escrow balance to move.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_140px] sm:items-end">
              {/* Crypto selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Crypto</label>
                <div className="flex gap-1.5 flex-wrap">
                  {balances.map((b) => (
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

      {/* Deposit history table */}
      {loading ? (
        <div className="flex items-center justify-center py-5">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[#05b957] rounded-full animate-spin" />
        </div>
      ) : deposits.length === 0 ? (
        <div className="flex min-h-[78px] flex-col items-center justify-center px-4 py-3 text-center">
          <Icon name="account_balance_wallet" className="mb-2 text-2xl text-slate-700" />
          <p className="text-slate-500 text-sm">No deposits yet</p>
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

function CreateAdModal({ ad, onClose, onCreated }: { ad?: Ad | null; onClose: () => void; onCreated: () => void }) {
  const isEditing = !!ad;
  const [form, setForm] = useState({
    side: ad?.side ?? "SELL",
    crypto: ad?.crypto ?? "USDT",
    fiat: ad?.fiat ?? "KES",
    pricePerUnit: ad ? String(ad.pricePerUnit) : "",
    totalAmount: ad ? String(ad.totalAmount) : "",
    minLimit: ad ? String(ad.minLimit) : "",
    maxLimit: ad ? String(ad.maxLimit) : "",
    paymentMethods: ad?.paymentMethods ?? [] as string[],
    paymentWindow: ad ? String(ad.paymentWindow) : "15",
    terms: ad?.terms ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [spotRate, setSpotRate] = useState<number | null>(null);
  const f = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  // Live market rate for the chosen crypto+fiat (for the margin readout).
  useEffect(() => {
    let cancelled = false;
    setSpotRate(null);
    fetch(`/api/p2p/spot?crypto=${form.crypto}&fiat=${form.fiat}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: { rate?: number | null } | null) => {
        if (!cancelled && typeof d?.rate === "number" && d.rate > 0) setSpotRate(d.rate);
      })
      .catch(() => { /* no live rate */ });
    return () => { cancelled = true; };
  }, [form.crypto, form.fiat]);

  const priceNum = Number(form.pricePerUnit) || 0;
  const marginPct = spotRate && priceNum > 0 ? ((priceNum / spotRate) - 1) * 100 : null;

  function togglePm(m: string) {
    setForm((p) => ({ ...p, paymentMethods: p.paymentMethods.includes(m) ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m] }));
  }

  async function submit() {
    if (
      !form.pricePerUnit ||
      !form.totalAmount ||
      !form.paymentMethods.length ||
      (form.side === "SELL" && (!form.minLimit || !form.maxLimit))
    )
      return toast.error("Please fill all required fields");

    const totalFiatValue = Number(form.totalAmount) * Number(form.pricePerUnit);
    const minLimit = form.side === "SELL" ? Number(form.minLimit) : totalFiatValue;
    const maxLimit = form.side === "SELL" ? Number(form.maxLimit) : totalFiatValue;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
      <div className="no-scrollbar w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0e0e14] shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-white/[0.07] bg-[#0e0e14] px-6 py-3">
          <h3 className="text-white font-black text-lg">{isEditing ? "Edit Ad" : "Create New Ad"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <div className="space-y-2.5 p-4">
          {/* Side selector */}
          <div>
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">I want to</label>
            <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
              {["BUY","SELL"].map((s) => (
                <button key={s} onClick={() => !isEditing && f("side", s)}
                  disabled={isEditing}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition-all ${form.side === s ? "bg-[#087cff] text-white shadow shadow-[#087cff]/30" : "text-slate-500 hover:text-white"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Crypto dropdown */}
          <div>
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">Crypto</label>
            <div className="relative">
              <button
                type="button"
                disabled={isEditing}
                onClick={() => !isEditing && setCryptoOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-[#1a1b22] px-3 py-2 text-sm font-bold text-white transition-colors hover:border-white/20 disabled:opacity-60"
              >
                {(() => { const m = P2P_CRYPTOS.find((c) => c.symbol === form.crypto); return m ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.icon} alt={m.symbol} className="h-5 w-5 rounded-full" />
                    <span className="font-black">{m.symbol}</span>
                    <span className="font-semibold text-slate-500">— {m.name}</span>
                  </>
                ) : <span>{form.crypto}</span>; })()}
                {!isEditing && <Icon name="expand_more" className={`ml-auto text-lg text-slate-400 transition-transform ${cryptoOpen ? "rotate-180" : ""}`} />}
              </button>
              {cryptoOpen && !isEditing && (
                <>
                  <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setCryptoOpen(false)} />
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#16171d] p-1 shadow-2xl shadow-black/60">
                    {P2P_CRYPTOS.map((c) => (
                      <button
                        key={c.symbol}
                        type="button"
                        onClick={() => { f("crypto", c.symbol); setCryptoOpen(false); }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${form.crypto === c.symbol ? "bg-[#087cff]/15" : "hover:bg-white/[0.06]"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.icon} alt={c.symbol} className="h-5 w-5 rounded-full" />
                        <span className="text-sm font-black text-white">{c.symbol}</span>
                        <span className="truncate text-xs font-semibold text-slate-500">{c.name}</span>
                        {form.crypto === c.symbol && <Icon name="check" className="ml-auto shrink-0 text-[16px] text-[#087cff]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fiat currency selector */}
          <div>
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">Fiat currency</label>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flagUrl(form.fiat)} alt="" className="pointer-events-none absolute left-3 top-1/2 h-4 w-6 -translate-y-1/2 rounded-sm object-cover" />
              <select value={form.fiat} onChange={(e) => {
                  const nextFiat = e.target.value;
                  const allowed = new Set(paymentMethodsForFiat(nextFiat).map((m) => m.value));
                  setForm((p) => ({ ...p, fiat: nextFiat, paymentMethods: p.paymentMethods.filter((m) => allowed.has(m)) }));
                }}
                className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#1a1b22] py-2 pl-12 pr-3 text-sm font-bold text-white outline-none transition-colors focus:border-[#087cff]/40">
                {FIAT_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} style={{ background: "#1a1b22", color: "#fff" }}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {[
            { label: `Price per ${form.crypto} (${form.fiat})`, key: "pricePerUnit", ph: form.crypto === "BTC" ? "e.g. 14000000" : form.crypto === "ETH" ? "e.g. 420000" : "e.g. 135" },
            ...(!isEditing ? [{ label: `Total ${form.crypto} to ${form.side === "SELL" ? "sell" : "buy"}`, key: "totalAmount", ph: form.crypto === "BTC" ? "e.g. 0.001" : form.crypto === "ETH" ? "e.g. 0.01" : "e.g. 10" }] : []),
          ].map(({ label, key, ph }) => (
            <div key={key}>
              <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">{label}</label>
              <input type="number" value={form[key as keyof typeof form] as string} onChange={(e) => f(key, e.target.value)} placeholder={ph}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-sm text-white placeholder:text-slate-700 outline-none transition-colors focus:border-[#087cff]/40" />
              {key === "pricePerUnit" && form.pricePerUnit && marginPct !== null && (
                <p className="mt-1 text-[11px] font-bold">
                  <span className={marginPct > 0.01 ? "text-amber-400" : marginPct < -0.01 ? "text-[#05b957]" : "text-slate-400"}>
                    {marginPct > 0 ? "+" : ""}{marginPct.toFixed(2)}%
                  </span>
                  <span className="text-slate-500"> vs live market · {formatFiat(spotRate!, form.fiat)}/{form.crypto}</span>
                </p>
              )}
              {key === "pricePerUnit" && form.pricePerUnit && marginPct === null && (
                <p className="mt-1 text-[11px] font-semibold text-slate-600">Live market rate unavailable for {form.crypto}/{form.fiat}</p>
              )}
            </div>
          ))}

          {form.side === "SELL" && (
            <div className="grid grid-cols-2 gap-3">
              {[{ label: `Min order (${form.fiat})`, key: "minLimit", ph: "500" }, { label: `Max order (${form.fiat})`, key: "maxLimit", ph: "50000" }].map(({ label, key, ph }) => (
                <div key={key}>
                  <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">{label}</label>
                  <input type="number" value={form[key as keyof typeof form] as string} onChange={(e) => f(key, e.target.value)} placeholder={ph}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-sm text-white placeholder:text-slate-700 outline-none transition-colors focus:border-[#087cff]/40" />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">Payment methods</label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethodsForFiat(form.fiat).map(({ value, label }) => (
                <button key={value} type="button" onClick={() => togglePm(value)}
                  className={`rounded-xl border py-2 text-xs font-bold transition-all ${form.paymentMethods.includes(value) ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">Payment window</label>
            <select value={form.paymentWindow} onChange={(e) => f("paymentWindow", e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/[0.08] bg-[#1a1b22] px-3 py-2 text-sm text-white outline-none">
              {[10,15,20,30].map((w) => <option key={w} value={w} style={{ background: "#1a1b22", color: "#fff" }}>{w} minutes</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 mb-1 block uppercase tracking-wide">Trade terms <span className="normal-case text-slate-600">(optional)</span></label>
            <textarea value={form.terms} onChange={(e) => f("terms", e.target.value)} placeholder="Any specific requirements for buyers…" rows={2}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-slate-700 outline-none transition-colors focus:border-[#087cff]/40" />
          </div>

          <button onClick={submit} disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087cff] py-3 font-black text-white shadow-lg shadow-[#087cff]/20 transition-all hover:bg-[#0570e8] active:scale-[0.98] disabled:opacity-50">
            {submitting
              ? <LoadingDots label={isEditing ? "Saving" : "Creating"} />
              : <><Icon name={isEditing ? "edit" : "add"} className="text-base" /> {isEditing ? "Save Changes" : "Create Ad"}</>}
          </button>
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
  const [createOpen, setCreate] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
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
      const ext  = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (updErr) throw updErr;

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
    try {
      const r = await fetch("/api/p2p/ads/mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ad.id, isActive: !ad.isActive }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success(!ad.isActive ? "Ad reactivated" : "Ad paused");
      loadAds();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
      {createOpen && <CreateAdModal onClose={() => setCreate(false)} onCreated={loadAds} />}
      {editingAd && <CreateAdModal ad={editingAd} onClose={() => setEditingAd(null)} onCreated={loadAds} />}

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
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={status.displayName ?? "avatar"}
                className="h-full w-full rounded-xl object-cover shadow-lg shadow-black/30 lg:rounded-lg"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#087cff] to-[#6366f1] text-xl font-black text-white shadow-lg shadow-[#087cff]/20 lg:rounded-lg lg:text-lg">
                {status.displayName?.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Hover / uploading overlay */}
            <div className={`absolute inset-0 flex items-center justify-center rounded-xl bg-black/55 transition-opacity lg:rounded-lg ${avatarUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <Icon name={avatarUploading ? "progress_activity" : "photo_camera"} className={`text-[18px] text-white ${avatarUploading ? "animate-spin" : ""}`} />
            </div>
          </label>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-white">{status.displayName}</h1>
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

      {/* Stats row */}
      {(() => {
        const activeAds     = ads.filter((a) => a.isActive);
        const totalListed   = ads.reduce((s, a) => s + Number(a.totalAmount), 0);
        const totalAvail    = ads.reduce((s, a) => s + Number(a.availableAmount), 0);
        // Convert each ad's value (priced in its own fiat) into KES before summing.
        const listedKES     = ads.reduce((s, a) => {
          const valueInFiat = Number(a.availableAmount) * Number(a.pricePerUnit);
          const rate = fx.toKES[a.fiat] ?? 1;
          return s + valueInFiat * rate;
        }, 0);
        const cryptos       = ads.map((a) => a.crypto).filter((c, idx, arr) => arr.indexOf(c) === idx);
        return (
          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {/* Active Ads */}
            <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-3 transition-colors hover:border-[#087cff]/20">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-500 text-xs">Active Ads</p>
                <Icon name="campaign" className="text-[#087cff] text-sm opacity-60" />
              </div>
              <p className="text-lg font-black text-[#087cff]">{activeAds.length}</p>
              <p className="text-slate-600 text-[11px] mt-1">{ads.length} total · {ads.length - activeAds.length} paused</p>
            </div>

            {/* Listed crypto */}
            <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-3 transition-colors hover:border-[#05b957]/20">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-slate-500 text-xs">Listed Crypto</p>
                <Icon name="currency_bitcoin" className="text-[#05b957] text-sm opacity-60" />
              </div>
              <p className="text-lg font-black text-[#05b957]">{totalAvail.toFixed(4)}</p>
              <p className="text-slate-600 text-[11px] mt-1">{totalListed.toFixed(4)} total · {cryptos.join(", ") || "—"}</p>
            </div>

            {/* KES value */}
            <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-3 transition-colors hover:border-amber-500/20">
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
            <div className="rounded-lg border border-white/[0.06] bg-[#111118] p-3 transition-colors hover:border-[#05b957]/20">
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
        );
      })()}

      {/* Deposits */}
      <DepositSection />

      {/* Ads list */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <div>
            <h2 className="text-white font-black text-base">My Ads</h2>
            <p className="text-slate-500 text-xs mt-0.5">{ads.filter((a) => a.isActive).length} active · {ads.length} total</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : ads.length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl ring-1 ring-white/[0.07] bg-[#16171d] px-6 py-5 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <Icon name="post_add" className="text-xl text-slate-500" />
            </div>
            <p className="mb-1 text-base font-black text-white">No ads yet</p>
            <p className="mb-4 max-w-sm text-sm leading-6 text-slate-500">Create your first ad to start trading.</p>
            <button onClick={() => setCreate(true)} className="px-5 py-2.5 rounded-xl bg-[#087cff] text-white font-black text-sm hover:bg-[#0570e8] transition-colors">
              Create First Ad
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {ads.map((ad) => {
              const pmLabel = (m: string) => paymentMethodLabel(m);
              const filled = Number(ad.totalAmount) - Number(ad.availableAmount);
              const fillPct = Number(ad.totalAmount) > 0 ? (filled / Number(ad.totalAmount)) * 100 : 0;
              const dotColor = P2P_CRYPTOS.find((c) => c.symbol === ad.crypto)?.color ?? "#087cff";
              return (
                <div key={ad.id} className="grid w-full grid-cols-[minmax(0,1fr)_90px] gap-3 rounded-lg bg-[#16171d] px-3 py-2.5 ring-1 ring-white/[0.07] transition hover:bg-[#1a1b22] hover:ring-white/[0.14] sm:px-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-center lg:gap-4">
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
                      {ad.side === "SELL" && (
                        <p>Limits <span className="text-white/65">{formatFiat(Number(ad.minLimit), ad.fiat, { symbol: false })} – {formatFiat(Number(ad.maxLimit), ad.fiat, { symbol: false })} {ad.fiat}</span></p>
                      )}
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

                  {/* Right: action buttons */}
                  <div className="flex flex-col items-stretch justify-center gap-2">
                    <button
                      onClick={() => setEditingAd(ad)}
                      className="grid h-8 place-items-center rounded-lg bg-[#087cff]/15 text-[11px] font-black text-[#4da3ff] transition hover:bg-[#087cff]/25"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(ad)}
                      className={`grid h-8 place-items-center rounded-lg text-[11px] font-black transition ${
                        ad.isActive
                          ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                          : "bg-[#05b957]/10 text-[#05b957] hover:bg-[#05b957]/20"
                      }`}
                    >
                      {ad.isActive ? "Pause" : "Resume"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
