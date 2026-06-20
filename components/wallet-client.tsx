"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { LoadingDots } from "@/components/loading-dots";
import { NOTIFICATIONS_REFRESH_EVENT } from "@/components/notifications-dropdown";
import { cachedFetch, getCached } from "@/lib/client-cache";

const POLL_INTERVAL = 4_000;
const MAX_POLLS     = 30;

// Flag for the local-currency "coin" (e.g. KES, NGN). First two letters of the
// currency code map to the country flag for most local currencies.
const flagUrl = (code: string) => `https://flagcdn.com/w40/${code.slice(0, 2).toLowerCase()}.png`;

const COIN_ICON_URL: Record<string, string> = {
  USDT:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  USDC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
  MATIC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/matic.svg",
  TRX:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/trx.svg",
  DAI:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/dai.svg",
  BUSD:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/busd.svg",
  WBTC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/wbtc.svg",
  LINK:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/link.svg",
};

const CRYPTO_WITHDRAW_ASSETS = [
  { name: "Tether USD",       code: "USDT",  network: "TRC20",   displayNet: "TRC-20",  min: 1       },
  { name: "Tether USD",       code: "USDT",  network: "ERC20",   displayNet: "ERC-20",  min: 1       },
  { name: "Tether USD",       code: "USDT",  network: "BEP20",   displayNet: "BEP-20",  min: 1       },
  { name: "USD Coin",         code: "USDC",  network: "ERC20",   displayNet: "ERC-20",  min: 10      },
  { name: "USD Coin",         code: "USDC",  network: "POLYGON", displayNet: "Polygon", min: 1       },
  { name: "Bitcoin",          code: "BTC",   network: "BTC",     displayNet: "Bitcoin", min: 0.0001  },
  { name: "Ethereum",         code: "ETH",   network: "ERC20",   displayNet: "ERC-20",  min: 0.005   },
  { name: "BNB",              code: "BNB",   network: "BEP20",   displayNet: "BEP-20",  min: 0.01    },
  { name: "Polygon",          code: "MATIC", network: "POLYGON", displayNet: "Polygon", min: 1       },
  { name: "TRON",             code: "TRX",   network: "TRC20",   displayNet: "TRC-20",  min: 10      },
  { name: "Dai",              code: "DAI",   network: "ERC20",   displayNet: "ERC-20",  min: 10      },
  { name: "Binance USD",      code: "BUSD",  network: "BEP20",   displayNet: "BEP-20",  min: 10      },
  { name: "Wrapped Bitcoin",  code: "WBTC",  network: "ERC20",   displayNet: "ERC-20",  min: 0.0001  },
  { name: "Chainlink",        code: "LINK",  network: "ERC20",   displayNet: "ERC-20",  min: 0.5     },
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

// M-Pesa (fiat) withdrawals. Lipa Haraka restored B2C payouts on 2026-06-20
// (confirmed working: a live KES 11 withdrawal completed end-to-end), so the
// form is re-enabled. The backend also requires LIPAHARAKA_WITHDRAWALS_ENABLED=true.
const MPESA_WITHDRAWALS_ENABLED = true;

export function WalletClient({ wide = false }: { wide?: boolean } = {}) {
  const { isSignedIn, user } = useSupabaseAuth();
  const { openLogin }        = useAuthModal();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();

  // ── fiat deposit state ──
  const [tab, setTab]                     = useState<"deposit" | "send" | "withdraw" | "history">("deposit");
  const [depositMethod, setDepositMethod] = useState<"mpesa" | "crypto">("mpesa");
  const [amount, setAmount]               = useState("");
  const [phone, setPhone]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [deposit, setDeposit]             = useState<DepositState>({ step: "idle" });

  // ── crypto balance state ──
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);

  // ── crypto withdraw state ──
  const [withdrawMode, setWithdrawMode] = useState<"crypto" | "fiat">("fiat");
  const [cwAsset, setCwAsset]           = useState<CryptoWithdrawAsset>(CRYPTO_WITHDRAW_ASSETS[0]);
  const [cwAmount, setCwAmount]         = useState("");
  const [cwAddress, setCwAddress]       = useState("");
  const [cwOpen, setCwOpen]             = useState(false);
  const [cwState, setCwState]           = useState<CryptoWithdrawState>({ step: "idle" });

  // ── M-Pesa withdraw state ──
  const [wdAmount, setWdAmount] = useState("");
  const [wdPhone, setWdPhone]   = useState("");
  const [wdLoading, setWdLoading] = useState(false);
  const [wdError, setWdError]   = useState("");
  const [wdDone, setWdDone]     = useState<{ payout: number; fee: number; queued?: boolean; message?: string } | null>(null);

  // ── "Notify me when M-Pesa withdrawals reopen" opt-in (while paused) ──
  const [notifyState, setNotifyState] = useState<"idle" | "loading" | "subscribed">("idle");

  // The user's saved M-Pesa number (prefilled into deposit + withdraw).
  const [savedMpesa, setSavedMpesa] = useState<string | null>(null);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  // Load the saved M-Pesa number and prefill both deposit and withdrawal.
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    fetch("/api/account/mpesa")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { phone?: string | null } | null) => {
        if (!active || !d?.phone) return;
        const local = d.phone.startsWith("254") ? `0${d.phone.slice(3)}` : d.phone;
        setSavedMpesa(d.phone);
        setPhone((p) => p || local);
        setWdPhone((p) => p || local);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isSignedIn]);

  // Remember the M-Pesa number on the account so it prefills next time.
  const saveMpesaNumber = useCallback((raw: string) => {
    const normalized = raw.trim().startsWith("0") ? `254${raw.trim().slice(1)}` : raw.trim().replace("+", "");
    if (!/^254[17]\d{8}$/.test(normalized) || normalized === savedMpesa) return;
    fetch("/api/account/mpesa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.phone) setSavedMpesa(d.phone); })
      .catch(() => {});
  }, [savedMpesa]);

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

  // Load whether the user already opted in to the withdrawal-reopen alert.
  useEffect(() => {
    if (MPESA_WITHDRAWALS_ENABLED || !isSignedIn) return;
    let active = true;
    fetch("/api/wallet/withdraw/notify-me")
      .then((r) => r.ok ? r.json() : { subscribed: false })
      .then((d) => { if (active && d.subscribed) setNotifyState("subscribed"); })
      .catch(() => {});
    return () => { active = false; };
  }, [isSignedIn]);

  async function handleNotifyMe() {
    if (!isSignedIn) { openLogin(); return; }
    setNotifyState("loading");
    try {
      const res = await fetch("/api/wallet/withdraw/notify-me", { method: "POST" });
      if (!res.ok) throw new Error();
      setNotifyState("subscribed");
    } catch {
      setNotifyState("idle");
    }
  }

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
    if (Number(amount) < 49) { setError("Minimum deposit is KSh 49."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/wallet/deposit/lipaharaka", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: normalizeMsisdn(phone), amount: Number(amount) }),
      });
      // Guard against non-JSON responses (e.g. an HTML 502 during a deploy swap)
      // so the user sees a clean message instead of a JSON parse error.
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Payment service is busy — please try again in a moment.");
      saveMpesaNumber(phone); // remember this number for next time
      setDeposit({ step: "pending", txId: data.transactionId as string, amount: Number(amount) });
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

  async function handleMpesaWithdraw() {
    if (!isSignedIn) { openLogin(); return; }
    const amt = Number(wdAmount);
    if (!wdPhone.trim() || !amt) return;
    setWdLoading(true); setWdError("");
    try {
      const res  = await fetch("/api/wallet/withdraw", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountKes: amt, phoneNumber: wdPhone }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; payout?: number; fee?: number; queued?: boolean; pendingApproval?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
      saveMpesaNumber(wdPhone); // remember this number for next time
      setWdDone({ payout: data.payout ?? amt, fee: data.fee ?? 0, queued: data.queued || data.pendingApproval, message: data.message });
      refreshBalance();
    } catch (err) {
      setWdError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setWdLoading(false);
    }
  }

  function reset() { setDeposit({ step: "idle" }); setAmount(""); setError(""); pollCount.current = 0; }

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
  const kesCoinAvailable = currency === "KES" ? balance : 0;

  // Crypto balance for currently selected withdraw asset
  const cwBalance = cryptoBalances.find(
    (b) => b.crypto === cwAsset.code && b.network === cwAsset.network,
  );
  // Non-zero crypto balances for hero display
  const nonZeroBalances = cryptoBalances.filter((b) => b.crypto !== "KES" && (b.available > 0 || b.locked > 0));
  const formatCryptoAmount = (b: CryptoBalance) =>
    b.available.toFixed(b.crypto === "KES" ? 2 : b.crypto === "BTC" || b.crypto === "ETH" ? 8 : 4);

  return (
    <div className={`w-full ${wide ? "lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start" : ""}`}>

      {/* ── Balance hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#051b35] via-[#091522] to-[#0d0e11] px-6 pb-5 pt-7 sm:pb-8 sm:pt-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#087cff]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#087cff]/8 blur-2xl" />

        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 sm:text-[11px]">
            Available Balance
          </p>
          <p className="text-3xl font-black tracking-tight text-white sm:text-5xl">
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

        </div>
      </div>

      <div className="min-w-0">{/* ── right column when wide: tabs + active panel ── */}
      {/* ── Tabs ── */}
      <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#0d0e11]">
        <div className="mx-auto grid max-w-2xl grid-cols-4 gap-0">
          {(["deposit", "send", "withdraw", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-[10px] font-black transition sm:flex-row sm:gap-1.5 sm:py-3.5 sm:text-[12px] sm:uppercase sm:tracking-wider ${
                tab === t
                  ? "border-b-2 border-[#087cff] text-[#087cff]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon
                name={
                  t === "deposit"
                    ? "add_circle"
                    : t === "send"
                      ? "send"
                    : t === "withdraw"
                      ? "remove_circle"
                      : "history"
                }
                fill={tab === t}
                className="text-[18px] sm:text-[15px]"
              />
              <span className="truncate leading-none">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
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
                {/* ── Payment method selector ── */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositMethod("mpesa")}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 transition ${depositMethod === "mpesa" ? "bg-[#087cff]/10 ring-[#087cff]/40" : "bg-[#16171d] ring-white/[0.07] hover:bg-white/[0.04]"}`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${depositMethod === "mpesa" ? "bg-[#087cff]/20" : "bg-white/[0.06]"}`}>
                      <Icon name="phone_iphone" fill className={`text-[18px] ${depositMethod === "mpesa" ? "text-[#087cff]" : "text-slate-500"}`} />
                    </div>
                    <div className="text-left">
                      <p className={`text-[12px] font-black ${depositMethod === "mpesa" ? "text-white" : "text-slate-400"}`}>M-Pesa</p>
                      <p className="text-[10px] text-slate-600">STK Push</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod("crypto")}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 transition ${depositMethod === "crypto" ? "bg-[#f59e0b]/10 ring-[#f59e0b]/40" : "bg-[#16171d] ring-white/[0.07] hover:bg-white/[0.04]"}`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${depositMethod === "crypto" ? "bg-[#f59e0b]/20" : "bg-white/[0.06]"}`}>
                      <Icon name="currency_bitcoin" fill className={`text-[18px] ${depositMethod === "crypto" ? "text-[#f59e0b]" : "text-slate-500"}`} />
                    </div>
                    <div className="text-left">
                      <p className={`text-[12px] font-black ${depositMethod === "crypto" ? "text-white" : "text-slate-400"}`}>Crypto</p>
                      <p className="text-[10px] text-slate-600">USDT · BTC · ETH</p>
                    </div>
                  </button>
                </div>

                {depositMethod === "crypto" && <CryptoDepositPanel />}

                {depositMethod === "mpesa" && (<>
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Amount (KSh)
                  </p>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50 transition">
                    <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                    <input
                      type="number"
                      min="49"
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
                  <p className="mt-2 text-[11px] font-bold text-slate-600">Minimum deposit: KSh 49</p>
                </div>

                {depositMethod === "mpesa" && (
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
                )}

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
                  className="w-full rounded-2xl bg-[#087cff] py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50"
                >
                  {loading ? (
                    <LoadingDots label="Sending prompt" />
                  ) : (
                    `Deposit KSh ${Number(amount || 0).toLocaleString() || "—"}`
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-700">
                  Powered by Safaricom M-Pesa · Instant credit to your account
                </p>
                </>)}
              </div>
            )}
          </>
        )}

        {tab === "send" && (
          <WalletTransferPanel
            isSignedIn={!!isSignedIn}
            balance={balance}
            openLogin={openLogin}
            refreshBalance={refreshBalance}
          />
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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#087cff] text-[11px] font-black text-white">
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
                                  cwAsset.code === "ETH" || cwAsset.code === "WBTC" ? 8 : 6,
                                ),
                              )
                            }
                          >
                            {cwBalance.available.toFixed(
                              cwAsset.code === "ETH" || cwAsset.code === "WBTC" ? 8 : 6,
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

                    <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/8 px-4 py-3 ring-1 ring-emerald-500/15">
                      <Icon name="verified" fill className="mt-0.5 shrink-0 text-[15px] text-emerald-400" />
                      <p className="text-[11px] font-bold text-emerald-300/80">
                        No Nezeem withdrawal fee during testing. You receive the full{" "}
                        <strong>{cwAmount || "requested"} {cwAsset.code}</strong>; Nezeem pays the network gas separately.
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
                        <LoadingDots label="Submitting withdrawal" />
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

            {/* ── M-Pesa withdraw — paused while Lipa B2C is down (see MPESA_WITHDRAWALS_ENABLED) ── */}
            {withdrawMode === "fiat" && !MPESA_WITHDRAWALS_ENABLED && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-white/[0.07] text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15">
                    <Icon name="warning" className="text-[30px] text-amber-400" />
                  </div>
                  <h3 className="text-lg font-black text-white">M-Pesa withdrawals temporarily unavailable</h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    We&rsquo;re experiencing a problem with M-Pesa payouts and are working to
                    restore them. Your balance is safe.
                  </p>
                  {notifyState === "subscribed" ? (
                    <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-[#05b957]">
                      <Icon name="check_circle" className="text-[16px]" />
                      You&rsquo;re on the list — we&rsquo;ll email you when withdrawals reopen.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNotifyMe}
                      disabled={notifyState === "loading"}
                      className="mx-auto mt-1 flex items-center gap-2 rounded-xl bg-white/[0.08] px-5 py-2.5 text-sm font-black text-white ring-1 ring-white/[0.08] transition hover:bg-white/[0.12] disabled:opacity-50"
                    >
                      {notifyState === "loading" ? (
                        <LoadingDots label="Saving" />
                      ) : (
                        <><Icon name="notifications" className="text-[16px]" /> Notify me by email when it&rsquo;s back</>
                      )}
                    </button>
                  )}
                  <p className="text-xs text-slate-600 pt-1">
                    Need crypto instead? Switch to the <span className="font-bold text-slate-400">Crypto</span> tab above — those withdrawals are working normally.
                  </p>
                </div>
              </div>
            )}

            {/* ── M-Pesa withdraw ── */}
            {withdrawMode === "fiat" && MPESA_WITHDRAWALS_ENABLED && (
              <div className="space-y-5">
                {wdDone ? (
                  <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-white/[0.07] text-center space-y-3">
                    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${wdDone.queued ? "bg-[#087cff]/15" : "bg-[#05b957]/15"}`}>
                      <Icon name={wdDone.queued ? "schedule" : "check_circle"} className={`text-[32px] ${wdDone.queued ? "text-[#087cff]" : "text-[#05b957]"}`} />
                    </div>
                    <h3 className="text-lg font-black text-white">{wdDone.queued ? "Withdrawal is processing" : "Withdrawal Submitted"}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {wdDone.message ? (
                        wdDone.message
                      ) : (
                        <>
                          <span className="text-white font-bold">KSh {wdDone.payout.toLocaleString()}</span> is being sent to your M-Pesa.
                          <br />Fee: KSh {wdDone.fee.toLocaleString()}
                        </>
                      )}
                    </p>
                    {wdDone.queued && (
                      <p className="text-xs text-slate-600">You&rsquo;ll get a notification the moment it&rsquo;s on its way. No need to resubmit.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setWdDone(null); setWdAmount(""); setWdPhone(""); }}
                      className="mt-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
                    >
                      New Withdrawal
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl bg-[#16171d]/60 px-4 py-3 ring-1 ring-white/[0.05]">
                      <p className="text-xs text-slate-500">
                        <span className="font-bold text-slate-300">Test mode:</span> no fee. Min KSh 11 · Max KSh 500 per day.
                        Money arrives within 1–5 minutes via Safaricom M-Pesa.
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Amount (KSh)</p>
                      <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/40 transition">
                        <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                        <input
                          type="number"
                          min="50"
                          max="500"
                          value={wdAmount}
                          onChange={(e) => { setWdAmount(e.target.value); setWdError(""); }}
                          placeholder="Enter amount"
                          className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700"
                        />
                        {wdAmount && Number(wdAmount) >= 11 && (
                          <span className="shrink-0 text-xs text-slate-600">
                            → KSh {Number(wdAmount).toLocaleString("en-KE")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">M-Pesa Number</p>
                      <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/40 transition">
                        <span className="shrink-0 text-base">🇰🇪</span>
                        <input
                          type="tel"
                          value={wdPhone}
                          onChange={(e) => { setWdPhone(e.target.value); setWdError(""); }}
                          placeholder="07XXXXXXXX"
                          className="flex-1 bg-transparent py-4 text-sm font-bold text-white outline-none placeholder:text-slate-700"
                        />
                      </div>
                    </div>

                    {wdError && (
                      <p className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <Icon name="error" className="text-[13px]" />
                        {wdError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleMpesaWithdraw}
                      disabled={wdLoading || !wdAmount || Number(wdAmount) < 11 || !wdPhone.trim()}
                      className="w-full rounded-2xl bg-[#087cff] py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50"
                    >
                      {wdLoading ? (
                        <LoadingDots label="Processing" />
                      ) : (
                        `Withdraw${wdAmount && Number(wdAmount) >= 11 ? ` KSh ${Number(wdAmount).toLocaleString()}` : ""} via M-Pesa`
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && <TransactionHistory isSignedIn={!!isSignedIn} />}
      </div>
      </div>{/* ── end right column ── */}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

type TransferRecipient = {
  id: string;
  username: string;
  displayName: string;
  imageUrl: string | null;
};

type TransferReceipt = {
  amount: number;
  recipient: TransferRecipient;
  reference: string;
};

function WalletTransferPanel({
  isSignedIn,
  balance,
  openLogin,
  refreshBalance,
}: {
  isSignedIn: boolean;
  balance: number;
  openLogin: () => void;
  refreshBalance: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransferRecipient[]>([]);
  const [recipient, setRecipient] = useState<TransferRecipient | null>(null);
  const [amount, setAmount] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);

  useEffect(() => {
    if (!isSignedIn || recipient || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/wallet/transfer?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setResults(response.ok && Array.isArray(data) ? data : []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isSignedIn, query, recipient]);

  async function sendMoney() {
    if (!isSignedIn) { openLogin(); return; }
    if (!recipient) { setError("Select a recipient from the search results"); return; }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, amount: Number(amount) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Transfer failed");
      setReceipt({
        amount: Number(amount),
        recipient,
        reference: typeof data.reference === "string" ? data.reference : "Completed",
      });
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      refreshBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSending(false);
    }
  }

  if (receipt) {
    return (
      <div className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top,#123c35_0%,#11161b_48%,#101116_100%)] p-6 text-center ring-1 ring-emerald-400/20">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 text-[#07251b] shadow-[0_0_40px_rgba(52,211,153,0.35)]">
            <Icon name="check" className="text-[32px] font-black" />
          </div>
        </div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-emerald-400">Transfer successful</p>
        <h2 className="mt-2 text-4xl font-black tracking-tight text-white">
          KSh {receipt.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
        </h2>

        <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-2xl bg-white/[0.05] p-4 text-left ring-1 ring-white/[0.08]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#087cff]/20 font-black text-[#75b8ff]">
            {receipt.recipient.imageUrl
              ? <img src={receipt.recipient.imageUrl} alt="" className="h-full w-full object-cover" />
              : receipt.recipient.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{receipt.recipient.displayName}</p>
            <p className="truncate text-xs font-bold text-slate-400">@{receipt.recipient.username}</p>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-400">Completed</span>
        </div>

        <p className="mt-4 text-xs font-medium text-slate-500">The recipient&apos;s Nezeem wallet was credited instantly.</p>
        <button
          type="button"
          onClick={() => {
            setReceipt(null);
            setQuery("");
            setRecipient(null);
            setAmount("");
          }}
          className="mt-6 w-full rounded-2xl bg-[#087cff] py-4 text-sm font-black text-white transition hover:bg-[#2a90ff] active:scale-[0.98]"
        >
          Send Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
          Find recipient
        </p>
        {recipient ? (
          <button
            type="button"
            onClick={() => { setRecipient(null); setQuery(""); }}
            className="flex w-full items-center gap-3 rounded-2xl bg-[#16171d] p-4 text-left ring-1 ring-[#087cff]/40"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#087cff]/20 font-black text-[#75b8ff]">
              {recipient.imageUrl
                ? <img src={recipient.imageUrl} alt="" className="h-full w-full object-cover" />
                : (recipient.displayName || recipient.username || "U").charAt(0).toUpperCase()}
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-white">{recipient.displayName}</span>
              <span className="block truncate text-xs font-bold text-[#75b8ff]">@{recipient.username}</span>
            </span>
            <span className="text-xs font-bold text-slate-500">Change</span>
          </button>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setError(""); }}
              placeholder="Username, email or phone number"
              className="w-full rounded-2xl bg-[#16171d] px-4 py-4 text-sm font-bold text-white outline-none ring-1 ring-white/[0.07] placeholder:text-slate-700 focus:ring-[#087cff]/50"
            />
            {(searching || results.length > 0) && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-[#1a1b22] shadow-2xl ring-1 ring-white/[0.1]">
                {searching ? (
                  <p className="px-4 py-3 text-xs font-bold text-slate-500">Searching...</p>
                ) : results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => { setRecipient(user); setQuery(`@${user.username}`); setResults([]); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/[0.07] text-sm font-black text-white">
                      {user.imageUrl
                        ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                        : (user.displayName || user.username || "U").charAt(0).toUpperCase()}
                    </div>
                    <span>
                      <span className="block text-sm font-black text-white">{user.displayName}</span>
                      <span className="block text-xs font-bold text-slate-500">@{user.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Amount</p>
          <p className="text-xs font-bold text-slate-500">Balance: KSh {balance.toLocaleString("en-KE")}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
          <span className="text-sm font-black text-slate-500">KSh</span>
          <input
            type="number"
            min="1"
            max={balance}
            value={amount}
            onChange={(event) => { setAmount(event.target.value); setError(""); }}
            placeholder="0.00"
            className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700"
          />
        </div>
      </div>

      {error && <p className="text-xs font-bold text-red-400">{error}</p>}
      <button
        type="button"
        onClick={sendMoney}
        disabled={sending || !recipient || !amount || Number(amount) <= 0}
        className="w-full rounded-2xl bg-[#087cff] py-4 text-base font-black text-white transition hover:bg-[#2a90ff] active:scale-[.98] disabled:opacity-50"
      >
        {sending ? <LoadingDots label="Sending" /> : "Send Money"}
      </button>
    </div>
  );
}

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

const KES_CURRENCIES = new Set(["KES"]);

function fmtTxAmount(amount: number, currency: string): string {
  if (KES_CURRENCIES.has(currency)) {
    return `KSh ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Crypto — show up to 6 decimals, strip trailing zeros
  const decimals = ["BTC", "ETH"].includes(currency) ? 8 : 6;
  return `${amount.toFixed(decimals).replace(/\.?0+$/, "")} ${currency}`;
}

type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string | null;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string;
};

const WALLET_HISTORY_KEY = "/api/wallet/transactions";

function transactionContext(transaction: WalletTransaction): Array<{ label: string; value: string }> {
  const metadata = transaction.metadata ?? {};
  const rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) rows.push({ label, value });
    if (typeof value === "number" && Number.isFinite(value)) rows.push({ label, value: String(value) });
  };

  add("Recipient", metadata.to);
  add("Sender", metadata.from);
  add("Phone number", metadata.msisdn ?? metadata.phoneNumber);
  add("Network", metadata.network);
  add("Asset", metadata.crypto);
  add("Wallet address", metadata.address);
  add("Fee", metadata.feeKes);
  add("Payout", metadata.payoutKes);
  return rows;
}

// Friendlier, money-aware status wording. Withdrawals read "Sent" when done and
// "Processing" while in flight, instead of the raw PENDING/COMPLETED.
function txStatusLabel(t: WalletTransaction): string {
  switch (t.status) {
    case "COMPLETED":         return t.type === "WITHDRAWAL" ? "Sent" : t.type === "DEPOSIT" ? "Received" : "Completed";
    case "PENDING":           return "Processing";
    case "PENDING_APPROVAL":  return "In review";
    case "FAILED":            return "Failed";
    case "CANCELLED":         return "Cancelled";
    default:                  return t.status;
  }
}

function TransactionHistory({ isSignedIn }: { isSignedIn: boolean }) {
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [selected, setSelected] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  // Seed from the client cache after mount (not during render) so the first
  // client render matches the server and we don't trip a hydration mismatch.
  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    const cached = getCached<WalletTransaction[]>(WALLET_HISTORY_KEY);
    if (cached?.length) { setTxns(cached); setLoading(false); }
    cachedFetch<WalletTransaction[]>(WALLET_HISTORY_KEY, true)
      .then((data) => { if (data) setTxns(data); })
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

  if (selected) {
    const meta = TXN_META[selected.type] ?? { label: selected.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
    const context = transactionContext(selected);
    return (
      <div className="animate-in slide-in-from-right-4 fade-in duration-300">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-4 flex items-center gap-2 text-sm font-black text-slate-400 transition hover:text-white"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Transaction history
        </button>

        <div className="overflow-hidden rounded-3xl bg-[#14161c] ring-1 ring-white/[0.08]">
          <div className="bg-[radial-gradient(circle_at_top,rgba(8,124,255,0.18),transparent_65%)] px-5 py-7 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]">
              <Icon name={meta.icon} fill className={`text-[30px] ${meta.color}`} />
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{meta.label}</p>
            <p className={`mt-2 text-3xl font-black ${meta.color}`}>
              {meta.sign}{fmtTxAmount(selected.amount, selected.currency)}
            </p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${
              selected.status === "COMPLETED"
                ? "bg-emerald-400/10 text-emerald-400"
                : selected.status === "FAILED"
                  ? "bg-red-400/10 text-red-400"
                  : "bg-amber-400/10 text-amber-400"
            }`}>
              {txStatusLabel(selected)}
            </span>
          </div>

          <div className="space-y-0 border-t border-white/[0.06] px-5 py-2">
            {[
              { label: "Date and time", value: new Date(selected.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) },
              { label: "Payment method", value: selected.provider ? selected.provider.replace(/_/g, " ").toUpperCase() : "Nezeem wallet" },
              ...context,
              { label: "Reference", value: selected.reference ?? selected.id },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-3.5 last:border-0">
                <span className="text-xs font-bold text-slate-500">{row.label}</span>
                <span className="max-w-[65%] break-all text-right text-xs font-black text-slate-200">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-left-2 fade-in space-y-2 duration-200">
      {txns.map((t) => {
        const meta = TXN_META[t.type] ?? { label: t.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
        return (
          <button
            type="button"
            key={t.id}
            onClick={() => setSelected(t)}
            className="flex w-full items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 text-left ring-1 ring-white/[0.06] transition hover:bg-[#1b1d24] hover:ring-white/[0.12] active:scale-[0.99]"
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
                {meta.sign}{fmtTxAmount(t.amount, t.currency)}
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
                {txStatusLabel(t)}
              </p>
            </div>
            <Icon name="chevron_right" className="text-[18px] text-slate-700" />
          </button>
        );
      })}
    </div>
  );
}


// ─── Crypto deposit panel (wallet page) ───────────────────────────────────────

const CRYPTO_DEPOSIT_ASSETS = [
  { name: "Tether USD", code: "USDT",  network: "TRC20",   displayNet: "TRC-20 (Tron)", min: 10 },
  { name: "Tether USD", code: "USDT",  network: "ERC20",   displayNet: "ERC-20 (ETH)",  min: 10 },
  { name: "Tether USD", code: "USDT",  network: "BEP20",   displayNet: "BEP-20 (BSC)",  min: 10 },
  { name: "USD Coin",   code: "USDC",  network: "POLYGON", displayNet: "Polygon",       min: 10 },
  { name: "USD Coin",   code: "USDC",  network: "ERC20",   displayNet: "ERC-20 (ETH)",  min: 10 },
  { name: "Bitcoin",    code: "BTC",   network: "BITCOIN", displayNet: "Bitcoin",       min: 0.0001 },
  { name: "Ethereum",   code: "ETH",   network: "ERC20",   displayNet: "ERC-20 (ETH)",  min: 0.001 },
  { name: "BNB",        code: "BNB",   network: "BEP20",   displayNet: "BEP-20 (BSC)",  min: 0.005 },
] as const;

type CryptoAddrPhase =
  | { phase: "checking" }
  | { phase: "generating" }
  | { phase: "form"; error?: string }
  | { phase: "ready"; address: string };

function CryptoDepositPanel() {
  const [idx, setIdx]       = useState(0);
  const [assetOpen, setAssetOpen] = useState(false);
  const [addr, setAddr]     = useState<CryptoAddrPhase>({ phase: "checking" });
  const [copied, setCopied] = useState(false);
  const asset = CRYPTO_DEPOSIT_ASSETS[idx];

  const load = useCallback(async (code: string, net: string) => {
    setAddr({ phase: "checking" });
    try {
      const res  = await fetch(`/api/crypto/address?crypto=${code}&network=${net}`);
      const data = await res.json();
      if (data?.address) { setAddr({ phase: "ready", address: data.address as string }); return; }
    } catch { /* fall through to generate */ }
    setAddr({ phase: "generating" });
    try {
      const res  = await fetch("/api/crypto/address", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crypto: code, network: net }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to generate address");
      setAddr({ phase: "ready", address: data.address as string });
    } catch (e: unknown) {
      setAddr({ phase: "form", error: e instanceof Error ? e.message : "Failed to generate address" });
    }
  }, []);

  useEffect(() => { load(asset.code, asset.network); }, [asset.code, asset.network, load]);

  async function copy() {
    if (addr.phase !== "ready") return;
    try {
      await navigator.clipboard.writeText(addr.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="space-y-4">
      {/* Asset selector */}
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Select asset & network</p>
        <div className="relative">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => setAssetOpen((o) => !o)}
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]"
          >
            <span className="flex items-center gap-3">
              {COIN_ICON_URL[asset.code] && (
                <img src={COIN_ICON_URL[asset.code]} alt={asset.code} width={28} height={28} className="h-7 w-7 rounded-full" />
              )}
              <span className="block text-sm font-black text-white">
                {asset.code}
                <span className="ml-2 text-[11px] font-bold text-slate-500">{asset.displayNet}</span>
              </span>
            </span>
            <Icon name={assetOpen ? "expand_less" : "expand_more"} className="text-[22px] text-slate-500" />
          </button>

          {/* Dropdown */}
          {assetOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto rounded-2xl bg-[#121824] shadow-2xl shadow-black/40 ring-1 ring-white/[0.09]">
              {CRYPTO_DEPOSIT_ASSETS.map((a, i) => (
                <button
                  key={`${a.code}-${a.network}`}
                  type="button"
                  onClick={() => { setIdx(i); setAssetOpen(false); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                >
                  {COIN_ICON_URL[a.code] && (
                    <img src={COIN_ICON_URL[a.code]} alt={a.code} width={28} height={28} className="h-7 w-7 rounded-full" />
                  )}
                  <span className="flex-1">
                    <span className="block text-sm font-black text-white">
                      {a.code}
                      <span className="ml-2 text-[11px] font-bold text-slate-500">{a.displayNet}</span>
                    </span>
                    <span className="text-[10px] text-slate-600">min {a.min} {a.code}</span>
                  </span>
                  {asset.code === a.code && asset.network === a.network && (
                    <Icon name="check_circle" fill className="text-[18px] text-[#f59e0b]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Network badge + min */}
      <div className="flex h-11 w-full items-center justify-between rounded-xl bg-white/[0.06] px-4 ring-1 ring-white/[0.08]">
        <span className="text-sm font-black text-white">{asset.displayNet}</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-400">{asset.network}</span>
      </div>
      <p className="-mt-2 text-xs font-bold text-slate-500">
        Minimum deposit: <span className="text-white">{asset.min} {asset.code}</span>
        <span className="ml-1 text-slate-600">· amounts below will not be credited</span>
      </p>

      {/* Address */}
      {addr.phase === "checking" ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/[0.06] py-6 ring-1 ring-white/[0.08]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-[#f59e0b]" />
          <span className="text-xs font-bold text-slate-500">Checking for your address…</span>
        </div>
      ) : addr.phase === "form" || addr.phase === "generating" ? (
        <div className="space-y-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/[0.08]">
          {addr.phase === "form" && addr.error && <p className="text-xs font-bold text-red-400">{addr.error}</p>}
          <button
            type="button"
            onClick={() => load(asset.code, asset.network)}
            disabled={addr.phase === "generating"}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f59e0b] text-sm font-black text-black transition hover:bg-[#f7af2e] disabled:opacity-60"
          >
            {addr.phase === "generating"
              ? <LoadingDots label="Generating" />
              : <><Icon name="qr_code" className="text-[16px]" /> Get deposit address</>}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/[0.08] sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(addr.address)}&bgcolor=ffffff&color=000000&margin=8&qzone=1`}
            alt="Deposit QR code"
            width={88}
            height={88}
            className="h-[88px] w-[88px] shrink-0 self-center rounded-lg"
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm font-black text-white">Deposit address</p>
            <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-slate-400">
              <span className="font-black text-white">{addr.address.slice(0, 6)}</span>
              {addr.address.slice(6, -5)}
              <span className="font-black text-white">{addr.address.slice(-5)}</span>
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-400/70 sm:justify-start">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Detected automatically · credited within 1–5 min
            </p>
            <button
              type="button"
              onClick={copy}
              className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-4 text-xs font-black text-black transition hover:bg-[#f7af2e]"
            >
              <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
              {copied ? "Copied!" : "Copy address"}
            </button>
          </div>
        </div>
      )}

      {addr.phase === "ready" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-400/8 px-4 py-3 ring-1 ring-amber-400/15">
          <Icon name="info" fill className="mt-0.5 shrink-0 text-[16px] text-amber-400" />
          <p className="text-xs font-bold text-amber-300/80">
            Send only <strong>{asset.code}</strong> on the <strong>{asset.displayNet}</strong> network to this address. Sending other assets may result in permanent loss.
          </p>
        </div>
      )}
    </div>
  );
}

