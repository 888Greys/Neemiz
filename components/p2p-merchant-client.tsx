"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { P2PSubNav } from "@/components/p2p-subnav";
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
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-[#087cff]/20 bg-gradient-to-br from-[#0d1a2e] via-[#0a1220] to-[#0d1420] p-6 text-center sm:p-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-[#087cff]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#087cff]/15 border border-[#087cff]/25 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#087cff]/10">
            <Icon name="storefront" className="text-[#087cff] text-3xl" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Become a Merchant</h1>
          <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            Post buy &amp; sell ads, set your own prices, and earn from every trade.
            Nezeem holds crypto in escrow — your funds are always safe.
          </p>
        </div>
      </div>

      {/* Benefits grid */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: "price_change",   label: "Your Prices",     desc: "Set your own spread and profit per trade" },
          { icon: "lock",           label: "Escrow Safe",     desc: "Crypto secured by Nezeem before any release" },
          { icon: "verified",       label: "Trust Badge",     desc: "Verified badge builds buyer confidence" },
          { icon: "payments",       label: "Local Payments",  desc: "M-Pesa and bank transfers supported" },
        ].map(({ icon, label, desc }) => (
          <div key={label} className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-4 hover:border-[#087cff]/20 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#087cff]/10 flex items-center justify-center mb-3">
              <Icon name={icon} className="text-[#087cff] text-sm" />
            </div>
            <p className="text-white font-black text-sm mb-1">{label}</p>
            <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mb-5 rounded-2xl border border-white/[0.06] bg-[#0a0f1a] p-5 sm:p-6">
        <h2 className="text-white font-black text-base mb-4">How it works</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          {[
            { step: "1", icon: "edit_note",     label: "Apply",         desc: "Fill in your display name and submit" },
            { step: "2", icon: "manage_search", label: "KYC Review",    desc: "We review your application in under 24h" },
            { step: "3", icon: "account_balance_wallet", label: "Deposit Crypto", desc: "Fund your escrow balance" },
            { step: "4", icon: "storefront",    label: "Post Ads",      desc: "Go live and start trading" },
          ].map(({ step, icon, label, desc }, i, arr) => (
            <div key={step} className="flex items-start gap-3 flex-1">
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
        <div className="bg-[#0a0f1a] border border-white/[0.07] rounded-2xl p-6">
          <h2 className="text-white font-black text-lg mb-1">Start your application</h2>
          <p className="text-slate-500 text-sm mb-5">Takes less than a minute. Reviewed within 24 hours.</p>

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
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
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
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
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
          <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-2xl p-5">
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
    APPROVED: "bg-[#31c45d]/10 text-[#31c45d] border-[#31c45d]/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-black ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Deposit Section ──────────────────────────────────────────────────────────

function DepositSection() {
  const [open, setOpen]         = useState(false);
  const [submitting, setSubmit] = useState(false);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm] = useState({ crypto: "USDT", amount: "", txHash: "", network: "TRC20" });
  const f = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try { const r = await fetch("/api/p2p/merchant/deposit"); if (r.ok) setDeposits(await r.json()); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!form.amount || !form.txHash) return toast.error("Amount and TX hash are required");
    setSubmit(true);
    try {
      const r = await fetch("/api/p2p/merchant/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crypto: form.crypto, amount: Number(form.amount), txHash: form.txHash.trim(), network: form.network }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success("Deposit submitted for review.");
      setOpen(false);
      setForm({ crypto: "USDT", amount: "", txHash: "", network: "TRC20" });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSubmit(false); }
  }

  return (
    <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-2xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div>
          <h2 className="text-white font-black text-base">Escrow Balance</h2>
          <p className="text-slate-500 text-xs mt-0.5">Deposit crypto to fund your sell ads</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#31c45d] text-white font-black text-sm hover:bg-[#28af52] transition-colors shadow-lg shadow-[#31c45d]/20"
        >
          <Icon name="add" className="text-base" />
          Deposit
        </button>
      </div>

      {/* Inline form */}
      {open && (
        <div className="p-5 bg-white/[0.02] border-b border-white/[0.06]">
          <p className="text-slate-400 text-sm mb-4">Submit your TX hash — admin will approve within 1 hour.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Crypto", type: "select", key: "crypto",  options: ["USDT","BTC","ETH"], value: form.crypto },
              { label: "Network", type: "select", key: "network", options: ["TRC20","ERC20","BEP20"], value: form.network },
            ].map(({ label, key, options, value }) => (
              <div key={key}>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{label}</label>
                <select
                  value={value}
                  onChange={(e) => f(key, e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                >
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Amount</label>
              <input type="number" value={form.amount} onChange={(e) => f("amount", e.target.value)} placeholder="0.00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-700 outline-none focus:border-[#31c45d]/40" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">TX Hash</label>
              <input type="text" value={form.txHash} onChange={(e) => f("txHash", e.target.value)} placeholder="0x…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-700 outline-none focus:border-[#31c45d]/40 font-mono text-xs" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 text-sm transition-colors">Cancel</button>
            <button onClick={submit} disabled={submitting || !form.amount || !form.txHash}
              className="flex-1 py-2.5 rounded-xl font-black text-white bg-[#31c45d] hover:bg-[#28af52] disabled:opacity-40 text-sm transition-all flex items-center justify-center gap-2">
              {submitting ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : "Submit Deposit"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[#31c45d] rounded-full animate-spin" />
        </div>
      ) : deposits.length === 0 ? (
        <div className="text-center py-10">
          <Icon name="account_balance_wallet" className="text-3xl text-slate-700 mb-2" />
          <p className="text-slate-500 text-sm">No deposits yet</p>
          <p className="text-slate-600 text-xs mt-1">Deposit crypto to start posting sell ads</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Date","Crypto","Amount","Network","TX Hash","Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deposits.map((d, i) => (
                <tr key={d.id} className={`${i < deposits.length - 1 ? "border-b border-white/[0.04]" : ""} hover:bg-white/[0.02] transition-colors`}>
                  <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</td>
                  <td className="px-5 py-3 text-white font-black text-xs">{d.crypto}</td>
                  <td className="px-5 py-3 text-white font-black">{Number(d.amount).toFixed(6)}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{d.network}</td>
                  <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                    <span title={d.txHash}>{d.txHash.length > 14 ? `${d.txHash.slice(0,7)}…${d.txHash.slice(-7)}` : d.txHash}</span>
                  </td>
                  <td className="px-5 py-3"><Badge status={d.status} /></td>
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

function CreateAdModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ side: "SELL", crypto: "USDT", pricePerUnit: "", totalAmount: "", minLimit: "", maxLimit: "", paymentMethods: [] as string[], paymentWindow: "15", terms: "" });
  const [submitting, setSubmitting] = useState(false);
  const f = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  function togglePm(m: string) {
    setForm((p) => ({ ...p, paymentMethods: p.paymentMethods.includes(m) ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m] }));
  }

  async function submit() {
    if (!form.pricePerUnit || !form.totalAmount || !form.minLimit || !form.maxLimit || !form.paymentMethods.length)
      return toast.error("Please fill all required fields");
    setSubmitting(true);
    try {
      const r = await fetch("/api/p2p/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: form.side, crypto: form.crypto, pricePerUnit: Number(form.pricePerUnit), totalAmount: Number(form.totalAmount), minLimit: Number(form.minLimit), maxLimit: Number(form.maxLimit), paymentMethods: form.paymentMethods, paymentWindow: Number(form.paymentWindow), terms: form.terms || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success("Ad created successfully!");
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#0d1420] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0d1420] flex items-center justify-between px-6 py-4 border-b border-white/[0.07] rounded-t-2xl">
          <h3 className="text-white font-black text-lg">Create New Ad</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block uppercase tracking-wide">I want to</label>
              <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1">
                {["BUY","SELL"].map((s) => (
                  <button key={s} onClick={() => f("side", s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${form.side === s ? "bg-[#087cff] text-white shadow shadow-[#087cff]/30" : "text-slate-500 hover:text-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block uppercase tracking-wide">Crypto</label>
              <select value={form.crypto} onChange={(e) => f("crypto", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none">
                {["USDT","BTC","ETH","BNB"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {[
            { label: `Price per ${form.crypto} (KES)`, key: "pricePerUnit", ph: "e.g. 135000" },
            { label: `Total ${form.crypto} to ${form.side === "SELL" ? "sell" : "buy"}`, key: "totalAmount", ph: "e.g. 0.5" },
          ].map(({ label, key, ph }) => (
            <div key={key}>
              <label className="text-xs font-black text-slate-500 mb-1.5 block uppercase tracking-wide">{label}</label>
              <input type="number" value={form[key as keyof typeof form] as string} onChange={(e) => f(key, e.target.value)} placeholder={ph}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder:text-slate-700 outline-none focus:border-[#087cff]/40 text-sm transition-colors" />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {[{ label: "Min order (KES)", key: "minLimit", ph: "500" }, { label: "Max order (KES)", key: "maxLimit", ph: "50000" }].map(({ label, key, ph }) => (
              <div key={key}>
                <label className="text-xs font-black text-slate-500 mb-1.5 block uppercase tracking-wide">{label}</label>
                <input type="number" value={form[key as keyof typeof form] as string} onChange={(e) => f(key, e.target.value)} placeholder={ph}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder:text-slate-700 outline-none focus:border-[#087cff]/40 text-sm transition-colors" />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 mb-2 block uppercase tracking-wide">Payment methods</label>
            <div className="flex gap-2">
              {[{ v: "MPESA", l: "M-Pesa" }, { v: "BANK", l: "Bank Transfer" }].map(({ v, l }) => (
                <button key={v} onClick={() => togglePm(v)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${form.paymentMethods.includes(v) ? "bg-[#087cff]/20 border-[#087cff] text-[#087cff]" : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block uppercase tracking-wide">Payment window</label>
            <select value={form.paymentWindow} onChange={(e) => f("paymentWindow", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm outline-none">
              {[10,15,20,30].map((w) => <option key={w} value={w}>{w} minutes</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block uppercase tracking-wide">Trade terms <span className="normal-case text-slate-600">(optional)</span></label>
            <textarea value={form.terms} onChange={(e) => f("terms", e.target.value)} placeholder="Any specific requirements for buyers…" rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-700 outline-none resize-none focus:border-[#087cff]/40 transition-colors" />
          </div>

          <button onClick={submit} disabled={submitting}
            className="w-full py-3.5 rounded-xl font-black text-white bg-[#087cff] hover:bg-[#0570e8] disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#087cff]/20">
            {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</> : <><Icon name="add" className="text-base" /> Create Ad</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Merchant Dashboard ───────────────────────────────────────────────────────

function MerchantDashboard({ status }: { status: MerchantStatus }) {
  const [ads, setAds]           = useState<Ad[]>([]);
  const [loading, setLoading]   = useState(true);
  const [createOpen, setCreate] = useState(false);

  const loadAds = useCallback(async () => {
    try { const r = await fetch("/api/p2p/ads/mine"); if (r.ok) setAds(await r.json()); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAds(); }, [loadAds]);

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      {createOpen && <CreateAdModal onClose={() => setCreate(false)} onCreated={loadAds} />}

      {/* Merchant header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#087cff] to-[#6366f1] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#087cff]/20">
            {status.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white">{status.displayName}</h1>
              <div className="flex items-center gap-1 bg-[#31c45d]/10 border border-[#31c45d]/20 rounded-full px-2 py-0.5">
                <Icon name="verified" className="text-[#31c45d] text-xs" />
                <span className="text-[#31c45d] text-[10px] font-black">Verified</span>
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
          className="flex items-center gap-2 sm:px-4 sm:py-2.5 p-2.5 rounded-xl bg-[#087cff] text-white font-black text-sm hover:bg-[#0570e8] transition-colors shadow-lg shadow-[#087cff]/20 shrink-0"
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
        const listedKES     = ads.reduce((s, a) => s + Number(a.availableAmount) * Number(a.pricePerUnit), 0);
        const cryptos       = ads.map((a) => a.crypto).filter((c, idx, arr) => arr.indexOf(c) === idx);
        return (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Active Ads */}
            <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-4 hover:border-[#087cff]/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-xs">Active Ads</p>
                <Icon name="campaign" className="text-[#087cff] text-sm opacity-60" />
              </div>
              <p className="font-black text-2xl text-[#087cff]">{activeAds.length}</p>
              <p className="text-slate-600 text-[11px] mt-1">{ads.length} total · {ads.length - activeAds.length} paused</p>
            </div>

            {/* Listed crypto */}
            <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-4 hover:border-[#31c45d]/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-xs">Listed Crypto</p>
                <Icon name="currency_bitcoin" className="text-[#31c45d] text-sm opacity-60" />
              </div>
              <p className="font-black text-2xl text-[#31c45d]">{totalAvail.toFixed(4)}</p>
              <p className="text-slate-600 text-[11px] mt-1">{totalListed.toFixed(4)} total · {cryptos.join(", ") || "—"}</p>
            </div>

            {/* KES value */}
            <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-4 hover:border-amber-500/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-xs">Est. KES Value</p>
                <Icon name="payments" className="text-amber-400 text-sm opacity-60" />
              </div>
              <p className="font-black text-2xl text-amber-400">
                {listedKES >= 1000 ? `${(listedKES/1000).toFixed(1)}K` : listedKES.toFixed(0)}
              </p>
              <p className="text-slate-600 text-[11px] mt-1">across active listings</p>
            </div>

            {/* Account */}
            <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-xl p-4 hover:border-[#31c45d]/20 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 text-xs">Account</p>
                <Icon name="shield" className="text-[#31c45d] text-sm opacity-60" />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon name="verified" className="text-[#31c45d] text-sm" />
                <p className="font-black text-sm text-[#31c45d]">Verified</p>
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
      <div className="bg-[#0a0f1a] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-black text-base">My Ads</h2>
            <p className="text-slate-500 text-xs mt-0.5">{ads.filter((a) => a.isActive).length} active · {ads.length} total</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-px">
            {[1,2].map((i) => <div key={i} className="h-16 bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : ads.length === 0 ? (
          <div className="flex min-h-[190px] flex-col items-center justify-center px-6 py-8 text-center">
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
          <div>
            {ads.map((ad, i) => {
              const pmLabel = (m: string) => m === "MPESA" ? "M-Pesa" : m === "BANK" ? "Bank" : m;
              const filled = Number(ad.totalAmount) - Number(ad.availableAmount);
              const fillPct = Number(ad.totalAmount) > 0 ? (filled / Number(ad.totalAmount)) * 100 : 0;
              return (
                <div key={ad.id} className={`px-5 py-4 hover:bg-white/[0.02] transition-colors ${i < ads.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                  {/* Row 1: side badge + crypto + price + status */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${
                        ad.side === "SELL" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-[#31c45d] bg-[#31c45d]/10 border-[#31c45d]/20"
                      }`}>{ad.side}</span>
                      <div className="min-w-0">
                        <span className="text-white font-bold text-sm">{ad.crypto}</span>
                        <span className="text-slate-500 text-xs ml-1.5">at</span>
                        <span className="text-[#087cff] font-black text-sm ml-1.5">{ad.pricePerUnit.toLocaleString("en-KE")} KES</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${ad.isActive ? "bg-[#31c45d] animate-pulse" : "bg-slate-600"}`} />
                      <span className={`text-[11px] font-bold ${ad.isActive ? "text-[#31c45d]" : "text-slate-500"}`}>{ad.isActive ? "Active" : "Paused"}</span>
                      <span className="text-slate-700 text-xs ml-1">· {new Date(ad.createdAt).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>

                  {/* Row 2: stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs mb-3">
                    <div>
                      <p className="text-slate-600 mb-0.5">Available</p>
                      <p className="text-slate-200 font-bold">{Number(ad.availableAmount).toFixed(4)} {ad.crypto}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 mb-0.5">Total listed</p>
                      <p className="text-slate-200 font-bold">{Number(ad.totalAmount).toFixed(4)} {ad.crypto}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 mb-0.5">Order limit</p>
                      <p className="text-slate-200 font-bold">KSh {ad.minLimit.toLocaleString()} – {ad.maxLimit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 mb-0.5">Pay window</p>
                      <p className="text-slate-200 font-bold">{ad.paymentWindow} min</p>
                    </div>
                  </div>

                  {/* Row 3: payment methods + fill bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ad.paymentMethods.map((m) => (
                        <span key={m} className="bg-[#087cff]/10 border border-[#087cff]/15 rounded-md px-2 py-0.5 text-[10px] font-bold text-[#4da3ff]">
                          {pmLabel(m)}
                        </span>
                      ))}
                    </div>
                    {/* Fill progress */}
                    <div className="shrink-0 text-right min-w-[80px]">
                      <p className="text-slate-600 text-[10px] mb-1">{fillPct.toFixed(0)}% filled</p>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden w-20">
                        <div className="h-full bg-[#087cff] rounded-full transition-all" style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
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
  const { isSignedIn } = useSupabaseAuth();
  const [status, setStatus] = useState<MerchantStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try { const r = await fetch("/api/p2p/merchant/apply"); setStatus(await r.json()); }
    catch { /* ignore */ } finally { setLoading(false); }
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
