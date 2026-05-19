"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

const QUICK_AMOUNTS = [100, 250, 500, 1_000, 2_500, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS     = 30;

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254"))  return s;
  if (s.startsWith("0") && s.length === 10) return `254${s.slice(1)}`;
  return s;
}

const TXN_META: Record<string, { label: string; icon: string; color: string; sign: "+" | "-" }> = {
  DEPOSIT:    { label: "Deposit",    icon: "add_circle",    color: "text-emerald-400", sign: "+" },
  WITHDRAWAL: { label: "Withdrawal", icon: "remove_circle", color: "text-red-400",     sign: "-" },
  BET_STAKE:  { label: "Bet Placed", icon: "sports_soccer", color: "text-red-400",     sign: "-" },
  BET_WIN:    { label: "Bet Win",    icon: "emoji_events",  color: "text-emerald-400", sign: "+" },
  BONUS:      { label: "Bonus",      icon: "redeem",        color: "text-amber-400",   sign: "+" },
  REFUND:     { label: "Refund",     icon: "undo",          color: "text-sky-400",     sign: "+" },
};

type Props = { onClose: () => void };

export function WalletModal({ onClose }: Props) {
  const { isSignedIn } = useAuth();
  const { user }       = useUser();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();

  const [tab, setTab]         = useState<"deposit" | "withdraw" | "history">("deposit");
  const [amount, setAmount]   = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [deposit, setDeposit] = useState<DepositState>({ step: "idle" });

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (user?.phoneNumbers?.[0]?.phoneNumber && !phone) {
      setPhone(user.phoneNumbers[0].phoneNumber.replace("+", ""));
    }
  }, [user, phone]);

  useEffect(() => {
    if (deposit.step !== "pending") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const txId = deposit.txId;
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(pollRef.current!);
        setDeposit({ step: "failed", message: "Payment timed out. If you paid, it will be credited shortly." });
        return;
      }
      try {
        const res  = await fetch("/api/wallet/deposit/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionRequestId: txId }) });
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          refreshBalance();
          setDeposit({ step: "confirmed", amount: deposit.amount, newBalance: data.newBalance, receipt: data.receipt ?? "" });
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setDeposit({ step: "failed", message: data.message ?? "Payment failed." });
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [deposit, refreshBalance]);

  async function handleDeposit() {
    if (!isSignedIn) return;
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/wallet/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountKes: Number(amount), phoneNumber: normalizeMsisdn(phone) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate payment.");
      setDeposit({ step: "pending", txId: data.transactionRequestId, amount: Number(amount) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setDeposit({ step: "idle" }); setAmount(""); setError(""); pollCount.current = 0; }

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-[#111316] shadow-2xl ring-1 ring-white/[0.08] sm:max-w-sm sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/10 sm:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-lg font-black text-white">Balance</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Balance hero */}
        <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-[#051b35] to-[#16171d] px-4 py-4 ring-1 ring-[#087cff]/20">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Account · {currency === "KES" ? "Kenyan Shilling" : currency}
          </p>
          <p className="mt-0.5 text-4xl font-black text-white">{fmtBalance}</p>
        </div>

        {/* Tabs */}
        <div className="mx-4 mb-3 flex gap-1 rounded-xl bg-[#18191f] p-1">
          {(["deposit", "withdraw", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-black uppercase tracking-wide transition ${
                tab === t ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon
                name={t === "deposit" ? "add_circle" : t === "withdraw" ? "remove_circle" : "history"}
                fill={tab === t}
                className="text-[13px]"
              />
              {t === "history" ? "History" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6">

          {/* ── DEPOSIT ── */}
          {tab === "deposit" && (
            <>
              {deposit.step === "confirmed" ? (
                <div className="rounded-2xl bg-[#16171d] p-6 ring-1 ring-emerald-500/25 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12">
                    <Icon name="check_circle" fill className="text-[38px] text-emerald-400" />
                  </div>
                  <p className="text-lg font-black text-white">Payment Received!</p>
                  <p className="mt-1 text-sm text-slate-400">
                    <span className="text-emerald-400 font-bold">KSh {deposit.amount.toLocaleString()}</span> added
                  </p>
                  <p className="mt-3 text-2xl font-black text-white">
                    KSh {deposit.newBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-600">new balance</p>
                  {deposit.receipt && <p className="mt-2 text-xs text-slate-500">Ref: <span className="font-bold text-slate-300">{deposit.receipt}</span></p>}
                  <button type="button" onClick={reset} className="mt-5 w-full rounded-xl bg-[#087cff] py-3 text-sm font-black text-white transition hover:bg-[#2a90ff]">Deposit More</button>
                </div>
              ) : deposit.step === "failed" ? (
                <div className="rounded-2xl bg-[#16171d] p-6 ring-1 ring-red-500/25 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/12">
                    <Icon name="cancel" fill className="text-[38px] text-red-400" />
                  </div>
                  <p className="text-lg font-black text-white">Payment Failed</p>
                  <p className="mt-1 text-sm text-slate-400">{deposit.message}</p>
                  <button type="button" onClick={reset} className="mt-5 w-full rounded-xl bg-white/[0.07] py-3 text-sm font-black text-white ring-1 ring-white/[0.10] transition hover:bg-white/[0.11]">Try Again</button>
                </div>
              ) : deposit.step === "pending" ? (
                <div className="rounded-2xl bg-[#16171d] p-6 ring-1 ring-[#087cff]/25 text-center">
                  <div className="relative mx-auto mb-4 h-16 w-16">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#087cff]/60" />
                    <div className="flex h-full items-center justify-center rounded-full bg-[#087cff]/10">
                      <Icon name="phone_iphone" fill className="text-[26px] text-[#087cff]" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-white">Check Your Phone</p>
                  <p className="mt-1 text-sm text-slate-400">Enter your M-Pesa PIN to complete</p>
                  <p className="mt-3 text-3xl font-black text-white">KSh {deposit.amount.toLocaleString()}</p>
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-400/8 px-4 py-2.5 text-xs font-bold text-amber-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Checking payment status…
                  </div>
                  <button type="button" onClick={reset} className="mt-3 text-xs text-slate-600 transition hover:text-slate-400">Cancel</button>
                </div>
              ) : (
                /* ── Form ── */
                <div className="space-y-4">
                  {/* Quick amounts */}
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Quick Select (KSh)</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {QUICK_AMOUNTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setAmount(String(q))}
                          className={`rounded-xl py-2.5 text-sm font-black transition active:scale-[0.97] ${
                            amount === String(q) ? "bg-[#087cff] text-white" : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.10]"
                          }`}
                        >
                          {q.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount input */}
                  <div className="flex items-center gap-2 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                    <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                    <input
                      type="number"
                      min="10"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="flex-1 bg-transparent py-3.5 text-sm font-bold text-white outline-none placeholder:text-slate-700"
                    />
                    {amount && <button type="button" onClick={() => setAmount("")} className="text-slate-600 hover:text-slate-400"><Icon name="close" className="text-[14px]" /></button>}
                  </div>

                  {/* Phone input */}
                  <div className="flex items-center gap-2 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                    <span className="shrink-0 text-base">🇰🇪</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XXXXXXXX"
                      className="flex-1 bg-transparent py-3.5 text-sm font-bold text-white outline-none placeholder:text-slate-700"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 ring-1 ring-red-500/20">
                      <Icon name="error" fill className="mt-0.5 shrink-0 text-[14px] text-red-400" />
                      <p className="text-xs font-bold text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDeposit}
                    disabled={loading || !amount || !phone}
                    className="w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending prompt…
                      </span>
                    ) : `Deposit KSh ${Number(amount || 0).toLocaleString() || "—"}`}
                  </button>

                  <p className="text-center text-[10px] text-slate-700">Powered by Safaricom M-Pesa · Instant credit</p>
                </div>
              )}
            </>
          )}

          {/* ── WITHDRAW ── */}
          {tab === "withdraw" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#16171d] p-5 ring-1 ring-white/[0.07] text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10">
                  <Icon name="account_balance" fill className="text-[24px] text-amber-400" />
                </div>
                <p className="font-black text-white">Withdraw to M-Pesa</p>
                <p className="mt-1 text-xs text-slate-500">Min KSh 50 · Instant to your number</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-amber-400/50">
                <span className="text-sm font-black text-slate-500">KSh</span>
                <input type="number" min="50" placeholder="Amount" className="flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-700" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07]">
                <span className="text-base">🇰🇪</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" className="flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-700" />
              </div>
              <button
                type="button"
                onClick={() => toast.info("Coming soon", "M-Pesa withdrawals are launching soon!")}
                className="w-full rounded-2xl bg-amber-400/15 py-3.5 text-sm font-black text-amber-400 ring-1 ring-amber-400/20 transition hover:bg-amber-400/25 active:scale-[0.98]"
              >
                Withdraw — Coming Soon
              </button>
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === "history" && <TxnHistory isSignedIn={!!isSignedIn} />}
        </div>
      </div>
    </div>
  );
}

function TxnHistory({ isSignedIn }: { isSignedIn: boolean }) {
  const [txns, setTxns]   = useState<{ id: string; type: string; amount: number; status: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    fetch("/api/wallet/transactions")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTxns(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  if (!isSignedIn) return <p className="py-8 text-center text-sm text-slate-500">Log in to see transactions.</p>;
  if (loading)     return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (!txns.length) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Icon name="receipt_long" fill className="text-[32px] text-slate-700" />
      <p className="text-sm font-black text-white">No transactions yet</p>
      <p className="text-xs text-slate-500">Deposits and bets will appear here</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {txns.map((t) => {
        const m = TXN_META[t.type] ?? { label: t.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
        return (
          <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[#16171d] px-3.5 py-3 ring-1 ring-white/[0.06]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
              <Icon name={m.icon} fill className={`text-[17px] ${m.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black text-white">{m.label}</p>
              <p className="text-[10px] text-slate-600">{new Date(t.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="text-right">
              <p className={`text-[13px] font-black ${m.color}`}>{m.sign}KSh {Number(t.amount).toFixed(2)}</p>
              <p className={`text-[10px] font-black uppercase ${t.status === "COMPLETED" ? "text-emerald-500/70" : t.status === "FAILED" ? "text-red-400/70" : "text-amber-400/70"}`}>{t.status}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
