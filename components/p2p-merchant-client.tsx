"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

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
  isActive: boolean;
  createdAt: string;
}

// ─── Apply Card ───────────────────────────────────────────────────────────────

function ApplyCard({ onApplied }: { onApplied: () => void }) {
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
      toast.success("Application submitted! We'll review within 24h.");
      onApplied();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#087cff]/10 flex items-center justify-center">
            <Icon name="storefront" className="text-[#087cff] text-2xl" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg">Become a Merchant</h2>
            <p className="text-slate-500 text-sm">Post ads and trade with users</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-2 mb-6">
          {[
            { icon: "swap_horiz", text: "Post buy & sell ads with your own prices" },
            { icon: "lock",       text: "Crypto held in Nezeem escrow — zero risk" },
            { icon: "verified",   text: "Verified badge builds trust with traders" },
            { icon: "payments",   text: "Accept M-Pesa and bank transfers" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-slate-400">
              <Icon name={icon} className="text-[#087cff] text-base shrink-0" />
              {text}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Display name (shown to traders)</label>
            <input
              autoFocus
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. CryptoKing_KE"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40 transition-colors"
            />
          </div>
          <button
            onClick={submit}
            disabled={!displayName.trim() || submitting}
            className="w-full py-3.5 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</span>
              : "Apply for Merchant Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Review Card ──────────────────────────────────────────────────────

function PendingCard({ status }: { status: MerchantStatus }) {
  const isRejected = status.kycStatus === "REJECTED";
  return (
    <div className="max-w-lg mx-auto">
      <div className={`rounded-2xl border p-6 text-center ${
        isRejected
          ? "bg-red-500/5 border-red-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}>
        <Icon
          name={isRejected ? "cancel" : "pending"}
          className={`text-5xl mb-4 ${isRejected ? "text-red-400" : "text-amber-400"}`}
        />
        <h2 className="text-white font-black text-xl mb-2">
          {isRejected ? "Application Rejected" : "Application Under Review"}
        </h2>
        <p className="text-slate-400 text-sm mb-1">
          {isRejected
            ? "Your merchant application was not approved."
            : "We're reviewing your application. This usually takes less than 24 hours."}
        </p>
        {status.kycNote && (
          <p className="text-slate-500 text-xs mt-3 bg-white/5 rounded-xl px-4 py-3">
            Note: {status.kycNote}
          </p>
        )}
        <p className="text-slate-600 text-xs mt-4">
          Applied: {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Deposit Status Badge ─────────────────────────────────────────────────────

function DepositStatusBadge({ status }: { status: Deposit["status"] }) {
  const map: Record<Deposit["status"], string> = {
    PENDING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-[#31c45d]/10 text-[#31c45d] border-[#31c45d]/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Deposit Crypto Section ───────────────────────────────────────────────────

function DepositCryptoSection() {
  const [open, setOpen]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deposits, setDeposits]   = useState<Deposit[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);
  const [form, setForm] = useState({
    crypto: "USDT",
    amount: "",
    txHash: "",
    network: "TRC20",
  });

  const fetchDeposits = useCallback(async () => {
    try {
      const res = await fetch("/api/p2p/merchant/deposit");
      if (res.ok) setDeposits(await res.json());
    } catch { /* ignore */ } finally {
      setLoadingDeposits(false);
    }
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  async function submit() {
    if (!form.amount || !form.txHash) return toast.error("Amount and TX hash are required");
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/merchant/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crypto:  form.crypto,
          amount:  Number(form.amount),
          txHash:  form.txHash.trim(),
          network: form.network,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Deposit submitted! Admin will review shortly.");
      setOpen(false);
      setForm({ crypto: "USDT", amount: "", txHash: "", network: "TRC20" });
      fetchDeposits();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-black text-lg">Deposit Crypto</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#31c45d] text-white font-black text-sm hover:bg-[#28af52] transition-colors"
        >
          <Icon name="add" className="text-base" />
          Deposit Crypto
        </button>
      </div>

      {/* Inline form */}
      {open && (
        <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl p-5 mb-4">
          <p className="text-slate-400 text-sm mb-4">
            Deposit your crypto and submit the TX hash. Admin will credit your balance within 1 hour.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Crypto */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Crypto</label>
              <select
                value={form.crypto}
                onChange={(e) => setForm((f) => ({ ...f, crypto: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              >
                {["USDT", "BTC", "ETH"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Network */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Network</label>
              <select
                value={form.network}
                onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
              >
                {["TRC20", "ERC20", "BEP20"].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Amount</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 100"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 outline-none focus:border-[#31c45d]/40"
              />
            </div>

            {/* TX Hash */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">TX Hash</label>
              <input
                type="text"
                value={form.txHash}
                onChange={(e) => setForm((f) => ({ ...f, txHash: e.target.value }))}
                placeholder="0x..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 outline-none focus:border-[#31c45d]/40 font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 py-2.5 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || !form.amount || !form.txHash}
              className="flex-1 py-2.5 rounded-xl font-black text-white bg-[#31c45d] hover:bg-[#28af52] disabled:opacity-40 transition-all"
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</span>
                : "Submit Deposit"}
            </button>
          </div>
        </div>
      )}

      {/* Deposits table */}
      <div className="bg-[#0f1623] border border-white/[0.06] rounded-2xl overflow-hidden">
        {loadingDeposits ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#31c45d] rounded-full animate-spin" />
          </div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-10">
            <Icon name="south_america" className="text-3xl text-slate-700 mb-2" />
            <p className="text-slate-500 text-sm">No deposits yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "Crypto", "Amount", "Network", "TX Hash", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <tr key={d.id} className={`${i < deposits.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-white font-bold">{d.crypto}</td>
                    <td className="px-4 py-3 text-white font-black">{Number(d.amount).toFixed(6)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{d.network}</td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                      <span title={d.txHash}>{d.txHash.length > 14 ? `${d.txHash.slice(0, 7)}…${d.txHash.slice(-7)}` : d.txHash}</span>
                    </td>
                    <td className="px-4 py-3">
                      <DepositStatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Ad Form ───────────────────────────────────────────────────────────

function CreateAdForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    side: "SELL",
    crypto: "USDT",
    pricePerUnit: "",
    totalAmount: "",
    minLimit: "",
    maxLimit: "",
    paymentMethods: [] as string[],
    paymentWindow: "15",
    terms: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function toggle(method: string) {
    setForm((f) => ({
      ...f,
      paymentMethods: f.paymentMethods.includes(method)
        ? f.paymentMethods.filter((m) => m !== method)
        : [...f.paymentMethods, method],
    }));
  }

  async function submit() {
    if (!form.pricePerUnit || !form.totalAmount || !form.minLimit || !form.maxLimit || !form.paymentMethods.length) {
      return toast.error("Please fill all required fields");
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/p2p/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: form.side,
          crypto: form.crypto,
          pricePerUnit: Number(form.pricePerUnit),
          totalAmount: Number(form.totalAmount),
          minLimit: Number(form.minLimit),
          maxLimit: Number(form.maxLimit),
          paymentMethods: form.paymentMethods,
          paymentWindow: Number(form.paymentWindow),
          terms: form.terms || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Ad created!");
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#087cff] text-white font-black text-sm hover:bg-[#0570e8] transition-colors"
      >
        <Icon name="add" className="text-base" />
        Create Ad
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg">Create Ad</h3>
          <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Side + Crypto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">I want to</label>
              <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                {["BUY", "SELL"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm((f) => ({ ...f, side: s }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                      form.side === s ? "bg-[#087cff] text-white" : "text-slate-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Crypto</label>
              <select
                value={form.crypto}
                onChange={(e) => setForm((f) => ({ ...f, crypto: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
              >
                {["USDT", "BTC", "ETH", "BNB"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Price per {form.crypto} (KES)</label>
            <input
              type="number"
              value={form.pricePerUnit}
              onChange={(e) => setForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
              placeholder="e.g. 135000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40"
            />
          </div>

          {/* Total amount */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Total {form.crypto} to {form.side === "SELL" ? "sell" : "buy"}</label>
            <input
              type="number"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              placeholder="e.g. 0.5"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40"
            />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Min order (KES)</label>
              <input
                type="number"
                value={form.minLimit}
                onChange={(e) => setForm((f) => ({ ...f, minLimit: e.target.value }))}
                placeholder="500"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Max order (KES)</label>
              <input
                type="number"
                value={form.maxLimit}
                onChange={(e) => setForm((f) => ({ ...f, maxLimit: e.target.value }))}
                placeholder="50000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 outline-none focus:border-[#087cff]/40"
              />
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Payment methods</label>
            <div className="flex gap-2">
              {[{ v: "MPESA", l: "M-Pesa" }, { v: "BANK", l: "Bank Transfer" }].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => toggle(v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    form.paymentMethods.includes(v)
                      ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]"
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Payment window */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Payment window (minutes)</label>
            <select
              value={form.paymentWindow}
              onChange={(e) => setForm((f) => ({ ...f, paymentWindow: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
            >
              {[10, 15, 20, 30].map((w) => <option key={w} value={w}>{w} minutes</option>)}
            </select>
          </div>

          {/* Terms */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Trade terms (optional)</label>
            <textarea
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              placeholder="Any specific requirements for buyers…"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none resize-none focus:border-[#087cff]/40"
            />
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-50 transition-all"
          >
            {submitting ? "Creating…" : "Create Ad"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Merchant Dashboard ───────────────────────────────────────────────────────

function MerchantDashboard({ status }: { status: MerchantStatus }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch("/api/p2p/ads/mine");
      if (res.ok) setAds(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Status", value: status.kycStatus === "APPROVED" ? "Verified" : status.kycStatus ?? "—", color: "text-[#31c45d]" },
          { label: "Display Name", value: status.displayName ?? "—", color: "text-white" },
          { label: "Active Ads", value: ads.filter((a) => a.isActive).length, color: "text-[#087cff]" },
          { label: "Total Ads", value: ads.length, color: "text-white" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0f1623] border border-white/[0.06] rounded-xl p-4">
            <p className="text-slate-600 text-xs mb-1">{label}</p>
            <p className={`font-black text-sm ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Deposit Crypto section */}
      <DepositCryptoSection />

      {/* Ads section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-black text-lg">My Ads</h2>
        <CreateAdForm onCreated={fetchAds} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-16 bg-[#0f1623] border border-white/[0.06] rounded-2xl">
          <Icon name="post_add" className="text-4xl text-slate-700 mb-3" />
          <p className="text-slate-400 font-bold mb-1">No ads yet</p>
          <p className="text-slate-600 text-sm">Create your first buy or sell ad to start trading.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-[#0f1623] border border-white/[0.06] rounded-xl px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                    ad.side === "SELL"
                      ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : "text-[#31c45d] bg-[#31c45d]/10 border-[#31c45d]/20"
                  }`}>
                    {ad.side}
                  </span>
                  <div>
                    <p className="text-white font-bold text-sm">{ad.crypto} · {ad.pricePerUnit.toLocaleString("en-KE")} KES</p>
                    <p className="text-slate-500 text-xs">
                      {ad.availableAmount.toFixed(4)} / {Number(ad.totalAmount).toFixed(4)} {ad.crypto} · KSh {ad.minLimit.toLocaleString()}–{ad.maxLimit.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${ad.isActive ? "bg-[#31c45d]" : "bg-slate-600"}`} />
                  <span className="text-slate-500 text-xs">{ad.isActive ? "Active" : "Paused"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function P2PMerchantClient() {
  const { isSignedIn } = useSupabaseAuth();
  const [status, setStatus] = useState<MerchantStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/p2p/merchant/apply");
      setStatus(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) checkStatus();
    else setLoading(false);
  }, [isSignedIn, checkStatus]);

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <Icon name="lock" className="text-5xl text-slate-700 mb-4" />
        <p className="text-white font-black text-xl mb-2">Sign in required</p>
        <p className="text-slate-500 text-sm">Please sign in to access the merchant dashboard.</p>
      </div>
    );
  }

  if (loading || !status) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#087cff] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white mb-1">Merchant Center</h1>
        <p className="text-slate-500 text-sm">Manage your ads and track your trading activity.</p>
      </div>

      {!status.applied && <ApplyCard onApplied={checkStatus} />}
      {status.applied && status.kycStatus !== "APPROVED" && <PendingCard status={status} />}
      {status.applied && status.kycStatus === "APPROVED" && <MerchantDashboard status={status} />}
    </div>
  );
}
