"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { stepUpWithPasskey } from "@/lib/passkey-client";
import { DEV_AUTH_PUBLIC } from "@/lib/dev-auth";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { LoadingDots } from "@/components/loading-dots";
import { PhoneVerifyModal } from "@/components/phone-verify-modal";
import { NOTIFICATIONS_REFRESH_EVENT } from "@/components/notifications-dropdown";
import { cachedFetch, getCached } from "@/lib/client-cache";
import { CURRENCY_SYMBOL, MONEY_LOCALE, WITHDRAWAL_FEE_RATE, WITHDRAWAL_FEE_PCT } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { CurrencySwitcher } from "@/components/currency-switcher";
import {
  CRYPTO_DEPOSIT_ASSETS,
  depositRowsForCurrency,
  type CryptoAssetGroup,
  type DepositSelection,
} from "@/lib/wallet-deposit-options";
import { MARKETS } from "@/lib/payments/country-methods";
import { PaymentBrandLogo } from "@/components/payment-brand-logo";
import {
  CRYPTO_WITHDRAW_ASSETS,
  type CryptoWithdrawAsset,
} from "@/lib/wallet-withdraw-options";

const POLL_INTERVAL = 4_000;
const MAX_POLLS     = 30;
/** Matches server `MAX_TRANSFER_KES` in `/api/wallet/transfer`. */
const MAX_TRANSFER_KES = 50;

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

// Real brand + coin logos for the payment-method list. Coins reuse the
// cryptocurrency-icons set for coin marks used in withdraw / history rows.
const BRAND_ICON_URL: Record<string, string> = {
  ...COIN_ICON_URL,
};

const BRAND_LABEL: Record<string, string> = {
  VISA: "VISA", MC: "MC", AIRTEL: "Airtel", MPESA: "M-Pesa",
  SKRILL: "Skrill", NETELLER: "Neteller", BINANCE: "BNB", BANK: "Bank",
};

/** @deprecated Prefer PaymentBrandLogo */
function PaymentIcon({ badge }: { badge: string }) {
  return <PaymentBrandLogo code={badge === "MC" ? "MASTERCARD" : badge} size={32} />;
}

type CryptoBalance = { crypto: string; network: string; available: number; locked: number; usdtValue?: number | null };

function parseCryptoBalancePayload(data: unknown): { balances: CryptoBalance[]; totalUsdt: number } {
  // New shape: { balances, totalUsdt }. Legacy: bare array.
  if (Array.isArray(data)) {
    const balances = data.map((b: { crypto: string; network: string; available: string | number; locked: string | number; usdtValue?: number | null }) => ({
      crypto: b.crypto,
      network: b.network,
      available: Number(b.available),
      locked: Number(b.locked),
      usdtValue: b.usdtValue == null ? null : Number(b.usdtValue),
    }));
    return { balances, totalUsdt: 0 };
  }
  if (data && typeof data === "object" && Array.isArray((data as { balances?: unknown }).balances)) {
    const body = data as { balances: Array<{ crypto: string; network: string; available: string | number; locked: string | number; usdtValue?: number | null }>; totalUsdt?: number };
    return {
      balances: body.balances.map((b) => ({
        crypto: b.crypto,
        network: b.network,
        available: Number(b.available),
        locked: Number(b.locked),
        usdtValue: b.usdtValue == null ? null : Number(b.usdtValue),
      })),
      totalUsdt: Number(body.totalUsdt ?? 0),
    };
  }
  return { balances: [], totalUsdt: 0 };
}

type DepositState =
  | { step: "idle" }
  | { step: "pending"; txId: string; amount: number; via?: "mpesa" | "pesapal" }
  | { step: "confirmed"; amount: number; newBalance: number; receipt: string }
  | { step: "failed"; message: string };

// Card / international deposits via Pesapal. Off by default — only rendered
// where NEXT_PUBLIC_PESAPAL_ENABLED=true (and the server has PESAPAL_* creds),
// so the option never shows a broken button in environments without Pesapal.
const PESAPAL_ENABLED = process.env.NEXT_PUBLIC_PESAPAL_ENABLED === "true";

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

type WalletTab = "home" | "deposit" | "send" | "withdraw" | "history";

export function WalletClient({ wide = false, initialTab = "home" }: { wide?: boolean; initialTab?: WalletTab } = {}) {
  const { isSignedIn, user } = useSupabaseAuth();
  const { openLogin }        = useAuthModal();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();
  // Display currency (header switcher). KES balances render in the chosen
  // currency; M-Pesa amounts stay KES below (it's a Kenya-only rail).
  const { format: formatDisplay, code: displayCurrency } = useCurrency();

  // ── fiat deposit state ──
  const [tab, setTab]                     = useState<WalletTab>(initialTab);
  // Non-KES users default to the crypto rail — M-Pesa only serves Kenya/KES.
  const [depositMethod, setDepositMethod] = useState<"mpesa" | "crypto" | "pesapal">(displayCurrency === "KES" ? "mpesa" : "crypto");
  // Deposit is a two-step flow: pick a method, press Continue, then fill details.
  const [depositStep, setDepositStep]     = useState<"method" | "detail">("method");
  const [depositAssetGroup, setDepositAssetGroup] = useState<CryptoAssetGroup>("USDT");
  const [amount, setAmount]               = useState("");
  const [phone, setPhone]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [deposit, setDeposit]             = useState<DepositState>({ step: "idle" });

  // ── crypto balance state ──
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [cryptoTotalUsdt, setCryptoTotalUsdt] = useState(0);

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

  // ── Step-up auth (password / passkey) for withdraw + send ──
  const [stepUpOpen, setStepUpOpen]   = useState(false);
  const [stepUpPw, setStepUpPw]       = useState("");
  const [stepUpError, setStepUpError] = useState("");
  const [stepUpBusy, setStepUpBusy]   = useState(false);
  const [stepUpShowPw, setStepUpShowPw] = useState(false);
  const [stepUpAction, setStepUpAction] = useState<"withdraw" | "send" | "cryptoWithdraw">("withdraw");
  const [pendingSend, setPendingSend] = useState<{ recipientId: string; amount: number; recipient: TransferRecipient } | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendAlreadySent, setSendAlreadySent] = useState<{
    recipient: string; priorAmount: number | null; from: string; sentAt: string | null;
  } | null>(null);
  const [sendReceipt, setSendReceipt] = useState<TransferReceipt | null>(null);

  // ── Withdrawal allowance (rolling 24h window) + phone-verification state ──
  const [wdLimit, setWdLimit] = useState<{
    limit: number; used: number; remaining: number; resetsAt: string | null;
    phoneVerifyRequired?: boolean; phoneVerified?: boolean; boundPhone?: string | null;
  } | null>(null);
  const loadWdLimit = useCallback(() => {
    fetch("/api/wallet/withdraw", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || typeof d.remaining !== "number") return;
        setWdLimit(d);
        // Once a number is bound (first withdrawal / mpesa / SMS verify), it is
        // locked for life — prefill it and render the field read-only. Does NOT
        // depend on Twilio/phoneVerified, so the lock holds even without SMS.
        if (d.boundPhone) {
          setWdPhone(d.boundPhone.startsWith("254") ? `0${d.boundPhone.slice(3)}` : d.boundPhone);
        }
      })
      .catch(() => {});
  }, []);

  // ── First-withdrawal SMS verification modal ──
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);
  const phoneLocked = Boolean(wdLimit?.boundPhone);

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

  // Load the daily withdrawal/transfer allowance whenever the withdraw or send tab is shown.
  useEffect(() => {
    if (isSignedIn && (tab === "withdraw" || tab === "send")) loadWdLimit();
  }, [isSignedIn, tab, loadWdLimit]);

  // Fetch crypto balances (+ combined USDT total for home)
  const fetchCryptoBalances = () => {
    fetch("/api/crypto/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!data) return;
        const { balances, totalUsdt } = parseCryptoBalancePayload(data);
        setCryptoBalances(balances);
        setCryptoTotalUsdt(totalUsdt);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isSignedIn) return;
    fetchCryptoBalances();
  }, [isSignedIn]);

  // Warm the deposit address(es) as soon as Deposit opens, so the address + QR
  // are already resolved by the time the user reaches the crypto detail view.
  useEffect(() => {
    if (!isSignedIn || tab !== "deposit") return;
    for (const a of CRYPTO_DEPOSIT_ASSETS) if (a.enabled) prefetchDepositAddress(a.code, a.network);
  }, [isSignedIn, tab]);

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
    // Returning from Pesapal's hosted page can land with a momentarily stale
    // session cookie (the balance is already credited server-side by
    // /api/wallet/pesapal/return, so this only affects what THIS tab can read).
    // If the status poll 401s, refresh the session once before giving up.
    let refreshTriedOn401 = false;
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(pollRef.current!);
        // Pesapal deposits are credited server-side on return, so a slow poll is
        // not a failure — reassure rather than alarm. M-Pesa timeouts usually
        // mean the STK prompt was never completed.
        refreshBalance();
        setDeposit({
          step:    "failed",
          message: deposit.via === "pesapal"
            ? "Payment received — your balance will update shortly."
            : "Payment timed out. If you paid, it will be credited shortly.",
        });
        return;
      }
      try {
        const res  = await fetch("/api/wallet/deposit/status", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ transactionRequestId: txId }),
        });
        if (res.status === 401 && !refreshTriedOn401) {
          refreshTriedOn401 = true;
          await createClient().auth.refreshSession().catch(() => {});
          return; // retry on the next tick with the refreshed session
        }
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          refreshBalance();
          setDeposit({
            step:       "confirmed",
            amount:     (data.amount as number) ?? deposit.amount,
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

  // Card / international deposit: create a Pesapal order, then hand off to the
  // hosted checkout page. Payment happens on Pesapal; on return the callback
  // lands on /wallet?pesapal_order_id=<txnId>, which the effect below picks up.
  async function handlePesapalDeposit() {
    if (!isSignedIn) { openLogin(); return; }
    if (Number(amount) < 10)  { setError("Minimum card deposit is KSh 10."); return; }
    if (Number(amount) > 50)  { setError("Card payments are in test mode — maximum KSh 50 for now."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/wallet/pesapal/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountKes: Number(amount) }),
      });
      const data = await res.json().catch(() => ({} as { error?: string; redirectUrl?: string }));
      if (!res.ok || !data.redirectUrl) {
        throw new Error((data as { error?: string }).error ?? "Could not start card payment — please try again.");
      }
      window.location.href = data.redirectUrl as string;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  // Return from the Pesapal checkout page: verify + credit, then clean the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get("pesapal_order_id");
    if (!orderId) return;
    setTab("deposit");
    setDeposit({ step: "pending", txId: orderId, amount: 0, via: "pesapal" });
    // Strip the query param so a refresh doesn't re-trigger this.
    params.delete("pesapal_order_id");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignedIn) { openLogin(); return; }
    if (Number(amount) < 100) { setError("Minimum deposit is KSh 100."); return; }
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

  // Crypto is irreversible — require a fresh password/passkey confirmation before
  // the payout is signed and broadcast (mirrors the M-Pesa withdraw / send flow).
  function requestCryptoWithdraw() {
    if (!isSignedIn) { openLogin(); return; }
    const amt = Number(cwAmount);
    if (!cwAddress.trim() || !amt) return;
    if (amt < cwAsset.min) {
      setCwState({ step: "error", message: `Minimum withdrawal is ${cwAsset.min} ${cwAsset.code}` });
      return;
    }
    setStepUpAction("cryptoWithdraw");
    if (DEV_AUTH_PUBLIC) { void handleCryptoWithdraw(); return; } // no Supabase in dev
    setStepUpPw(""); setStepUpError(""); setStepUpOpen(true);
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
      // Parse defensively: on a gateway/CDN hiccup the body can be an HTML error
      // page, not JSON — surface a clear message instead of a raw "Unexpected
      // token '<'" parse error.
      const data = await res.json().catch(() => null) as
        { txId?: string; payoutId?: string; error?: string; ok?: boolean; stepUpRequired?: boolean } | null;
      if (!data) {
        throw new Error("Withdrawal is taking longer than expected — check your transaction history before retrying.");
      }
      // Step-up proof missing/expired: re-open the confirm sheet so the user
      // re-verifies, then retries.
      if (res.status === 401 && data.stepUpRequired) {
        setCwState({ step: "idle" });
        setStepUpAction("cryptoWithdraw");
        setStepUpPw(""); setStepUpError("Please confirm it's you again."); setStepUpOpen(true);
        return;
      }
      if (!res.ok || data.error || data.ok === false) {
        throw new Error(data.error ?? "Withdrawal failed");
      }
      setCwState({ step: "success", txId: data.txId as string, payoutId: data.payoutId as string });
      fetchCryptoBalances();
    } catch (err: unknown) {
      setCwState({
        step:    "error",
        message: err instanceof Error ? err.message : "Withdrawal failed",
      });
    }
  }

  // Step-up auth: M-Pesa withdrawals and wallet sends must be confirmed with
  // the account password or a passkey before any money moves.
  function requestMpesaWithdraw() {
    if (!isSignedIn) { openLogin(); return; }
    const amt = Number(wdAmount);
    if (!wdPhone.trim() || !amt) return;
    setWdError("");
    setStepUpAction("withdraw");
    if (DEV_AUTH_PUBLIC) { void handleMpesaWithdraw(); return; } // no Supabase in dev
    setStepUpPw(""); setStepUpError(""); setStepUpOpen(true);
  }

  function requestSendTransfer(next: { recipient: TransferRecipient; amount: number }) {
    if (!isSignedIn) { openLogin(); return; }
    setSendError("");
    setSendAlreadySent(null);
    setPendingSend({ recipientId: next.recipient.id, amount: next.amount, recipient: next.recipient });
    setStepUpAction("send");
    if (DEV_AUTH_PUBLIC) {
      void executeTransfer(next.recipient, next.amount);
      return;
    }
    setStepUpPw(""); setStepUpError(""); setStepUpOpen(true);
  }

  async function executeTransfer(recipient: TransferRecipient, amount: number) {
    setSendBusy(true);
    setSendError("");
    setSendAlreadySent(null);
    try {
      const response = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, amount }),
      });
      const data = await response.json().catch(() => ({})) as {
        ok?: boolean;
        reference?: string;
        error?: string;
        stepUpRequired?: boolean;
        alreadySent?: boolean;
        code?: string;
        recipient?: string;
        priorAmount?: number | null;
        from?: string;
        sentAt?: string | null;
      };
      if (response.status === 401 && data.stepUpRequired) {
        setStepUpAction("send");
        setPendingSend({ recipientId: recipient.id, amount, recipient });
        setStepUpPw("");
        setStepUpError("Please confirm it's you again.");
        setStepUpOpen(true);
        return;
      }
      if (!response.ok) {
        if (data.alreadySent || data.code === "ADMIN_ONCE_EVER") {
          setSendAlreadySent({
            recipient: data.recipient ?? recipient.username,
            priorAmount: typeof data.priorAmount === "number" ? data.priorAmount : null,
            from: data.from ?? "an admin",
            sentAt: data.sentAt ?? null,
          });
          return;
        }
        throw new Error(data.error ?? "Transfer failed");
      }
      setSendReceipt({
        amount,
        recipient,
        reference: typeof data.reference === "string" ? data.reference : "Completed",
      });
      setPendingSend(null);
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      refreshBalance();
      loadWdLimit();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSendBusy(false);
    }
  }

  async function confirmWithPassword() {
    if (!stepUpPw) { setStepUpError("Enter your password."); return; }
    setStepUpBusy(true); setStepUpError("");
    try {
      const res = await fetch("/api/auth/stepup/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: stepUpPw }),
      });
      if (!res.ok) { setStepUpError("Incorrect password. Please try again."); return; }
      setStepUpOpen(false); setStepUpPw("");
      if (stepUpAction === "send" && pendingSend) {
        await executeTransfer(pendingSend.recipient, pendingSend.amount);
      } else if (stepUpAction === "cryptoWithdraw") {
        await handleCryptoWithdraw();
      } else {
        await handleMpesaWithdraw();
      }
    } catch {
      setStepUpError("Could not verify. Please try again.");
    } finally {
      setStepUpBusy(false);
    }
  }

  async function confirmWithPasskey() {
    setStepUpBusy(true); setStepUpError("");
    try {
      const { ok, noPasskey, error } = await stepUpWithPasskey();
      if (!ok) {
        setStepUpError(
          noPasskey
            ? "No passkey on this account. Add a sign-in passkey in Settings, or use your password."
            : (error ?? "Passkey check failed. Try again or use your password."),
        );
        return;
      }
      setStepUpOpen(false);
      if (stepUpAction === "send" && pendingSend) {
        await executeTransfer(pendingSend.recipient, pendingSend.amount);
      } else if (stepUpAction === "cryptoWithdraw") {
        await handleCryptoWithdraw();
      } else {
        await handleMpesaWithdraw();
      }
    } catch {
      setStepUpError("Passkey check failed. Try again or use your password.");
    } finally {
      setStepUpBusy(false);
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
      const data = await res.json().catch(() => ({})) as { ok?: boolean; payout?: number; fee?: number; queued?: boolean; pendingApproval?: boolean; message?: string; error?: string; needsPhoneVerification?: boolean; stepUpRequired?: boolean };
      // First-withdrawal SMS gate: open the verification modal and stop here. The
      // withdrawal resumes automatically once the number is verified (onVerified).
      if (res.status === 409 && data.needsPhoneVerification) {
        setPhoneVerifyOpen(true);
        return;
      }
      // Step-up proof missing/expired (e.g. it lapsed before this call): re-open
      // the confirm sheet so the user re-verifies, then retries.
      if (res.status === 401 && data.stepUpRequired) {
        setStepUpAction("withdraw");
        setStepUpPw(""); setStepUpError("Please confirm it's you again."); setStepUpOpen(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
      saveMpesaNumber(wdPhone); // remember this number for next time
      setWdDone({ payout: data.payout ?? amt, fee: data.fee ?? 0, queued: data.queued || data.pendingApproval, message: data.message });
      refreshBalance();
      loadWdLimit(); // refresh remaining allowance
    } catch (err) {
      setWdError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setWdLoading(false);
    }
  }

  function reset() { setDeposit({ step: "idle" }); setAmount(""); setError(""); pollCount.current = 0; }

  const fmtBalance = currency === "KES"
    ? formatDisplay(balance)
    : `${currency} ${balance.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}`;
  const kesCoinAvailable = currency === "KES" ? balance : 0;

  // Crypto balance for currently selected withdraw asset
  const cwBalance = cryptoBalances.find(
    (b) => b.crypto === cwAsset.code && b.network === cwAsset.network,
  );
  // Non-zero crypto balances for hero display
  const nonZeroBalances = cryptoBalances.filter((b) => b.crypto !== "KES" && (b.available > 0 || b.locked > 0));

  const activeTitle = tab.charAt(0).toUpperCase() + tab.slice(1);

  return (
    <div className={`w-full bg-[#151518] text-white ${wide ? "lg:min-h-[520px]" : "min-h-[calc(100dvh-8rem)]"}`}>
      {tab === "home" ? (
        <WalletHome
          balance={isSignedIn ? fmtBalance : "—"}
          cryptoBalances={nonZeroBalances}
          cryptoTotalUsdt={cryptoTotalUsdt}
          isSignedIn={!!isSignedIn}
          onLogin={openLogin}
          onOpen={(t) => { if (t === "deposit") setDepositStep("method"); setTab(t); }}
        />
      ) : (
        <WalletPageFrame
          title={activeTitle}
          onBack={() => {
            // Within Deposit, Back steps from the details view to the method list first.
            if (tab === "deposit" && depositStep === "detail") setDepositStep("method");
            else setTab("home");
          }}
        >

        {/* ── DEPOSIT TAB ── */}
        {tab === "deposit" && (
          <>
            {deposit.step === "confirmed" ? (
              <div className={STATUS_PANEL}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12">
                  <Icon name="check_circle" fill className="text-[32px] text-emerald-400" />
                </div>
                <h2 className="text-xl font-black text-white">Payment received</h2>
                <p className="mt-2 text-sm text-slate-400">
                  <span className="font-bold text-emerald-400">{CURRENCY_SYMBOL} {deposit.amount.toLocaleString()}</span>{" "}
                  added to your wallet
                </p>
                <div className="my-5 border-y border-white/[0.06] py-4">
                  <p className={FIELD_LABEL}>New balance</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {CURRENCY_SYMBOL} {deposit.newBalance.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {deposit.receipt && (
                  <p className="mb-5 text-xs text-slate-500">
                    M-Pesa ref: <span className="font-bold text-slate-300">{deposit.receipt}</span>
                  </p>
                )}
                <Button onClick={reset} className="h-12 w-full rounded-xl text-sm">
                  Deposit more
                </Button>
              </div>
            ) : deposit.step === "failed" ? (
              <div className={STATUS_PANEL}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/12">
                  <Icon name="cancel" fill className="text-[32px] text-red-400" />
                </div>
                <h2 className="text-xl font-black text-white">Payment failed</h2>
                <p className="mt-2 text-sm text-slate-400">{deposit.message}</p>
                <Button onClick={reset} variant="secondary" className="mt-6 h-12 w-full rounded-xl text-sm">
                  Try again
                </Button>
              </div>
            ) : deposit.step === "pending" ? (
              <div className={STATUS_PANEL}>
                <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center">
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#087cff]/70" />
                  <Icon name={deposit.via === "pesapal" ? "credit_card" : "phone_iphone"} fill className="text-[28px] text-[#087cff]" />
                </div>
                <h2 className="text-xl font-black text-white">
                  {deposit.via === "pesapal" ? "Verifying payment" : "Check your phone"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {deposit.via === "pesapal" ? (
                    <>Confirming your payment with Pesapal. This only takes a few seconds.</>
                  ) : (
                    <>An <span className="font-bold text-white">M-Pesa STK push</span> has been sent. Enter your PIN to complete.</>
                  )}
                </p>
                {deposit.amount > 0 && (
                  <div className="my-5 border-y border-white/[0.06] py-4">
                    <p className={FIELD_LABEL}>Amount</p>
                    <p className="mt-1 text-2xl font-black text-white">{CURRENCY_SYMBOL} {deposit.amount.toLocaleString()}</p>
                  </div>
                )}
                <div className={`flex items-center justify-center gap-2 text-xs font-bold text-amber-400 ${deposit.amount > 0 ? "" : "mt-5"}`}>
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
                  {deposit.via === "pesapal" ? "Checking with Pesapal…" : "Checking payment status…"}
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 text-xs font-semibold text-slate-500 transition hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : depositStep === "method" ? (
              /* ── Step 1: choose a payment method, then Continue ── */
              <DepositMethodStep
                pesapalEnabled={PESAPAL_ENABLED}
                displayCurrency={displayCurrency}
                onContinue={(sel) => {
                  if (sel.kind === "crypto") { setDepositMethod("crypto"); setDepositAssetGroup(sel.assetGroup); }
                  else setDepositMethod(sel.kind);
                  setError("");
                  setDepositStep("detail");
                }}
              />
            ) : (
              <div className="space-y-5">
                {/* ── Step 2: method-specific details ── */}
                {depositMethod === "crypto" && <CryptoDepositPanel group={depositAssetGroup} />}

                {depositMethod === "pesapal" && (
                  <div className="space-y-5">
                    <div className="flex items-start gap-2.5 rounded-xl bg-amber-400/8 px-4 py-3">
                      <Icon name="science" fill className="mt-0.5 shrink-0 text-[16px] text-amber-400" />
                      <p className="text-xs font-bold text-amber-400">
                        Card payments are in <span className="uppercase">test mode</span> — max <span className="font-black">KSh 50</span> for now while we finish setup.
                      </p>
                    </div>
                    <div>
                      <p className={FIELD_LABEL}>Amount (KSh)</p>
                      <div className={`${FIELD} focus-within:ring-[#05b957]/50`}>
                        <span className="shrink-0 text-sm font-black text-slate-500">{CURRENCY_SYMBOL}</span>
                        <input
                          type="number"
                          min="10"
                          max="50"
                          step="1"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="10 – 50"
                          required
                          className="flex-1 bg-transparent py-3.5 text-base font-black text-white outline-none placeholder:text-slate-700"
                        />
                        {amount && (
                          <button type="button" onClick={() => setAmount("")} className="text-slate-600 hover:text-slate-400">
                            <Icon name="close" className="text-[16px]" />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-slate-600">Test mode · KSh 10–50</p>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 px-4 py-3">
                        <Icon name="error" fill className="mt-0.5 shrink-0 text-[16px] text-red-400" />
                        <p className="text-xs font-bold text-red-400">{error}</p>
                      </div>
                    )}

                    <Button
                      onClick={() => void handlePesapalDeposit()}
                      disabled={loading || !amount}
                      className="h-12 w-full rounded-xl text-sm"
                    >
                      {loading ? (
                        <LoadingDots label="Opening secure checkout" />
                      ) : (
                        `Pay ${CURRENCY_SYMBOL} ${Number(amount || 0).toLocaleString() || "—"} by Card`
                      )}
                    </Button>

                    <p className="text-center text-[11px] text-slate-600">
                      Secure checkout by Pesapal · Visa, Mastercard &amp; Amex accepted
                    </p>
                  </div>
                )}

                {depositMethod === "mpesa" && (<>
                <div>
                  <p className={FIELD_LABEL}>
                    Amount (KSh)
                  </p>
                  <div className={FIELD}>
                    <span className="shrink-0 text-sm font-black text-slate-500">{CURRENCY_SYMBOL}</span>
                    <input
                      type="number"
                      min="100"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      required
                      className="flex-1 bg-transparent py-3.5 text-base font-black text-white outline-none placeholder:text-slate-700"
                    />
                    {amount && (
                      <button type="button" onClick={() => setAmount("")} className="text-slate-600 hover:text-slate-400">
                        <Icon name="close" className="text-[16px]" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-600">Minimum deposit: KSh 100</p>
                </div>

                {depositMethod === "mpesa" && (
                  <div>
                    <p className={FIELD_LABEL}>
                      Safaricom Number
                    </p>
                    <div className={FIELD}>
                      <span className="shrink-0 text-base">🇰🇪</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="07XXXXXXXX or 01XXXXXXXX"
                        required
                        className="flex-1 bg-transparent py-3.5 text-sm font-bold text-white outline-none placeholder:text-slate-700"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 px-4 py-3">
                    <Icon name="error" fill className="mt-0.5 shrink-0 text-[16px] text-red-400" />
                    <p className="text-xs font-bold text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  onClick={(e) => handleDeposit(e as unknown as React.FormEvent)}
                  disabled={loading || !amount || !phone}
                  className="h-12 w-full rounded-xl text-sm"
                >
                  {loading ? (
                    <LoadingDots label="Sending prompt" />
                  ) : (
                    `Deposit ${CURRENCY_SYMBOL} ${Number(amount || 0).toLocaleString() || "—"}`
                  )}
                </Button>

                <p className="text-center text-[11px] text-slate-600">
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
            wdLimit={wdLimit}
            sending={sendBusy}
            error={sendError}
            alreadySent={sendAlreadySent}
            receipt={sendReceipt}
            onClearReceipt={() => setSendReceipt(null)}
            onClearAlreadySent={() => setSendAlreadySent(null)}
            onRequestSend={requestSendTransfer}
          />
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === "withdraw" && (
          <div className="space-y-5">
            {/* Method toggle */}
            <div className="flex gap-6 border-b border-white/[0.06]">
              <button
                type="button"
                onClick={() => setWithdrawMode("crypto")}
                className={`relative pb-3 text-[14px] font-bold transition ${
                  withdrawMode === "crypto" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Crypto
                {withdrawMode === "crypto" && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#087cff]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMode("fiat")}
                className={`relative pb-3 text-[14px] font-bold transition ${
                  withdrawMode === "fiat" ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                M-Pesa
                {withdrawMode === "fiat" && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#087cff]" />
                )}
              </button>
            </div>

            {/* ── Crypto withdraw ── */}
            {withdrawMode === "crypto" && (
              <>
                {cwState.step === "success" ? (
                  <div className="animate-in fade-in duration-300 text-center">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Submitted</p>
                    <h2 className="mt-3 text-xl font-black text-white">Withdrawal in progress</h2>
                    <p className="mt-2 text-[13px] text-slate-400">
                      You&rsquo;ll be notified once it&rsquo;s sent on-chain.
                    </p>
                    <p className="mt-4 font-mono text-[11px] text-slate-600">
                      TX: {cwState.txId}
                    </p>
                    <Button
                      onClick={() => { setCwState({ step: "idle" }); setCwAmount(""); setCwAddress(""); }}
                      className="mt-8 h-11 w-full rounded-xl text-sm"
                    >
                      New withdrawal
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-7">
                    <section>
                      <p className="mb-3 text-[13px] font-black text-white">Asset</p>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCwOpen((o) => !o)}
                          className="flex w-full items-center justify-between border-b border-white/[0.08] py-3 text-left transition hover:border-white/[0.14]"
                        >
                          <span className="flex items-center gap-3">
                            {COIN_ICON_URL[cwAsset.code] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={COIN_ICON_URL[cwAsset.code]}
                                alt={cwAsset.code}
                                width={28}
                                height={28}
                                className="h-7 w-7 rounded-full"
                              />
                            )}
                            <span>
                              <span className="block text-[15px] font-bold text-white">{cwAsset.code}</span>
                              <span className="block text-[12px] font-medium text-slate-500">{cwAsset.displayNet}</span>
                            </span>
                          </span>
                          <Icon name={cwOpen ? "expand_less" : "expand_more"} className="text-[22px] text-slate-500" />
                        </button>

                        {cwOpen && (
                          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl bg-[#18191f] shadow-2xl ring-1 ring-white/[0.08]">
                            {CRYPTO_WITHDRAW_ASSETS.map((a) => (
                              <button
                                key={`${a.code}:${a.network}`}
                                type="button"
                                onClick={() => {
                                  setCwAsset(a);
                                  setCwOpen(false);
                                  setCwState({ step: "idle" });
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.05]"
                              >
                                {COIN_ICON_URL[a.code] && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={COIN_ICON_URL[a.code]}
                                    alt={a.code}
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 rounded-full"
                                  />
                                )}
                                <span className="flex-1">
                                  <span className="block text-[14px] font-bold text-white">
                                    {a.code}
                                    <span className="ml-2 text-[12px] font-medium text-slate-500">{a.displayNet}</span>
                                  </span>
                                  <span className="text-[11px] text-slate-600">min {a.min} {a.code}</span>
                                </span>
                                {cwAsset.code === a.code && cwAsset.network === a.network && (
                                  <Icon name="check" className="text-[18px] text-[#087cff]" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {cwBalance ? (
                        <p className="mt-2 text-[12px] font-medium text-slate-500">
                          Available{" "}
                          <button
                            type="button"
                            className="font-bold text-white transition hover:text-[#75b8ff]"
                            onClick={() => setCwAmount(cwBalance.available.toFixed(6))}
                          >
                            {cwBalance.available.toFixed(6)} {cwAsset.code}
                          </button>
                        </p>
                      ) : (
                        <p className="mt-2 text-[12px] font-medium text-slate-600">
                          No {cwAsset.code} balance on {cwAsset.displayNet}
                        </p>
                      )}
                    </section>

                    <section>
                      <p className="mb-2 text-[13px] font-black text-white">Amount</p>
                      <div className="flex items-center gap-2 border-b border-white/[0.08] focus-within:border-[#087cff]/60">
                        <input
                          type="number"
                          min={cwAsset.min}
                          step="any"
                          value={cwAmount}
                          onChange={(e) => { setCwAmount(e.target.value); setCwState({ step: "idle" }); }}
                          placeholder="0"
                          className="min-w-0 flex-1 bg-transparent py-3 text-[2rem] font-black tracking-tight text-white outline-none placeholder:text-slate-700"
                        />
                        <span className="shrink-0 text-[15px] font-bold text-slate-500">{cwAsset.code}</span>
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-slate-600">Min {cwAsset.min} {cwAsset.code}</p>
                    </section>

                    <section>
                      <p className="mb-2 text-[13px] font-black text-white">To address</p>
                      <input
                        type="text"
                        value={cwAddress}
                        onChange={(e) => { setCwAddress(e.target.value); setCwState({ step: "idle" }); }}
                        placeholder={`${cwAsset.displayNet} address`}
                        className="w-full border-b border-white/[0.08] bg-transparent py-3 font-mono text-[13px] text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-[#087cff]/60"
                      />
                      <p className="mt-2 text-[12px] font-medium text-slate-600">
                        Only {cwAsset.code} on {cwAsset.displayNet}. Wrong network = permanent loss.
                      </p>
                    </section>

                    {cwState.step === "error" && (
                      <p className="text-[13px] font-semibold text-red-400">{cwState.message}</p>
                    )}

                    <Button
                      onClick={requestCryptoWithdraw}
                      disabled={
                        cwState.step === "loading" ||
                        !cwAmount ||
                        !cwAddress.trim() ||
                        !isSignedIn
                      }
                      className="h-12 w-full rounded-xl text-sm"
                    >
                      {cwState.step === "loading" ? (
                        <LoadingDots label="Submitting" />
                      ) : (
                        `Withdraw${cwAmount ? ` ${cwAmount}` : ""} ${cwAsset.code}`
                      )}
                    </Button>
                  </div>
                )}

                {/* Recent crypto withdrawals */}
                <CryptoWithdrawalHistory isSignedIn={!!isSignedIn} />
              </>
            )}

            {/* ── M-Pesa withdraw — paused while Lipa B2C is down (see MPESA_WITHDRAWALS_ENABLED) ── */}
            {withdrawMode === "fiat" && !MPESA_WITHDRAWALS_ENABLED && (
              <div className="space-y-5">
                <div className={STATUS_PANEL}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15">
                    <Icon name="warning" className="text-[26px] text-amber-400" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">M-Pesa withdrawals temporarily unavailable</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    We&rsquo;re experiencing a problem with M-Pesa payouts and are working to
                    restore them. Your balance is safe.
                  </p>
                  {notifyState === "subscribed" ? (
                    <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-bold text-[#05b957]">
                      <Icon name="check_circle" className="text-[16px]" />
                      You&rsquo;re on the list — we&rsquo;ll email you when withdrawals reopen.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNotifyMe}
                      disabled={notifyState === "loading"}
                      className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      {notifyState === "loading" ? (
                        <LoadingDots label="Saving" />
                      ) : (
                        <><Icon name="notifications" className="text-[16px]" /> Notify me by email when it&rsquo;s back</>
                      )}
                    </button>
                  )}
                  <p className="pt-3 text-xs text-slate-600">
                    Need crypto instead? Switch to the <span className="font-bold text-slate-400">Crypto</span> tab above — those withdrawals are working normally.
                  </p>
                </div>
              </div>
            )}

            {/* ── M-Pesa withdraw ── */}
            {withdrawMode === "fiat" && MPESA_WITHDRAWALS_ENABLED && (
              <div className="space-y-7">
                {wdDone ? (
                  <div className="animate-in fade-in duration-300 text-center">
                    <p className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${wdDone.queued ? "text-[#75b8ff]" : "text-emerald-400"}`}>
                      {wdDone.queued ? "Processing" : "Submitted"}
                    </p>
                    <p className="mt-3 text-[2.1rem] font-black leading-none tracking-tight text-white">
                      {CURRENCY_SYMBOL} {wdDone.payout.toLocaleString()}
                    </p>
                    <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                      {wdDone.message ? (
                        wdDone.message
                      ) : (
                        <>Sending to your M-Pesa · fee {CURRENCY_SYMBOL} {wdDone.fee.toLocaleString()}</>
                      )}
                    </p>
                    {wdDone.queued && (
                      <p className="mt-2 text-[12px] text-slate-600">You&rsquo;ll get a notification when it&rsquo;s on its way.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setWdDone(null); setWdAmount(""); setWdPhone(""); }}
                      className="mt-8 text-[13px] font-semibold text-[#75b8ff] transition hover:text-white"
                    >
                      New withdrawal
                    </button>
                  </div>
                ) : (
                  <>
                    <section>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Daily left</p>
                      <p className={`mt-1 text-2xl font-black tracking-tight ${!wdLimit || wdLimit.remaining > 0 ? "text-white" : "text-amber-400"}`}>
                        {CURRENCY_SYMBOL} {(wdLimit?.remaining ?? wdLimit?.limit ?? 500).toLocaleString()}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate-600">
                        of {CURRENCY_SYMBOL} {(wdLimit?.limit ?? 500).toLocaleString()} · {WITHDRAWAL_FEE_PCT} fee · min KSh 100
                      </p>
                    </section>

                    <section>
                      <p className="mb-2 text-[13px] font-black text-white">Amount</p>
                      <div className="flex items-center gap-2 border-b border-white/[0.08] focus-within:border-[#087cff]/60">
                        <span className="text-2xl font-black text-slate-500">{CURRENCY_SYMBOL}</span>
                        <input
                          type="number"
                          min="100"
                          max="500"
                          value={wdAmount}
                          onChange={(e) => { setWdAmount(e.target.value); setWdError(""); }}
                          placeholder="0"
                          className="min-w-0 flex-1 bg-transparent py-3 text-[2rem] font-black tracking-tight text-white outline-none placeholder:text-slate-700"
                        />
                      </div>
                      {wdAmount && Number(wdAmount) >= 100 && (
                        <p className="mt-2 text-[12px] font-medium text-slate-500">
                          You receive{" "}
                          <span className="font-bold text-white">
                            {CURRENCY_SYMBOL} {Math.floor(Number(wdAmount) * (1 - WITHDRAWAL_FEE_RATE)).toLocaleString(MONEY_LOCALE)}
                          </span>
                          {" "}after fee
                        </p>
                      )}
                    </section>

                    <section>
                      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-black text-white">
                        M-Pesa number
                        {phoneLocked && <Icon name="lock" fill className="text-[13px] text-[#05b957]" />}
                      </p>
                      <div className={`flex items-center gap-2 border-b border-white/[0.08] ${phoneLocked ? "opacity-90" : "focus-within:border-[#087cff]/60"}`}>
                        <span className="text-base">🇰🇪</span>
                        <input
                          type="tel"
                          value={wdPhone}
                          onChange={(e) => { setWdPhone(e.target.value); setWdError(""); }}
                          placeholder="07XXXXXXXX"
                          readOnly={phoneLocked}
                          className="flex-1 bg-transparent py-3 text-[15px] font-semibold text-white outline-none placeholder:text-slate-600 read-only:cursor-not-allowed"
                        />
                        {phoneLocked && <Icon name="verified" fill className="shrink-0 text-[16px] text-[#05b957]" />}
                      </div>
                      {phoneLocked && (
                        <p className="mt-2 text-[12px] font-medium text-slate-600">
                          Locked to your account. Contact support to change it.
                        </p>
                      )}
                    </section>

                    {wdError && (
                      <p className="text-[13px] font-semibold text-red-400">{wdError}</p>
                    )}

                    <Button
                      onClick={requestMpesaWithdraw}
                      disabled={wdLoading || !wdAmount || Number(wdAmount) < 100 || !wdPhone.trim()}
                      className="h-12 w-full rounded-xl text-sm"
                    >
                      {wdLoading ? (
                        <LoadingDots label="Processing" />
                      ) : (
                        `Withdraw${wdAmount && Number(wdAmount) >= 100 ? ` ${CURRENCY_SYMBOL} ${Number(wdAmount).toLocaleString()}` : ""}`
                      )}
                    </Button>
                    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-600">
                      <Icon name="lock" fill className="text-[13px]" /> Confirm with password or passkey
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && <TransactionHistory isSignedIn={!!isSignedIn} />}
        </WalletPageFrame>
      )}

      {/* ── Step-up auth (withdraw + send) ── */}
      {stepUpOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !stepUpBusy && setStepUpOpen(false)}>
          <div className="w-full rounded-t-3xl border border-white/[0.08] bg-[#111316] p-6 shadow-2xl sm:max-w-[400px] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#087cff]/15">
              <Icon name="lock" fill className="text-[24px] text-[#5ea9ff]" />
            </div>
            <h3 className="text-center text-lg font-black text-white">Confirm it&rsquo;s you</h3>
            <p className="mt-1 mb-5 text-center text-xs leading-5 text-slate-500">
              {stepUpAction === "send" && pendingSend ? (
                <>
                  Sending <span className="font-black text-slate-300">{CURRENCY_SYMBOL} {pendingSend.amount.toLocaleString()}</span> to{" "}
                  <span className="font-black text-slate-300">@{pendingSend.recipient.username}</span>. Verify with your password or passkey.
                </>
              ) : stepUpAction === "cryptoWithdraw" ? (
                <>
                  Withdrawing <span className="font-black text-slate-300">{cwAmount || 0} {cwAsset.code}</span> to{" "}
                  <span className="font-black text-slate-300">{cwAddress.trim().slice(0, 10)}…{cwAddress.trim().slice(-6)}</span>. Crypto transfers are irreversible — verify with your password or passkey.
                </>
              ) : (
                <>
                  Withdrawing <span className="font-black text-slate-300">{CURRENCY_SYMBOL} {Number(wdAmount || 0).toLocaleString()}</span> to +{wdPhone.trim().startsWith("0") ? `254${wdPhone.trim().slice(1)}` : wdPhone.trim()}. Verify with your password or passkey.
                </>
              )}
            </p>

            <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.07] focus-within:ring-[#087cff]/50">
              <Icon name="lock" fill className="text-[18px] shrink-0 text-slate-500" />
              <input
                type={stepUpShowPw ? "text" : "password"}
                autoFocus
                value={stepUpPw}
                onChange={(e) => { setStepUpPw(e.target.value); setStepUpError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") void confirmWithPassword(); }}
                placeholder="Account password"
                className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 outline-none"
              />
              <button type="button" onClick={() => setStepUpShowPw((v) => !v)} className="text-slate-500 transition hover:text-slate-300">
                <Icon name={stepUpShowPw ? "visibility_off" : "visibility"} className="text-[18px]" />
              </button>
            </div>

            {stepUpError && <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400">{stepUpError}</p>}

            <button
              type="button"
              onClick={confirmWithPassword}
              disabled={stepUpBusy || !stepUpPw}
              className="mt-4 w-full rounded-2xl bg-[#05b957] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-[#07cc63] active:scale-[.98] disabled:opacity-60"
            >
              {stepUpBusy ? <LoadingDots label="Verifying" /> : (stepUpAction === "send" ? "Confirm & send" : "Confirm & withdraw")}
            </button>

            <div className="my-3 flex items-center gap-3">
              <div className="flex-1 border-t border-white/[0.07]" />
              <span className="text-xs text-slate-600">or</span>
              <div className="flex-1 border-t border-white/[0.07]" />
            </div>

            <button
              type="button"
              onClick={confirmWithPasskey}
              disabled={stepUpBusy}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#18191f] py-3.5 text-sm font-black text-white ring-1 ring-white/[0.07] transition hover:bg-[#22252e] active:scale-[.98] disabled:opacity-60"
            >
              <Icon name="passkey" className="text-[18px] text-[#5ea9ff]" /> Use passkey
            </button>

            <button type="button" onClick={() => setStepUpOpen(false)} disabled={stepUpBusy} className="mt-4 w-full text-sm font-bold text-slate-500 transition hover:text-white disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── First-withdrawal SMS verification ── */}
      {phoneVerifyOpen && (
        <PhoneVerifyModal
          initialPhone={wdPhone || wdLimit?.boundPhone || savedMpesa || undefined}
          onClose={() => setPhoneVerifyOpen(false)}
          onVerified={(verifiedPhone) => {
            setPhoneVerifyOpen(false);
            // Lock the field to the just-verified number and resume the payout.
            setWdPhone(verifiedPhone.startsWith("254") ? `0${verifiedPhone.slice(3)}` : verifiedPhone);
            toast.success("Number verified", "Your account is now secured to this number.");
            loadWdLimit();
            void handleMpesaWithdraw();
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

const NETWORK_LABEL: Record<string, string> = {
  POLYGON: "Polygon",
  BITCOIN: "Bitcoin",
  ETHEREUM: "Ethereum",
  BSC: "BNB Chain",
  TRON: "Tron",
};

/** Shared quiet field chrome for wallet forms. */
const FIELD =
  "flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 ring-1 ring-white/[0.06] transition focus-within:ring-[#087cff]/45";
const FIELD_LABEL = "mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500";
const STATUS_PANEL =
  "rounded-2xl bg-white/[0.03] px-6 py-8 text-center ring-1 ring-white/[0.06] animate-in fade-in duration-300";

function WalletHome({
  balance,
  cryptoBalances,
  cryptoTotalUsdt,
  isSignedIn,
  onLogin,
  onOpen,
}: {
  balance: string;
  cryptoBalances: CryptoBalance[];
  cryptoTotalUsdt: number;
  isSignedIn: boolean;
  onLogin: () => void;
  onOpen: (tab: WalletTab) => void;
}) {
  const actions: Array<{ tab: WalletTab; label: string; icon: string }> = [
    { tab: "deposit", label: "Deposit", icon: "arrow_downward" },
    { tab: "send", label: "Send", icon: "send" },
    { tab: "withdraw", label: "Withdraw", icon: "arrow_upward" },
    { tab: "history", label: "History", icon: "history" },
  ];
  const usdtLabel = cryptoTotalUsdt.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8 sm:max-w-2xl sm:pb-10 sm:pt-10">
      <section className="animate-in fade-in duration-300">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Available balance
          </p>
          <CurrencySwitcher />
        </div>
        <p className={`mt-2 text-[1.75rem] font-black leading-none tracking-tight sm:text-[2rem] ${isSignedIn ? "text-white" : "text-slate-600"}`}>
          {balance}
        </p>
        {isSignedIn && cryptoBalances.length > 0 && (
          <p className="mt-2 text-[13px] font-semibold text-slate-500">
            Crypto ≈ <span className="font-black tabular-nums text-white">{usdtLabel} USDT</span>
          </p>
        )}
        {!isSignedIn && (
          <Button onClick={onLogin} className="mt-6 h-11 w-full max-w-xs rounded-xl text-sm">
            Log in
          </Button>
        )}
      </section>

      <div className="mt-8 grid grid-cols-4 gap-2">
        {actions.map((action) => (
          <button
            key={action.tab}
            type="button"
            onClick={() => onOpen(action.tab)}
            className="flex flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition active:scale-[0.96] hover:bg-white/[0.04]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/[0.06]">
              <Icon name={action.icon} className="text-[20px]" />
            </span>
            <span className="text-[11px] font-bold text-slate-300">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 border-t border-white/[0.06] pt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[13px] font-black text-white">Assets</h2>
          {cryptoBalances.length > 0 && (
            <span className="text-[11px] font-semibold text-slate-500">
              Combined in USDT · send to pick a coin
            </span>
          )}
        </div>
        {cryptoBalances.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {/* Bybit-style: one combined crypto line in USDT on home */}
            <li className="flex items-center justify-between gap-3 py-3.5 first:pt-1">
              <span className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={COIN_ICON_URL.USDT}
                  alt="USDT"
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-full"
                />
                <span className="min-w-0">
                  <span className="block text-[14px] font-black text-white">Crypto</span>
                  <span className="block text-[11px] font-medium text-slate-500">
                    {cryptoBalances.length} {cryptoBalances.length === 1 ? "coin" : "coins"} · USDT value
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[13px] font-bold tabular-nums text-white">
                  {usdtLabel}
                </span>
                <span className="block text-[10px] font-semibold text-slate-500">USDT</span>
              </span>
            </li>
          </ul>
        ) : (
          <p className="py-2 text-[13px] font-medium text-slate-500">
            Deposit crypto to see balances here.
          </p>
        )}
      </div>
    </main>
  );
}

function WalletPageFrame({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-5 sm:max-w-2xl sm:pb-10 animate-in fade-in duration-200">
      <div className="mb-6 grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to wallet"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
        <h1 className="text-center text-[15px] font-black tracking-tight text-white">{title}</h1>
      </div>
      {children}
    </main>
  );
}

// International payment-method picker: market currency → local rails + global crypto.
function DepositMethodStep({
  pesapalEnabled,
  displayCurrency,
  onContinue,
}: {
  pesapalEnabled: boolean;
  displayCurrency: string;
  onContinue: (selection: DepositSelection) => void;
}) {
  const [marketCurrency, setMarketCurrency] = useState(
    () => MARKETS.some((m) => m.currency === displayCurrency) ? displayCurrency : "USD",
  );
  const rows = useMemo(
    () => depositRowsForCurrency(marketCurrency, { pesapalEnabled }),
    [marketCurrency, pesapalEnabled],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId && r.enabled && r.selection);
  const market = MARKETS.find((m) => m.currency === marketCurrency) ?? MARKETS[0];

  useEffect(() => {
    setSelectedId(null);
  }, [marketCurrency]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="mb-1 text-[15px] font-black text-white">Payment method</h2>
        <p className="mb-3 text-[12px] font-medium text-slate-500">
          International deposits — pick your market, then a method
        </p>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Market / currency
          </span>
          <select
            value={marketCurrency}
            onChange={(e) => setMarketCurrency(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0d1117] px-3 text-[13px] font-semibold text-white outline-none focus:border-[#087cff]/60"
          >
            {MARKETS.map((m) => (
              <option key={m.currency} value={m.currency}>
                {m.currency} — {m.label} ({m.region})
              </option>
            ))}
          </select>
        </label>
        <p className="mb-2 text-[11px] text-slate-500">{market.region}</p>
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {rows.map((row) => {
            const active = row.id === selectedId;
            const logos =
              row.id === "card" ? (["VISA", "MASTERCARD"] as const) : ([row.code] as const);
            return (
              <button
                key={row.id}
                type="button"
                disabled={!row.enabled}
                onClick={() => setSelectedId(row.id)}
                className={`flex w-full items-center gap-3 py-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? "bg-[#087cff]/[0.06]" : "hover:bg-white/[0.02]"
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                    active ? "border-[#087cff]" : "border-slate-600"
                  }`}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-[#087cff]" />}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {logos.map((code) => (
                    <PaymentBrandLogo key={code} code={code} size={32} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-slate-100">{row.label}</span>
                  <span className="block text-[11px] font-medium text-slate-500">{row.subtitle}</span>
                </span>
                {!row.enabled && row.soon && (
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={() => selected?.selection && onContinue(selected.selection)}
        disabled={!selected}
        className="h-12 w-full rounded-xl text-sm"
      >
        Continue
      </Button>
    </section>
  );
}

function WalletTransferPanel({
  isSignedIn,
  balance,
  openLogin,
  wdLimit,
  sending,
  error,
  alreadySent,
  receipt,
  onClearReceipt,
  onClearAlreadySent,
  onRequestSend,
}: {
  isSignedIn: boolean;
  balance: number;
  openLogin: () => void;
  wdLimit: { limit: number; used: number; remaining: number; resetsAt: string | null } | null;
  sending: boolean;
  error: string;
  alreadySent: {
    recipient: string;
    priorAmount: number | null;
    from: string;
    sentAt: string | null;
  } | null;
  receipt: TransferReceipt | null;
  onClearReceipt: () => void;
  onClearAlreadySent: () => void;
  onRequestSend: (next: { recipient: TransferRecipient; amount: number }) => void;
}) {
  const { format: formatDisplay } = useCurrency();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransferRecipient[]>([]);
  const [recipient, setRecipient] = useState<TransferRecipient | null>(null);
  const [amount, setAmount] = useState("");
  const [searching, setSearching] = useState(false);

  const maxSendable = Math.max(
    0,
    Math.min(
      MAX_TRANSFER_KES,
      Math.floor(balance),
      wdLimit?.remaining ?? MAX_TRANSFER_KES,
    ),
  );

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

  function sendMoney() {
    if (!isSignedIn) { openLogin(); return; }
    if (!recipient) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onRequestSend({ recipient, amount: value });
  }

  if (receipt) {
    return (
      <div className="animate-in fade-in duration-300 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-400">Sent</p>
        <p className="mt-3 text-[2.35rem] font-black leading-none tracking-tight text-white">
          {CURRENCY_SYMBOL} {receipt.amount.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}
        </p>
        <div className="mx-auto mt-8 flex max-w-sm items-center gap-3 border-t border-white/[0.06] pt-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-sm font-black text-white">
            {receipt.recipient.imageUrl
              ? <img src={receipt.recipient.imageUrl} alt="" className="h-full w-full object-cover" />
              : receipt.recipient.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-white">{receipt.recipient.displayName}</p>
            <p className="truncate text-[12px] font-medium text-slate-500">@{receipt.recipient.username}</p>
          </div>
        </div>
        <p className="mt-4 text-[13px] font-medium text-slate-500">Credited instantly to their Nezeem wallet.</p>
        <Button
          onClick={() => {
            onClearReceipt();
            setQuery("");
            setRecipient(null);
            setAmount("");
          }}
          className="mt-8 h-11 w-full rounded-xl text-sm"
        >
          Send again
        </Button>
      </div>
    );
  }

  if (alreadySent) {
    const when = alreadySent.sentAt
      ? new Date(alreadySent.sentAt).toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
    return (
      <div className="animate-in fade-in duration-300 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Already sent</p>
        <h2 className="mt-3 text-xl font-black tracking-tight text-white">
          @{alreadySent.recipient}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-6 text-slate-400">
          This account already received an admin transfer
          {alreadySent.priorAmount != null && (
            <>
              {" "}of{" "}
              <span className="font-bold text-slate-200">
                {CURRENCY_SYMBOL} {alreadySent.priorAmount.toLocaleString(MONEY_LOCALE)}
              </span>
            </>
          )}
          {when ? <> on {when}</> : null}. Each account can receive from an admin only once.
        </p>
        <Button
          onClick={() => {
            onClearAlreadySent();
            setQuery("");
            setRecipient(null);
            setAmount("");
          }}
          variant="secondary"
          className="mt-8 h-11 w-full rounded-xl text-sm"
        >
          Choose another recipient
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Available</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-white">{formatDisplay(balance)}</p>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-black text-white">To</p>
        {recipient ? (
          <button
            type="button"
            onClick={() => { setRecipient(null); setQuery(""); onClearAlreadySent(); }}
            className="flex w-full items-center gap-3 border-y border-white/[0.06] py-3.5 text-left transition hover:bg-white/[0.02]"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-sm font-black text-white">
              {recipient.imageUrl
                ? <img src={recipient.imageUrl} alt="" className="h-full w-full object-cover" />
                : (recipient.displayName || recipient.username || "U").charAt(0).toUpperCase()}
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold text-white">{recipient.displayName}</span>
              <span className="block truncate text-[12px] font-medium text-slate-500">@{recipient.username}</span>
            </span>
            <span className="text-[12px] font-semibold text-[#75b8ff]">Change</span>
          </button>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-3 border-b border-white/[0.08] focus-within:border-[#087cff]/60">
              <Icon name="search" className="text-[18px] text-slate-600" />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); }}
                placeholder="Username, email or phone"
                className="w-full bg-transparent py-3 text-[15px] font-semibold text-white outline-none placeholder:text-slate-600"
              />
            </div>
            {(searching || results.length > 0) && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-[#18191f] shadow-2xl ring-1 ring-white/[0.08]">
                {searching ? (
                  <p className="px-4 py-3 text-[12px] font-medium text-slate-500">Searching…</p>
                ) : results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => { setRecipient(user); setQuery(`@${user.username}`); setResults([]); onClearAlreadySent(); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.05]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-sm font-black text-white">
                      {user.imageUrl
                        ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                        : (user.displayName || user.username || "U").charAt(0).toUpperCase()}
                    </div>
                    <span>
                      <span className="block text-[14px] font-bold text-white">{user.displayName}</span>
                      <span className="block text-[12px] font-medium text-slate-500">@{user.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[13px] font-black text-white">Amount</p>
          <button
            type="button"
            onClick={() => setAmount(String(maxSendable))}
            disabled={maxSendable <= 0}
            className="text-[12px] font-semibold text-[#75b8ff] transition hover:text-white disabled:opacity-40"
          >
            Max {CURRENCY_SYMBOL} {maxSendable.toLocaleString()}
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-white/[0.08] focus-within:border-[#087cff]/60">
          <span className="text-2xl font-black text-slate-500">{CURRENCY_SYMBOL}</span>
          <input
            type="number"
            min="1"
            max={maxSendable || undefined}
            value={amount}
            onChange={(event) => { setAmount(event.target.value); }}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent py-3 text-[2rem] font-black tracking-tight text-white outline-none placeholder:text-slate-700"
          />
        </div>
        <p className="mt-2 text-[12px] font-medium text-slate-600">
          Up to {CURRENCY_SYMBOL} {MAX_TRANSFER_KES} per transfer
          {wdLimit ? ` · ${CURRENCY_SYMBOL} ${wdLimit.remaining.toLocaleString()} left today` : ""}
        </p>
      </section>

      {error && <p className="text-[13px] font-semibold text-red-400">{error}</p>}
      <Button
        onClick={sendMoney}
        disabled={sending || !recipient || !amount || Number(amount) <= 0 || maxSendable <= 0}
        className="h-12 w-full rounded-xl text-sm"
      >
        {sending ? <LoadingDots label="Sending" /> : "Send"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-600">
        <Icon name="lock" fill className="text-[13px]" /> Confirm with password or passkey
      </p>
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
    <div className="mt-8 border-t border-white/[0.06] pt-6">
      <p className="mb-1 text-[13px] font-black text-white">Recent</p>
      {loading ? (
        <div className="divide-y divide-white/[0.05]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-4">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-28 rounded skeleton" />
                <div className="h-2.5 w-20 rounded skeleton" />
              </div>
              <div className="h-4 w-16 rounded skeleton" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {items.map((w) => (
            <div key={w.id} className="flex items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-white">
                  {w.crypto} · {w.network ?? ""}
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">
                  {new Date(w.createdAt).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <span className="mx-1.5 text-slate-700">·</span>
                  <span className={
                    w.status === "COMPLETED"
                      ? "text-emerald-500/80"
                      : w.status === "FAILED"
                        ? "text-red-400/80"
                        : "text-amber-400/80"
                  }>
                    {w.status}
                  </span>
                </p>
              </div>
              <p className="shrink-0 text-[14px] font-black tabular-nums text-red-400">
                -{w.amount} {w.crypto}
              </p>
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
    return `${CURRENCY_SYMBOL} ${amount.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      <div className="flex flex-col items-center gap-2 py-20 text-center">
        <p className="text-[15px] font-bold text-white">Log in to see history</p>
        <p className="text-[13px] font-medium text-slate-500">Deposits, sends, and withdrawals show up here</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="divide-y divide-white/[0.05]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-28 rounded skeleton" />
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
      <div className="flex flex-col items-center gap-2 py-20 text-center">
        <p className="text-[15px] font-bold text-white">No transactions yet</p>
        <p className="text-[13px] font-medium text-slate-500">Your activity will appear here</p>
      </div>
    );
  }

  if (selected) {
    const meta = TXN_META[selected.type] ?? { label: selected.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
    const context = transactionContext(selected);
    return (
      <div className="animate-in fade-in duration-200">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-8 flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-white"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          Back
        </button>

        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">{meta.label}</p>
          <p className={`mt-3 text-[2.35rem] font-black leading-none tracking-tight ${meta.color}`}>
            {meta.sign}{fmtTxAmount(selected.amount, selected.currency)}
          </p>
          <p className={`mt-3 text-[12px] font-semibold ${
            selected.status === "COMPLETED"
              ? "text-emerald-400"
              : selected.status === "FAILED"
                ? "text-red-400"
                : "text-amber-400"
          }`}>
            {txStatusLabel(selected)}
          </p>
        </div>

        <div className="mt-8 divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {[
            { label: "Date", value: new Date(selected.createdAt).toLocaleString(MONEY_LOCALE, { dateStyle: "medium", timeStyle: "short" }) },
            { label: "Method", value: selected.provider ? selected.provider.replace(/_/g, " ").toUpperCase() : "Nezeem wallet" },
            ...context,
            { label: "Reference", value: selected.reference ?? selected.id },
          ].map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-3.5">
              <span className="text-[12px] font-medium text-slate-500">{row.label}</span>
              <span className="max-w-[65%] break-all text-right text-[12px] font-semibold text-slate-200">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in divide-y divide-white/[0.05] duration-200">
      {txns.map((t) => {
        const meta = TXN_META[t.type] ?? { label: t.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
        return (
          <button
            type="button"
            key={t.id}
            onClick={() => setSelected(t)}
            className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/[0.02] active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white">{meta.label}</p>
              <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                {new Date(t.createdAt).toLocaleDateString("en-KE", {
                  day:    "numeric",
                  month:  "short",
                  hour:   "2-digit",
                  minute: "2-digit",
                })}
                <span className="mx-1.5 text-slate-700">·</span>
                <span className={
                  t.status === "COMPLETED"
                    ? "text-emerald-500/80"
                    : t.status === "FAILED"
                      ? "text-red-400/80"
                      : "text-amber-400/80"
                }>
                  {txStatusLabel(t)}
                </span>
              </p>
            </div>
            <p className={`shrink-0 text-[15px] font-black tabular-nums ${meta.color}`}>
              {meta.sign}{fmtTxAmount(t.amount, t.currency)}
            </p>
          </button>
        );
      })}
    </div>
  );
}


// ─── Crypto deposit panel (wallet page) ───────────────────────────────────────

// USDT/BTC/ETH map to their own coin; OTHER holds everything else (USDC, BNB).
function groupMatches(group: CryptoAssetGroup, code: string): boolean {
  return group === "OTHER" ? code !== "USDT" && code !== "BTC" && code !== "ETH" : code === group;
}

type CryptoAddrPhase =
  | { phase: "checking" }
  | { phase: "generating" }
  | { phase: "form"; error?: string }
  | { phase: "ready"; address: string };

// Deposit addresses are deterministic per (coin, network) and never change, so
// cache them for the session. Prefetching on deposit-open means the address + QR
// are already resolved by the time the user views them — Binance-style, no spinner.
const depositAddrCache = new Map<string, string>();
const addrKey = (code: string, net: string) => `${code}:${net}`;

async function resolveDepositAddress(code: string, net: string): Promise<string> {
  const key = addrKey(code, net);
  const hit = depositAddrCache.get(key);
  if (hit) return hit;
  try {
    const res  = await fetch(`/api/crypto/address?crypto=${code}&network=${net}`);
    const data = await res.json();
    if (data?.address) { depositAddrCache.set(key, data.address as string); return data.address as string; }
  } catch { /* fall through to generate */ }
  const res  = await fetch("/api/crypto/address", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crypto: code, network: net }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to generate address");
  depositAddrCache.set(key, data.address as string);
  return data.address as string;
}

/** Fire-and-forget warm-up so the address is cached before the user views it. */
function prefetchDepositAddress(code: string, net: string) {
  resolveDepositAddress(code, net).catch(() => { /* surfaced later on view */ });
}

function CryptoDepositPanel({ group }: { group: CryptoAssetGroup }) {
  const assets = useMemo(() => CRYPTO_DEPOSIT_ASSETS.filter((a) => groupMatches(group, a.code)), [group]);
  const codes  = useMemo(() => Array.from(new Set(assets.map((a) => a.code))), [assets]);
  const [sel, setSel]       = useState(0);
  // Seed instantly from the session cache (warmed by the deposit-open prefetch)
  // so the address + QR render with no spinner on the common path.
  const [addr, setAddr]     = useState<CryptoAddrPhase>(() => {
    const first  = assets[0];
    const cached = first && depositAddrCache.get(addrKey(first.code, first.network));
    return cached ? { phase: "ready", address: cached } : { phase: "checking" };
  });
  const [copied, setCopied] = useState(false);
  useEffect(() => { setSel(0); }, [group]);       // reset when the chosen coin group changes
  const asset    = assets[sel] ?? assets[0];
  const networks = assets.filter((a) => a.code === asset.code);

  const load = useCallback(async (code: string, net: string) => {
    const cached = depositAddrCache.get(addrKey(code, net));
    if (cached) { setAddr({ phase: "ready", address: cached }); return; }
    setAddr({ phase: "checking" });
    try {
      setAddr({ phase: "ready", address: await resolveDepositAddress(code, net) });
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
      {/* Selected coin header */}
      <div className="flex items-center justify-center gap-2">
        <PaymentIcon badge={asset.code} />
        <span className="text-lg font-black text-white">{asset.name}</span>
        <span className="text-sm font-black text-slate-500">{asset.code}</span>
      </div>

      {/* Coin sub-picker — only when the group holds more than one coin (Other Crypto) */}
      {codes.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code) => {
            const first  = assets.findIndex((a) => a.code === code);
            const active = asset.code === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSel(first)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ring-1 ${
                  active ? "bg-[#087cff]/15 text-white ring-[#087cff]/50" : "bg-white/[0.04] text-slate-300 ring-white/[0.06]"
                }`}
              >
                <PaymentIcon badge={code} />
                {code}
              </button>
            );
          })}
        </div>
      )}

      {/* Deposit network — single-select radio cards */}
      <div className="border-y border-white/[0.06] py-4">
        <p className="text-center text-[13px] font-black text-white">Deposit network</p>
        <p className="mx-auto mb-3 mt-0.5 max-w-[16rem] text-center text-[11px] font-medium leading-snug text-slate-500">
          Choose the correct network, otherwise you will lose your deposit.
        </p>
        <div className={`grid gap-2 ${networks.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {networks.map((n) => {
            const i      = assets.indexOf(n);
            const active = asset.network === n.network;
            return (
              <button
                key={n.network}
                type="button"
                disabled={!n.enabled}
                onClick={() => { if (n.enabled) setSel(i); }}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-left transition ring-1 ${
                  !n.enabled
                    ? "cursor-not-allowed bg-white/[0.02] opacity-45 ring-white/[0.06]"
                    : active
                      ? "bg-[#087cff]/12 ring-[#087cff]/60"
                      : "bg-white/[0.03] ring-white/[0.06]"
                }`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${active ? "border-[#087cff]" : "border-slate-600"}`}>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-[#087cff]" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13px] font-black text-white">
                    {n.network}
                    {n.soon && (
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-500">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[10px] font-bold text-slate-500">{n.displayNet}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs font-bold text-slate-500">
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
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#087cff] text-sm font-bold text-white transition hover:bg-[#1a8cff] disabled:opacity-60"
          >
            {addr.phase === "generating"
              ? <LoadingDots label="Generating" />
              : <><Icon name="qr_code" className="text-[16px]" /> Get deposit address</>}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06] sm:flex-row sm:items-center">
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
            <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium text-emerald-400/70 sm:justify-start">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Detected automatically · credited within 1–5 min
            </p>
            <button
              type="button"
              onClick={copy}
              className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#087cff] px-4 text-xs font-bold text-white transition hover:bg-[#1a8cff]"
            >
              <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
              {copied ? "Copied!" : "Copy address"}
            </button>
          </div>
        </div>
      )}

      {addr.phase === "ready" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-400/8 px-4 py-3">
          <Icon name="info" fill className="mt-0.5 shrink-0 text-[16px] text-amber-400" />
          <p className="text-xs font-medium text-amber-300/80">
            Send only <strong>{asset.code}</strong> on the <strong>{asset.displayNet}</strong> network to this address. Sending other assets may result in permanent loss.
          </p>
        </div>
      )}
    </div>
  );
}

