"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];
const POLL_INTERVAL = 4000;
const MAX_POLLS = 30; // 2 minutes

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

export function WalletClient() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { openLogin } = useAuthModal();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deposit, setDeposit] = useState<DepositState>({ step: "idle" });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  // Pre-fill phone from Clerk user
  useEffect(() => {
    if (user?.phoneNumbers?.[0]?.phoneNumber && !phone) {
      setPhone(user.phoneNumbers[0].phoneNumber.replace("+", ""));
    }
  }, [user, phone]);

  // Polling loop
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
        const res = await fetch("/api/wallet/deposit/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionRequestId: txId }),
        });
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          refreshBalance();
          setDeposit({
            step: "confirmed",
            amount: deposit.amount,
            newBalance: data.newBalance,
            receipt: data.receipt ?? "",
          });
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setDeposit({ step: "failed", message: data.message ?? "Payment failed." });
        }
      } catch {
        // Ignore transient errors, keep polling
      }
    }, POLL_INTERVAL);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [deposit, refreshBalance]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) { openLogin(); return; }
    setError("");
    setLoading(true);

    const amountNum = Number(amount);
    const msisdn = normalizeMsisdn(phone);

    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKes: amountNum, phoneNumber: msisdn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate payment.");
      setDeposit({ step: "pending", txId: data.transactionRequestId, amount: amountNum });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDeposit({ step: "idle" });
    setAmount("");
    setError("");
    pollCount.current = 0;
  }

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Balance card */}
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-[#087cff]/20 to-[#0d0e11] p-6 ring-1 ring-white/[0.08]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Available Balance</p>
        <p className="mt-1 text-4xl font-black text-white">{isSignedIn ? fmtBalance : "—"}</p>
        {!isSignedIn && (
          <button type="button" onClick={openLogin}
            className="mt-4 rounded-xl bg-[#087cff] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#2a90ff]">
            Log in to see balance
          </button>
        )}
      </div>

      {/* Deposit form / states */}
      {deposit.step === "confirmed" ? (
        <div className="rounded-3xl bg-[#16171d] p-6 ring-1 ring-emerald-500/30 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <Icon name="check_circle" fill className="text-[40px] text-emerald-400" />
          </div>
          <h2 className="text-xl font-black text-white">Deposit Confirmed!</h2>
          <p className="mt-1 text-slate-400">KSh {deposit.amount.toLocaleString()} added to your wallet</p>
          <p className="mt-3 text-2xl font-black text-emerald-400">
            KSh {deposit.newBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-600">New balance</p>
          {deposit.receipt && (
            <p className="mt-3 text-xs text-slate-500">Receipt: <span className="font-bold text-slate-300">{deposit.receipt}</span></p>
          )}
          <button type="button" onClick={reset}
            className="mt-6 w-full rounded-2xl bg-[#087cff] py-3 text-sm font-black text-white transition hover:bg-[#2a90ff]">
            Deposit More
          </button>
        </div>
      ) : deposit.step === "failed" ? (
        <div className="rounded-3xl bg-[#16171d] p-6 ring-1 ring-red-500/30 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
            <Icon name="error" fill className="text-[40px] text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white">Payment Failed</h2>
          <p className="mt-2 text-sm text-slate-400">{deposit.message}</p>
          <button type="button" onClick={reset}
            className="mt-6 w-full rounded-2xl bg-white/[0.08] py-3 text-sm font-black text-white transition hover:bg-white/[0.12]">
            Try Again
          </button>
        </div>
      ) : deposit.step === "pending" ? (
        <div className="rounded-3xl bg-[#16171d] p-6 ring-1 ring-[#087cff]/30 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#087cff]/15">
            <svg className="h-8 w-8 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-white">Waiting for Payment</h2>
          <p className="mt-2 text-slate-400">
            Check your phone for the <span className="font-bold text-white">M-Pesa prompt</span> and enter your PIN.
          </p>
          <p className="mt-3 text-3xl font-black text-white">KSh {deposit.amount.toLocaleString()}</p>
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2.5 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            Checking payment status every few seconds…
          </div>
          <button type="button" onClick={reset}
            className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition">
            Cancel
          </button>
        </div>
      ) : (
        /* ── Deposit form ── */
        <div className="rounded-3xl bg-[#16171d] p-6 ring-1 ring-white/[0.07]">
          <h2 className="mb-5 text-lg font-black text-white">Deposit via M-Pesa</h2>

          <form onSubmit={handleDeposit} className="space-y-4">
            {/* Quick amount buttons */}
            <div>
              <p className="mb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Quick Amounts (KSh)</p>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={`rounded-xl py-2.5 text-sm font-black transition ${
                      amount === String(q)
                        ? "bg-[#087cff] text-white"
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
              <p className="mb-1.5 text-xs font-black text-slate-500 uppercase tracking-widest">Amount (KSh)</p>
              <div className="flex items-center gap-3 rounded-2xl bg-[#0d0e11] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <span className="text-sm font-black text-slate-500">KSh</span>
                <input
                  type="number"
                  min="10"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  required
                  className="flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <p className="mb-1.5 text-xs font-black text-slate-500 uppercase tracking-widest">Safaricom Number</p>
              <div className="flex items-center gap-3 rounded-2xl bg-[#0d0e11] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
                <span className="text-sm font-black text-slate-500">🇰🇪</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX or 01XXXXXXXX"
                  required
                  className="flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !amount || !phone}
              className="w-full rounded-2xl bg-[#05b957] py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
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

            <p className="text-center text-[11px] text-slate-600">
              Powered by M-Pesa STK Push. You will get a payment prompt on your phone.
            </p>
          </form>
        </div>
      )}

      {/* Transaction history placeholder */}
      <div className="mt-6 rounded-3xl bg-[#16171d] p-5 ring-1 ring-white/[0.07]">
        <h3 className="mb-3 text-sm font-black text-white">Recent Transactions</h3>
        <TransactionHistory />
      </div>
    </div>
  );
}

function TransactionHistory() {
  const { isSignedIn } = useAuth();
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

  if (!isSignedIn) return <p className="text-xs text-slate-600">Log in to see transactions.</p>;
  if (loading) return <p className="text-xs text-slate-600">Loading…</p>;
  if (!txns.length) return <p className="text-xs text-slate-600">No transactions yet.</p>;

  const typeLabel: Record<string, string> = {
    DEPOSIT: "Deposit",
    WITHDRAWAL: "Withdrawal",
    BET_STAKE: "Bet Placed",
    BET_WIN: "Bet Win",
    BONUS: "Bonus",
    REFUND: "Refund",
  };
  const typeColor: Record<string, string> = {
    DEPOSIT: "text-emerald-400",
    BET_WIN: "text-emerald-400",
    BONUS: "text-emerald-400",
    WITHDRAWAL: "text-red-400",
    BET_STAKE: "text-red-400",
    REFUND: "text-blue-400",
  };

  return (
    <div className="space-y-2">
      {txns.map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
          <div>
            <p className="text-[12px] font-black text-white">{typeLabel[t.type] ?? t.type}</p>
            <p className="text-[10px] text-slate-600">
              {new Date(t.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-[13px] font-black ${typeColor[t.type] ?? "text-white"}`}>
              {["DEPOSIT","BET_WIN","BONUS","REFUND"].includes(t.type) ? "+" : "-"}KSh {Number(t.amount).toFixed(2)}
            </p>
            <p className={`text-[10px] font-bold uppercase ${t.status === "COMPLETED" ? "text-emerald-500" : t.status === "FAILED" ? "text-red-400" : "text-amber-400"}`}>
              {t.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
