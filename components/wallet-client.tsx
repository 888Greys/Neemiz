"use client";

import { useState, useEffect, useRef } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";

const QUICK_AMOUNTS = [100, 250, 500, 1_000, 2_500, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS = 30;

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254")) return s;
  if (s.startsWith("0") && s.length === 10) return `254${s.slice(1)}`;
  return s;
}

const TXN_META: Record<string, { label: string; icon: string; color: string; sign: "+" | "-" }> = {
  DEPOSIT:     { label: "Deposit",     icon: "add_circle",        color: "text-emerald-400", sign: "+" },
  WITHDRAWAL:  { label: "Withdrawal",  icon: "remove_circle",     color: "text-red-400",     sign: "-" },
  BET_STAKE:   { label: "Bet Placed",  icon: "sports_soccer",     color: "text-red-400",     sign: "-" },
  BET_WIN:     { label: "Bet Win",     icon: "emoji_events",      color: "text-emerald-400", sign: "+" },
  BONUS:       { label: "Bonus",       icon: "redeem",            color: "text-amber-400",   sign: "+" },
  REFUND:      { label: "Refund",      icon: "undo",              color: "text-sky-400",     sign: "+" },
};

/* ────────────────────────────────────────────────────────── */

export function WalletClient() {
  const { isSignedIn, user } = useSupabaseAuth();
  const { openLogin }  = useAuthModal();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();

  const [tab, setTab]       = useState<"deposit" | "withdraw" | "history">("deposit");
  const [amount, setAmount] = useState("");
  const [phone, setPhone]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [deposit, setDeposit] = useState<DepositState>({ step: "idle" });

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    const ph = user?.phone ?? user?.user_metadata?.phone_number;
    if (ph && !phone) setPhone(ph.replace("+", ""));
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

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) { openLogin(); return; }
    setError(""); setLoading(true);
    const amountNum = Number(amount);
    const msisdn    = normalizeMsisdn(phone);
    try {
      const res  = await fetch("/api/wallet/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountKes: amountNum, phoneNumber: msisdn }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate payment.");
      setDeposit({ step: "pending", txId: data.transactionRequestId, amount: amountNum });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setDeposit({ step: "idle" }); setAmount(""); setError(""); pollCount.current = 0; }

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  return (
    <div className="w-full">

      {/* ── Balance hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#051b35] via-[#091522] to-[#0d0e11] px-6 pb-8 pt-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#087cff]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#05b957]/8 blur-2xl" />

        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            Available Balance
          </p>
          <p className="text-5xl font-black tracking-tight text-white">
            {isSignedIn ? fmtBalance : "—"}
          </p>
          {!isSignedIn && (
            <button
              type="button"
              onClick={openLogin}
              className="mt-5 rounded-2xl bg-[#087cff] px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#2a90ff]"
            >
              Log in to see balance
            </button>
          )}
          {isSignedIn && (
            <div className="mt-5 flex justify-center gap-2">
              <div className="rounded-xl bg-white/[0.07] px-3 py-1.5 text-center ring-1 ring-white/[0.08]">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Deposited</p>
                <p className="mt-0.5 text-xs font-black text-white">KSh 0.00</p>
              </div>
              <div className="rounded-xl bg-white/[0.07] px-3 py-1.5 text-center ring-1 ring-white/[0.08]">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Won</p>
                <p className="mt-0.5 text-xs font-black text-emerald-400">KSh 0.00</p>
              </div>
              <div className="rounded-xl bg-white/[0.07] px-3 py-1.5 text-center ring-1 ring-white/[0.08]">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Bonuses</p>
                <p className="mt-0.5 text-xs font-black text-amber-400">KSh 0.00</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0d0e11]">
      <div className="mx-auto flex max-w-2xl gap-0">
        {(["deposit", "withdraw", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[12px] font-black uppercase tracking-wider transition ${
              tab === t
                ? "border-b-2 border-[#087cff] text-[#087cff]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon
              name={t === "deposit" ? "add_circle" : t === "withdraw" ? "remove_circle" : "history"}
              fill={tab === t}
              className="text-[15px]"
            />
            {t === "history" ? "History" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>{/* inner max-w */}
      </div>{/* sticky wrapper */}

      <div className="mx-auto max-w-2xl px-4 py-5">
        {/* ── DEPOSIT TAB ── */}
        {tab === "deposit" && (
          <>
            {deposit.step === "confirmed" ? (
              <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-emerald-500/25 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/12 ring-1 ring-emerald-500/20">
                  <Icon name="check_circle" fill className="text-[44px] text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Payment Received!</h2>
                <p className="mt-2 text-sm text-slate-400">
                  <span className="font-bold text-emerald-400">KSh {deposit.amount.toLocaleString()}</span> has been added to your wallet
                </p>
                <div className="my-5 rounded-2xl bg-white/[0.04] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">New Balance</p>
                  <p className="mt-1 text-3xl font-black text-white">
                    KSh {deposit.newBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {deposit.receipt && (
                  <p className="mb-5 text-xs text-slate-500">
                    M-Pesa ref: <span className="font-bold text-slate-300">{deposit.receipt}</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff]"
                >
                  Deposit More
                </button>
              </div>
            ) : deposit.step === "failed" ? (
              <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-red-500/25 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/12 ring-1 ring-red-500/20">
                  <Icon name="cancel" fill className="text-[44px] text-red-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Payment Failed</h2>
                <p className="mt-2 text-sm text-slate-400">{deposit.message}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-6 w-full rounded-2xl bg-white/[0.07] py-3.5 text-sm font-black text-white ring-1 ring-white/[0.10] transition hover:bg-white/[0.11]"
                >
                  Try Again
                </button>
              </div>
            ) : deposit.step === "pending" ? (
              <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-[#087cff]/25 text-center animate-in fade-in zoom-in-95 duration-300">
                {/* Animated ring */}
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#087cff]/60" />
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#087cff]/12 ring-1 ring-[#087cff]/20">
                    <Icon name="phone_iphone" fill className="text-[30px] text-[#087cff]" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white">Check Your Phone</h2>
                <p className="mt-2 text-sm text-slate-400">
                  An <span className="font-bold text-white">M-Pesa STK push</span> has been sent.<br />
                  Enter your PIN to complete the payment.
                </p>
                <div className="my-5 rounded-2xl bg-white/[0.04] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Amount</p>
                  <p className="mt-1 text-3xl font-black text-white">KSh {deposit.amount.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-400/8 px-4 py-2.5 text-xs font-bold text-amber-400">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
                  Checking payment status…
                </div>
                <button type="button" onClick={reset} className="mt-4 text-xs text-slate-600 transition hover:text-slate-400">
                  Cancel
                </button>
              </div>
            ) : (
              /* ── Deposit form ── */
              <div className="space-y-5">
                {/* M-Pesa badge */}
                <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3 ring-1 ring-white/[0.07]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#05b957]/15">
                    <Icon name="phone_iphone" fill className="text-[20px] text-[#05b957]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-white">M-Pesa STK Push</p>
                    <p className="text-[11px] text-slate-500">Instant deposit · Min KSh 10</p>
                  </div>
                  <span className="ml-auto rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">Active</span>
                </div>

                {/* Quick amounts */}
                <div>
                  <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Quick Select (KSh)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(String(q))}
                        className={`rounded-xl py-3 text-sm font-black transition active:scale-[0.97] ${
                          amount === String(q)
                            ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20"
                            : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.10]"
                        }`}
                      >
                        {q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom amount */}
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Amount (KSh)</p>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                    <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      required
                      className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700"
                    />
                    {amount && (
                      <button type="button" onClick={() => setAmount("")} className="text-slate-600 hover:text-slate-400">
                        <Icon name="close" className="text-[16px]" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Safaricom Number</p>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                    <span className="shrink-0 text-base">🇰🇪</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XXXXXXXX or 01XXXXXXXX"
                      required
                      className="flex-1 bg-transparent py-4 text-sm font-bold text-white outline-none placeholder:text-slate-700"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
                    <Icon name="error" fill className="mt-0.5 shrink-0 text-[16px] text-red-400" />
                    <p className="text-xs font-bold text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => handleDeposit(e as unknown as React.FormEvent)}
                  disabled={loading || !amount || !phone}
                  className="w-full rounded-2xl bg-[#05b957] py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
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

                <p className="text-center text-[11px] text-slate-700">
                  Powered by Safaricom M-Pesa · Instant credit to your account
                </p>
              </div>
            )}
          </>
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === "withdraw" && (
          <div className="space-y-5">
            <div className="rounded-3xl bg-[#16171d] p-6 ring-1 ring-white/[0.07] text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10">
                <Icon name="account_balance" fill className="text-[32px] text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white">Withdraw Funds</h3>
              <p className="mt-2 text-sm text-slate-500">
                Withdrawals are sent to your M-Pesa number.<br />
                Minimum withdrawal: <span className="text-white font-bold">KSh 50</span>
              </p>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Amount (KSh)</p>
              <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-amber-400/50 transition">
                <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                <input
                  type="number"
                  min="50"
                  placeholder="Enter amount"
                  className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">M-Pesa Number</p>
              <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-amber-400/50 transition">
                <span className="shrink-0 text-base">🇰🇪</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="flex-1 bg-transparent py-4 text-sm font-bold text-white outline-none placeholder:text-slate-700"
                />
              </div>
            </div>

            <button
              type="button"
              disabled
              className="w-full rounded-2xl bg-amber-400/15 py-4 text-sm font-black text-amber-400 ring-1 ring-amber-400/20 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Withdraw — Coming Soon
            </button>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <TransactionHistory isSignedIn={!!isSignedIn} />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

function TransactionHistory({ isSignedIn }: { isSignedIn: boolean }) {
  const [txns, setTxns] = useState<{ id: string; type: string; amount: number; status: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    fetch("/api/wallet/transactions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTxns(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon name="lock" fill className="text-[36px] text-slate-700" />
        <p className="text-sm font-bold text-slate-500">Log in to see your transactions</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-[#16171d] p-4">
            <div className="h-10 w-10 shrink-0 rounded-xl skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded skeleton" />
              <div className="h-2.5 w-20 rounded skeleton" />
            </div>
            <div className="h-4 w-16 rounded skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (!txns.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05]">
          <Icon name="receipt_long" fill className="text-[32px] text-slate-600" />
        </div>
        <div>
          <p className="font-black text-white">No transactions yet</p>
          <p className="mt-1 text-sm text-slate-500">Your deposit and bet history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {txns.map((t) => {
        const meta = TXN_META[t.type] ?? { label: t.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
        return (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.06]">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]`}>
              <Icon name={meta.icon} fill className={`text-[18px] ${meta.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white">{meta.label}</p>
              <p className="text-[10px] text-slate-600">
                {new Date(t.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[14px] font-black ${meta.color}`}>
                {meta.sign}KSh {Number(t.amount).toFixed(2)}
              </p>
              <p className={`text-[10px] font-black uppercase ${
                t.status === "COMPLETED" ? "text-emerald-500/70"
                  : t.status === "FAILED"    ? "text-red-400/70"
                  : "text-amber-400/70"
              }`}>
                {t.status}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
