"use client";

import { useState, useEffect, useRef } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";

const QUICK_AMOUNTS = [100, 250, 500, 1_000, 2_500, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS     = 30;

const COIN_ICON_URL: Record<string, string> = {
  USDT: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  USDC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
  MATIC:"https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/matic.svg",
};

const CRYPTO_WITHDRAW_ASSETS = [
  { name: "Tether USD",  code: "USDT", network: "TRC20",   displayNet: "TRC-20",  min: 10     },
  { name: "Tether USD",  code: "USDT", network: "ERC20",   displayNet: "ERC-20",  min: 10     },
  { name: "Tether USD",  code: "USDT", network: "BEP20",   displayNet: "BEP-20",  min: 10     },
  { name: "USD Coin",    code: "USDC", network: "ERC20",   displayNet: "ERC-20",  min: 10     },
  { name: "USD Coin",    code: "USDC", network: "POLYGON", displayNet: "Polygon", min: 10     },
  { name: "Bitcoin",     code: "BTC",  network: "BTC",     displayNet: "Bitcoin", min: 0.0001 },
  { name: "Ethereum",    code: "ETH",  network: "ERC20",   displayNet: "ERC-20",  min: 0.005  },
  { name: "BNB",         code: "BNB",  network: "BEP20",   displayNet: "BEP-20",  min: 0.01   },
] as const;

type CryptoWithdrawAsset = (typeof CRYPTO_WITHDRAW_ASSETS)[number];
type CryptoBalance = { crypto: string; network: string; available: number; locked: number };

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

type CryptoWithdrawState =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "success"; txId: string; payoutId?: string }
  | { step: "error"; message: string };

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254")) return s;
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

/* ────────────────────────────────────────────────────────── */

export function WalletClient() {
  const { isSignedIn, user } = useSupabaseAuth();
  const { openLogin }        = useAuthModal();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();

  // ── fiat deposit state ──
  const [tab, setTab]         = useState<"deposit" | "withdraw" | "history">("deposit");
  const [amount, setAmount]   = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [deposit, setDeposit] = useState<DepositState>({ step: "idle" });

  // ── crypto balance state ──
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);

  // ── crypto withdraw state ──
  const [withdrawMode, setWithdrawMode] = useState<"crypto" | "fiat">("crypto");
  const [cwAsset, setCwAsset]           = useState<CryptoWithdrawAsset>(CRYPTO_WITHDRAW_ASSETS[0]);
  const [cwAmount, setCwAmount]         = useState("");
  const [cwAddress, setCwAddress]       = useState("");
  const [cwOpen, setCwOpen]             = useState(false);
  const [cwState, setCwState]           = useState<CryptoWithdrawState>({ step: "idle" });

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  // Pre-fill phone
  useEffect(() => {
    const ph = user?.phone ?? user?.user_metadata?.phone_number;
    if (ph && !phone) setPhone((ph as string).replace("+", ""));
  }, [user, phone]);

  // Fetch crypto balances
  const fetchCryptoBalances = () => {
    fetch("/api/crypto/balance")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCryptoBalances(
            (data as Array<{ crypto: string; network: string; available: string; locked: string }>).map((b) => ({
              crypto:    b.crypto,
              network:   b.network,
              available: Number(b.available),
              locked:    Number(b.locked),
            })),
          );
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isSignedIn) return;
    fetchCryptoBalances();
  }, [isSignedIn]);

  // M-Pesa polling
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
        const res  = await fetch("/api/wallet/deposit/status", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ transactionRequestId: txId }),
        });
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          refreshBalance();
          setDeposit({
            step:       "confirmed",
            amount:     deposit.amount,
            newBalance: data.newBalance as number,
            receipt:    (data.receipt as string) ?? "",
          });
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setDeposit({ step: "failed", message: (data.message as string) ?? "Payment failed." });
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [deposit, refreshBalance]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) { openLogin(); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/wallet/deposit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountKes: Number(amount), phoneNumber: normalizeMsisdn(phone) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to initiate payment.");
      setDeposit({ step: "pending", txId: data.transactionRequestId as string, amount: Number(amount) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCryptoWithdraw() {
    if (!isSignedIn) { openLogin(); return; }
    const amt = Number(cwAmount);
    if (!cwAddress.trim() || !amt) return;
    if (amt < cwAsset.min) {
      setCwState({ step: "error", message: `Minimum withdrawal is ${cwAsset.min} ${cwAsset.code}` });
      return;
    }
    setCwState({ step: "loading" });
    try {
      const res  = await fetch("/api/crypto/withdraw", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          crypto:  cwAsset.code,
          network: cwAsset.network,
          amount:  amt,
          address: cwAddress.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Withdrawal failed");
      setCwState({ step: "success", txId: data.txId as string, payoutId: data.payoutId as string });
      fetchCryptoBalances();
    } catch (err: unknown) {
      setCwState({
        step:    "error",
        message: err instanceof Error ? err.message : "Withdrawal failed",
      });
    }
  }

  function reset() { setDeposit({ step: "idle" }); setAmount(""); setError(""); pollCount.current = 0; }

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

  // Crypto balance for currently selected withdraw asset
  const cwBalance = cryptoBalances.find(
    (b) => b.crypto === cwAsset.code && b.network === cwAsset.network,
  );
  // Non-zero crypto balances for hero display
  const nonZeroBalances = cryptoBalances.filter((b) => b.available > 0 || b.locked > 0);

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
            <>
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

              {/* Crypto balances */}
              {nonZeroBalances.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {nonZeroBalances.map((b) => (
                    <div
                      key={`${b.crypto}:${b.network}`}
                      className="rounded-xl bg-white/[0.06] px-3 py-1.5 text-center ring-1 ring-white/[0.07]"
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {b.crypto} · {b.network}
                      </p>
                      <p className="mt-0.5 font-mono text-xs font-black text-white">
                        {b.available.toFixed(b.crypto === "BTC" || b.crypto === "ETH" ? 8 : 4)}
                      </p>
                      {b.locked > 0 && (
                        <p className="text-[9px] font-bold text-slate-600">
                          +{b.locked.toFixed(4)} locked
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
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
        </div>
      </div>

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
                  <span className="font-bold text-emerald-400">KSh {deposit.amount.toLocaleString()}</span>{" "}
                  has been added to your wallet
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
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 text-xs text-slate-600 transition hover:text-slate-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3 ring-1 ring-white/[0.07]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#05b957]/15">
                    <Icon name="phone_iphone" fill className="text-[20px] text-[#05b957]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-white">M-Pesa STK Push</p>
                    <p className="text-[11px] text-slate-500">Instant deposit · Min KSh 10</p>
                  </div>
                  <span className="ml-auto rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                    Active
                  </span>
                </div>

                <div>
                  <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Quick Select (KSh)
                  </p>
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

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Amount (KSh)
                  </p>
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

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Safaricom Number
                  </p>
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
                  ) : (
                    `Deposit KSh ${Number(amount || 0).toLocaleString() || "—"}`
                  )}
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
            {/* Method toggle */}
            <div className="grid grid-cols-2 rounded-2xl bg-white/[0.045] p-1 ring-1 ring-white/[0.07]">
              <button
                type="button"
                onClick={() => setWithdrawMode("crypto")}
                className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${
                  withdrawMode === "crypto"
                    ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff9811] text-[11px] font-black text-white">
                  ₿
                </span>
                Crypto
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMode("fiat")}
                className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${
                  withdrawMode === "fiat"
                    ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#31c45d] text-[11px] font-black text-white">
                  M
                </span>
                M-Pesa
              </button>
            </div>

            {/* ── Crypto withdraw ── */}
            {withdrawMode === "crypto" && (
              <>
                {cwState.step === "success" ? (
                  <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-emerald-500/25 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/12 ring-1 ring-emerald-500/20">
                      <Icon name="check_circle" fill className="text-[44px] text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white">Withdrawal Submitted</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Your withdrawal is being processed. You will be notified once it is sent on-chain.
                    </p>
                    <p className="mt-3 font-mono text-[11px] text-slate-600">
                      TX: {cwState.txId}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setCwState({ step: "idle" }); setCwAmount(""); setCwAddress(""); }}
                      className="mt-6 w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff]"
                    >
                      New Withdrawal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Coin selector */}
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                        Crypto Asset
                      </p>
                      <div className="relative">
                        {/* Trigger */}
                        <button
                          type="button"
                          onClick={() => setCwOpen((o) => !o)}
                          className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]"
                        >
                          <span className="flex items-center gap-3">
                            {COIN_ICON_URL[cwAsset.code] && (
                              <img
                                src={COIN_ICON_URL[cwAsset.code]}
                                alt={cwAsset.code}
                                width={28}
                                height={28}
                                className="h-7 w-7 rounded-full"
                              />
                            )}
                            <span>
                              <span className="block text-sm font-black text-white">
                                {cwAsset.code}
                                <span className="ml-2 text-[11px] font-bold text-slate-500">{cwAsset.displayNet}</span>
                              </span>
                            </span>
                          </span>
                          <Icon name={cwOpen ? "expand_less" : "expand_more"} className="text-[22px] text-slate-500" />
                        </button>

                        {/* Dropdown */}
                        {cwOpen && (
                          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl bg-[#121824] shadow-2xl shadow-black/40 ring-1 ring-white/[0.09]">
                            {CRYPTO_WITHDRAW_ASSETS.map((a) => (
                              <button
                                key={`${a.code}:${a.network}`}
                                type="button"
                                onClick={() => {
                                  setCwAsset(a);
                                  setCwOpen(false);
                                  setCwState({ step: "idle" });
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                              >
                                {COIN_ICON_URL[a.code] && (
                                  <img
                                    src={COIN_ICON_URL[a.code]}
                                    alt={a.code}
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 rounded-full"
                                  />
                                )}
                                <span className="flex-1">
                                  <span className="block text-sm font-black text-white">
                                    {a.code}
                                    <span className="ml-2 text-[11px] font-bold text-slate-500">{a.displayNet}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-600">min {a.min} {a.code}</span>
                                </span>
                                {cwAsset.code === a.code && cwAsset.network === a.network && (
                                  <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Balance hint */}
                      {cwBalance ? (
                        <p className="mt-1.5 px-1 text-xs font-bold text-slate-500">
                          Available:{" "}
                          <span
                            className="cursor-pointer font-black text-white transition hover:text-[#75b8ff]"
                            onClick={() =>
                              setCwAmount(
                                cwBalance.available.toFixed(
                                  cwAsset.code === "BTC" || cwAsset.code === "ETH" ? 8 : 6,
                                ),
                              )
                            }
                          >
                            {cwBalance.available.toFixed(
                              cwAsset.code === "BTC" || cwAsset.code === "ETH" ? 8 : 6,
                            )}{" "}
                            {cwAsset.code}
                          </span>
                          <span className="ml-1 text-slate-700">(tap to fill)</span>
                        </p>
                      ) : (
                        <p className="mt-1.5 px-1 text-xs font-bold text-slate-600">
                          No {cwAsset.code} ({cwAsset.displayNet}) balance
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                        Amount ({cwAsset.code})
                      </p>
                      <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                        <input
                          type="number"
                          min={cwAsset.min}
                          step="any"
                          value={cwAmount}
                          onChange={(e) => { setCwAmount(e.target.value); setCwState({ step: "idle" }); }}
                          placeholder={`Min. ${cwAsset.min}`}
                          className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700"
                        />
                        <span className="shrink-0 text-sm font-black text-slate-500">{cwAsset.code}</span>
                      </div>
                    </div>

                    {/* Destination address */}
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                        Destination wallet address
                      </p>
                      <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                        <input
                          type="text"
                          value={cwAddress}
                          onChange={(e) => { setCwAddress(e.target.value); setCwState({ step: "idle" }); }}
                          placeholder={`${cwAsset.displayNet} address`}
                          className="flex-1 bg-transparent py-4 font-mono text-sm text-white outline-none placeholder:font-sans placeholder:text-slate-700"
                        />
                      </div>
                    </div>

                    {/* Network warning */}
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-400/8 px-4 py-3 ring-1 ring-amber-400/15">
                      <Icon name="info" fill className="mt-0.5 shrink-0 text-[15px] text-amber-400" />
                      <p className="text-[11px] font-bold text-amber-300/80">
                        Ensure the address supports{" "}
                        <strong>
                          {cwAsset.code} on {cwAsset.displayNet}
                        </strong>
                        . Sending to the wrong network is unrecoverable.
                      </p>
                    </div>

                    {cwState.step === "error" && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
                        <Icon name="error" fill className="mt-0.5 shrink-0 text-[16px] text-red-400" />
                        <p className="text-xs font-bold text-red-400">{cwState.message}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCryptoWithdraw}
                      disabled={
                        cwState.step === "loading" ||
                        !cwAmount ||
                        !cwAddress.trim() ||
                        !isSignedIn
                      }
                      className="w-full rounded-2xl bg-[#087cff] py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50"
                    >
                      {cwState.step === "loading" ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Submitting withdrawal…
                        </span>
                      ) : (
                        `Withdraw ${cwAmount ? `${cwAmount} ` : ""}${cwAsset.code}`
                      )}
                    </button>
                  </div>
                )}

                {/* Recent crypto withdrawals */}
                <CryptoWithdrawalHistory isSignedIn={!!isSignedIn} />
              </>
            )}

            {/* ── M-Pesa withdraw (coming soon) ── */}
            {withdrawMode === "fiat" && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#16171d] p-6 ring-1 ring-white/[0.07] text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10">
                    <Icon name="account_balance" fill className="text-[32px] text-amber-400" />
                  </div>
                  <h3 className="text-lg font-black text-white">M-Pesa Withdrawal</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Withdrawals to M-Pesa are coming soon.<br />
                    Use crypto withdrawal for instant payouts.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Amount (KSh)
                  </p>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] transition">
                    <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                    <input
                      type="number"
                      min="50"
                      placeholder="Enter amount"
                      disabled
                      className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700 disabled:opacity-40"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    M-Pesa Number
                  </p>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] transition">
                    <span className="shrink-0 text-base">🇰🇪</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XXXXXXXX"
                      disabled
                      className="flex-1 bg-transparent py-4 text-sm font-bold text-white outline-none placeholder:text-slate-700 disabled:opacity-40"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full rounded-2xl bg-amber-400/15 py-4 text-sm font-black text-amber-400 ring-1 ring-amber-400/20 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Coming Soon
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && <TransactionHistory isSignedIn={!!isSignedIn} />}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

function CryptoWithdrawalHistory({ isSignedIn }: { isSignedIn: boolean }) {
  const [items, setItems] = useState<
    Array<{ id: string; amount: number; crypto: string; status: string; address?: string; network?: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    fetch("/api/crypto/withdraw")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => setItems(Array.isArray(data) ? data as typeof items : []))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  if (!isSignedIn || (!loading && !items.length)) return null;

  return (
    <div>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
        Recent Crypto Withdrawals
      </p>
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
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
      ) : (
        <div className="space-y-2">
          {items.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.06]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                <Icon name="remove_circle" fill className="text-[18px] text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-white">
                  {w.crypto} · {w.network ?? ""}
                </p>
                <p className="truncate text-[10px] font-mono text-slate-600">
                  → {w.address ?? ""}
                </p>
                <p className="text-[10px] text-slate-600">
                  {new Date(w.createdAt).toLocaleDateString("en-KE", {
                    day:    "numeric",
                    month:  "short",
                    hour:   "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-black text-red-400">
                  -{w.amount} {w.crypto}
                </p>
                <p
                  className={`text-[10px] font-black uppercase ${
                    w.status === "COMPLETED"
                      ? "text-emerald-500/70"
                      : w.status === "FAILED"
                        ? "text-red-400/70"
                        : "text-amber-400/70"
                  }`}
                >
                  {w.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionHistory({ isSignedIn }: { isSignedIn: boolean }) {
  const [txns, setTxns] = useState<
    Array<{ id: string; type: string; amount: number; status: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    fetch("/api/wallet/transactions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => setTxns(Array.isArray(data) ? data as typeof txns : []))
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
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.06]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
              <Icon name={meta.icon} fill className={`text-[18px] ${meta.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white">{meta.label}</p>
              <p className="text-[10px] text-slate-600">
                {new Date(t.createdAt).toLocaleDateString("en-KE", {
                  day:    "numeric",
                  month:  "short",
                  hour:   "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[14px] font-black ${meta.color}`}>
                {meta.sign}KSh {Number(t.amount).toFixed(2)}
              </p>
              <p
                className={`text-[10px] font-black uppercase ${
                  t.status === "COMPLETED"
                    ? "text-emerald-500/70"
                    : t.status === "FAILED"
                      ? "text-red-400/70"
                      : "text-amber-400/70"
                }`}
              >
                {t.status}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
