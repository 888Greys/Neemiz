"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { LoadingDots } from "@/components/loading-dots";

const QUICK_AMOUNTS = [100, 250, 500, 1_000, 2_500, 5_000];
const POLL_INTERVAL = 4_000;
const MAX_POLLS     = 30;

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
  { name: "Tether USD",       code: "USDT",  network: "TRC20",   displayNet: "TRC-20",  min: 10      },
  { name: "Tether USD",       code: "USDT",  network: "ERC20",   displayNet: "ERC-20",  min: 10      },
  { name: "Tether USD",       code: "USDT",  network: "BEP20",   displayNet: "BEP-20",  min: 10      },
  { name: "USD Coin",         code: "USDC",  network: "ERC20",   displayNet: "ERC-20",  min: 10      },
  { name: "USD Coin",         code: "USDC",  network: "POLYGON", displayNet: "Polygon", min: 10      },
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

// Cryptos a user can sell KES into — must have a live spot rate (lib/p2p/spot.ts).
const SELL_SPOT_CRYPTOS = ["USDT", "USDC", "BTC", "ETH", "BNB"];
const SELL_ASSETS = CRYPTO_WITHDRAW_ASSETS.filter((a) => SELL_SPOT_CRYPTOS.includes(a.code));

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
  const [tab, setTab]                     = useState<"deposit" | "withdraw" | "sell" | "history">("deposit");
  const [depositMethod, setDepositMethod] = useState<"mpesa" | "crypto">("mpesa");
  const [amount, setAmount]               = useState("");
  const [phone, setPhone]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [deposit, setDeposit]             = useState<DepositState>({ step: "idle" });

  // ── crypto balance state ──
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);

  // ── crypto withdraw state ──
  const [withdrawMode, setWithdrawMode] = useState<"crypto" | "fiat">("crypto");
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
  const [wdDone, setWdDone]     = useState<{ payout: number; fee: number } | null>(null);

  // ── Sell KES → crypto state ──
  const [sellAsset, setSellAsset]     = useState<CryptoWithdrawAsset>(SELL_ASSETS[0]);
  const [sellKes, setSellKes]         = useState("");
  const [sellAddress, setSellAddress] = useState("");
  const [sellOpen, setSellOpen]       = useState(false);
  const [sellRate, setSellRate]       = useState<number | null>(null);
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError]     = useState("");
  const [sellDone, setSellDone]       = useState<{ cryptoAmount: number; crypto: string } | null>(null);

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
      const res  = await fetch("/api/wallet/deposit/megapay", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: normalizeMsisdn(phone), amount: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to initiate payment.");
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
      const data = await res.json() as { ok?: boolean; payout?: number; fee?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
      setWdDone({ payout: data.payout!, fee: data.fee! });
      refreshBalance();
    } catch (err) {
      setWdError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setWdLoading(false);
    }
  }

  // Live spot rate for the selected sell asset (KES per 1 crypto)
  useEffect(() => {
    let cancelled = false;
    setSellRate(null);
    fetch(`/api/p2p/spot?crypto=${sellAsset.code}&fiat=KES`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rate?: number } | null) => { if (!cancelled) setSellRate(d?.rate ?? null); })
      .catch(() => { if (!cancelled) setSellRate(null); });
    return () => { cancelled = true; };
  }, [sellAsset.code]);

  async function handleSell() {
    if (!isSignedIn) { openLogin(); return; }
    const amt = Number(sellKes);
    if (!amt || !sellAddress.trim()) return;
    setSellLoading(true); setSellError("");
    try {
      const res  = await fetch("/api/wallet/sell", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountKes: amt, crypto: sellAsset.code, network: sellAsset.network, address: sellAddress.trim() }),
      });
      const data = await res.json() as { ok?: boolean; cryptoAmount?: number; crypto?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sale failed");
      setSellDone({ cryptoAmount: data.cryptoAmount!, crypto: data.crypto! });
      refreshBalance();
    } catch (err) {
      setSellError(err instanceof Error ? err.message : "Sale failed");
    } finally {
      setSellLoading(false);
    }
  }

  // Estimated crypto received for the entered KES (5% fee, matches server)
  const sellEstimate = (() => {
    const amt = Number(sellKes);
    if (!amt || !sellRate || sellRate <= 0) return null;
    return ((amt * 0.95) / sellRate);
  })();

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
      <div className="relative overflow-hidden bg-gradient-to-br from-[#051b35] via-[#091522] to-[#0d0e11] px-6 pb-5 pt-7 sm:pb-8 sm:pt-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#087cff]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#05b957]/8 blur-2xl" />

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

          {isSignedIn && (
            <>
              <div className="mt-3.5 flex justify-center gap-2 sm:mt-5">
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
          {(["deposit", "withdraw", "sell", "history"] as const).map((t) => (
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
                name={t === "deposit" ? "add_circle" : t === "withdraw" ? "remove_circle" : t === "sell" ? "currency_exchange" : "history"}
                fill={tab === t}
                className="text-[15px]"
              />
              {t.charAt(0).toUpperCase() + t.slice(1)}
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
                    className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 ring-1 transition ${depositMethod === "mpesa" ? "bg-[#05b957]/10 ring-[#05b957]/40" : "bg-[#16171d] ring-white/[0.07] hover:bg-white/[0.04]"}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${depositMethod === "mpesa" ? "bg-[#05b957]/20" : "bg-white/[0.06]"}`}>
                      <Icon name="phone_iphone" fill className={`text-[18px] ${depositMethod === "mpesa" ? "text-[#05b957]" : "text-slate-500"}`} />
                    </div>
                    <div className="text-left">
                      <p className={`text-[12px] font-black ${depositMethod === "mpesa" ? "text-white" : "text-slate-400"}`}>M-Pesa</p>
                      <p className="text-[10px] text-slate-600">STK Push</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod("crypto")}
                    className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 ring-1 transition ${depositMethod === "crypto" ? "bg-[#f59e0b]/10 ring-[#f59e0b]/40" : "bg-[#16171d] ring-white/[0.07] hover:bg-white/[0.04]"}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${depositMethod === "crypto" ? "bg-[#f59e0b]/20" : "bg-white/[0.06]"}`}>
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
                  className="w-full rounded-2xl bg-[#05b957] py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
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

            {/* ── M-Pesa withdraw ── */}
            {withdrawMode === "fiat" && (
              <div className="space-y-5">
                {wdDone ? (
                  <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-white/[0.07] text-center space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#05b957]/15">
                      <Icon name="check_circle" className="text-[32px] text-[#05b957]" />
                    </div>
                    <h3 className="text-lg font-black text-white">Withdrawal Submitted</h3>
                    <p className="text-sm text-slate-500">
                      <span className="text-white font-bold">KSh {wdDone.payout.toLocaleString()}</span> is being sent to your M-Pesa.
                      <br />Fee: KSh {wdDone.fee.toLocaleString()}
                    </p>
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
                        <span className="font-bold text-slate-300">5% fee</span> is deducted. Min KSh 50 · Max KSh 150,000.
                        Money arrives within 1–5 minutes via Safaricom M-Pesa.
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Amount (KSh)</p>
                      <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#05b957]/40 transition">
                        <span className="shrink-0 text-sm font-black text-slate-500">KSh</span>
                        <input
                          type="number"
                          min="50"
                          max="150000"
                          value={wdAmount}
                          onChange={(e) => { setWdAmount(e.target.value); setWdError(""); }}
                          placeholder="Enter amount"
                          className="flex-1 bg-transparent py-4 text-base font-black text-white outline-none placeholder:text-slate-700"
                        />
                        {wdAmount && Number(wdAmount) >= 50 && (
                          <span className="shrink-0 text-xs text-slate-600">
                            → KSh {(Number(wdAmount) * 0.95).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">M-Pesa Number</p>
                      <div className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#05b957]/40 transition">
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
                      disabled={wdLoading || !wdAmount || Number(wdAmount) < 50 || !wdPhone.trim()}
                      className="w-full rounded-2xl bg-[#05b957] py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-50"
                    >
                      {wdLoading ? (
                        <LoadingDots label="Processing" />
                      ) : (
                        `Withdraw${wdAmount && Number(wdAmount) >= 50 ? ` KSh ${Number(wdAmount).toLocaleString()}` : ""} via M-Pesa`
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SELL TAB (KES → crypto) ── */}
        {tab === "sell" && (
          <div className="space-y-5">
            {sellDone ? (
              <div className="rounded-3xl bg-[#16171d] p-7 ring-1 ring-violet-500/25 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/12 ring-1 ring-violet-500/20">
                  <Icon name="schedule" fill className="text-[44px] text-violet-400" />
                </div>
                <h2 className="text-2xl font-black text-white">Sale Submitted</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Your KES has been held. We&apos;ll send{" "}
                  <span className="font-bold text-violet-300">≈ {sellDone.cryptoAmount} {sellDone.crypto}</span>{" "}
                  to your address shortly (usually within a few hours).
                </p>
                <button
                  type="button"
                  onClick={() => { setSellDone(null); setSellKes(""); setSellAddress(""); }}
                  className="mt-6 w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2a90ff]"
                >
                  Sell More
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-2xl bg-violet-500/[0.07] p-4 ring-1 ring-violet-500/15">
                  <Icon name="currency_exchange" fill className="mt-0.5 text-[18px] text-violet-400" />
                  <p className="text-[12px] leading-relaxed text-slate-400">
                    Sell your KES balance for crypto and withdraw it to your own wallet. We send the
                    crypto to your address after a quick review.
                  </p>
                </div>

                {/* KES amount */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Amount to sell (KES)</p>
                    <button
                      type="button"
                      onClick={() => setSellKes(String(Math.floor(balance)))}
                      className="text-[10px] font-black uppercase tracking-wider text-[#087cff] hover:text-[#2a90ff]"
                    >
                      Max · KSh {balance.toLocaleString("en-KE")}
                    </button>
                  </div>
                  <div className="flex h-14 items-center rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] focus-within:ring-violet-500/40">
                    <span className="mr-2 text-sm font-black text-slate-500">KSh</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={sellKes}
                      onChange={(e) => setSellKes(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent text-lg font-black text-white outline-none placeholder:text-slate-700"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSellKes(String(q))}
                        className="rounded-xl bg-white/[0.04] px-3 py-1.5 text-[11px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:text-white"
                      >
                        {q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crypto asset selector */}
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">Receive as</p>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSellOpen((o) => !o)}
                      className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-3">
                        {COIN_ICON_URL[sellAsset.code] && (
                          <img src={COIN_ICON_URL[sellAsset.code]} alt={sellAsset.code} width={28} height={28} className="h-7 w-7 rounded-full" />
                        )}
                        <span className="block text-sm font-black text-white">
                          {sellAsset.code}
                          <span className="ml-2 text-[11px] font-bold text-slate-500">{sellAsset.displayNet}</span>
                        </span>
                      </span>
                      <Icon name={sellOpen ? "expand_less" : "expand_more"} className="text-[22px] text-slate-500" />
                    </button>
                    {sellOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl bg-[#121824] shadow-2xl shadow-black/40 ring-1 ring-white/[0.09]">
                        {SELL_ASSETS.map((a) => (
                          <button
                            key={`${a.code}:${a.network}`}
                            type="button"
                            onClick={() => { setSellAsset(a); setSellOpen(false); }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                          >
                            {COIN_ICON_URL[a.code] && (
                              <img src={COIN_ICON_URL[a.code]} alt={a.code} width={28} height={28} className="h-7 w-7 rounded-full" />
                            )}
                            <span className="flex-1 block text-sm font-black text-white">
                              {a.code}
                              <span className="ml-2 text-[11px] font-bold text-slate-500">{a.displayNet}</span>
                            </span>
                            {sellAsset.code === a.code && sellAsset.network === a.network && (
                              <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Destination address */}
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Your {sellAsset.code} address ({sellAsset.displayNet})
                  </p>
                  <input
                    type="text"
                    value={sellAddress}
                    onChange={(e) => setSellAddress(e.target.value)}
                    placeholder={`Paste your ${sellAsset.code} wallet address`}
                    className="h-14 w-full rounded-2xl bg-[#16171d] px-4 font-mono text-[13px] text-white outline-none ring-1 ring-white/[0.07] transition focus:ring-violet-500/40 placeholder:font-sans placeholder:text-slate-700"
                  />
                </div>

                {/* Estimate */}
                <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-500">You receive (after 5% fee)</span>
                    <span className="font-black text-white">
                      {sellEstimate != null ? `≈ ${sellEstimate.toFixed(6)} ${sellAsset.code}` : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Live rate</span>
                    <span className="text-slate-500">
                      {sellRate ? `1 ${sellAsset.code} ≈ KSh ${sellRate.toLocaleString("en-KE", { maximumFractionDigits: 2 })}` : "fetching…"}
                    </span>
                  </div>
                </div>

                {sellError && (
                  <p className="rounded-xl bg-red-500/10 px-4 py-3 text-[12px] font-bold text-red-400 ring-1 ring-red-500/20">{sellError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSell}
                  disabled={sellLoading || !Number(sellKes) || !sellAddress.trim() || !sellRate}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sellLoading ? <LoadingDots /> : `Sell KSh ${Number(sellKes || 0).toLocaleString()} for ${sellAsset.code}`}
                </button>
              </>
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

const KES_CURRENCIES = new Set(["KES"]);

function fmtTxAmount(amount: number, currency: string): string {
  if (KES_CURRENCIES.has(currency)) {
    return `KSh ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Crypto — show up to 6 decimals, strip trailing zeros
  const decimals = ["BTC", "ETH"].includes(currency) ? 8 : 6;
  return `${amount.toFixed(decimals).replace(/\.?0+$/, "")} ${currency}`;
}

function TransactionHistory({ isSignedIn }: { isSignedIn: boolean }) {
  const [txns, setTxns] = useState<
    Array<{ id: string; type: string; amount: number; currency: string; status: string; provider?: string; createdAt: string }>
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
                {t.status}
              </p>
            </div>
          </div>
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
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="h-12 w-full appearance-none rounded-2xl bg-[#16171d] pl-4 pr-10 text-sm font-black text-white outline-none ring-1 ring-white/[0.07] transition focus:ring-[#f59e0b]/50"
          >
            {CRYPTO_DEPOSIT_ASSETS.map((a, i) => (
              <option key={`${a.code}-${a.network}`} value={i} className="bg-[#16171d]">
                {a.code} · {a.displayNet}
              </option>
            ))}
          </select>
          <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-500" />
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

