"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { enrollPasskey } from "@/lib/passkey-client";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { AvatarUploader } from "@/components/avatar-uploader";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { PromoSuccessCard, PromoNoticeCard, promoNoticeFromStatus, type PromoNoticeKind } from "@/components/promo-success";
import { useCurrency } from "@/lib/currency-context";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

export type ProfileView =
  | "main"
  | "settings"
  | "bets"
  | "transactions"
  | "withdraw"
  | "bonuses"
  | "bonus-codes"
  | "notifications"
  | "security"
  | "language"
  | "currency"
  | "support";

type Props = { onClose: () => void; onOpenWallet: (tab?: "deposit" | "send" | "withdraw" | "history") => void; initialView?: ProfileView };

// ── Bet history types ────────────────────────────────────────────────────────

type BetSelection = { matchName: string; market: string; label: string; odds: number; result: string };
type Bet = {
  id: string; type: string; stake: number; totalOdds: number;
  potentialWin: number; winAmount: number | null; status: string;
  createdAt: string; selections: BetSelection[];
};

// ── Transaction types ────────────────────────────────────────────────────────

type Txn = {
  id: string; type: string; amount: number; currency: string;
  status: string; provider: string | null; createdAt: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMsisdn(v: string) {
  const s = v.trim().replace(/\s+/g, "");
  if (s.startsWith("+254")) return s.slice(1);
  if (s.startsWith("254")) return s;
  if (s.startsWith("0") && s.length === 10) return `254${s.slice(1)}`;
  return s;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  WON:     "text-emerald-400",
  LOST:    "text-red-400",
  VOID:    "text-slate-500",
  PENDING: "text-amber-400",
};

// ── Sub-view: Bet History ────────────────────────────────────────────────────

function BetsView() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bets/mine?limit=30")
      .then((r) => r.json())
      .then((data) => setBets(Array.isArray(data) ? data : []))
      .catch(() => setBets([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-0 px-5 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse border-b border-white/[0.05] bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (!bets.length) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[14px] font-bold text-slate-400">No bets yet</p>
        <p className="mt-1 text-[12px] font-medium text-slate-600">Place your first bet to see it here.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in divide-y divide-white/[0.05] border-y border-white/[0.06] duration-200">
      {bets.map((bet) => (
        <div key={bet.id}>
          <button
            type="button"
            onClick={() => setExpanded(expanded === bet.id ? null : bet.id)}
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02] active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-white">
                {bet.selections.length === 1
                  ? bet.selections[0].matchName
                  : `${bet.type} · ${bet.selections.length} selections`}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                {fmtDate(bet.createdAt)} · {CURRENCY_SYMBOL} {bet.stake.toLocaleString()}
              </p>
            </div>
            <span className={`shrink-0 text-[12px] font-black ${STATUS_STYLE[bet.status] ?? STATUS_STYLE.PENDING}`}>
              {bet.status}
            </span>
          </button>

          {expanded === bet.id && (
            <div className="space-y-2 border-t border-white/[0.05] bg-white/[0.015] px-5 py-3">
              {bet.selections.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-white">{s.matchName}</p>
                    <p className="text-[11px] font-medium text-slate-500">{s.market} · {s.label}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] font-black text-[#087cff]">{Number(s.odds).toFixed(2)}</span>
                    {s.result !== "PENDING" && (
                      <span className={`text-[11px] font-black ${STATUS_STYLE[s.result] ?? STATUS_STYLE.PENDING}`}>
                        {s.result}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-white/[0.05] pt-2">
                <span className="text-[11px] font-medium text-slate-500">
                  {bet.status === "WON" ? "Won" : "Potential"}: {CURRENCY_SYMBOL} {(bet.winAmount ?? bet.potentialWin).toLocaleString()}
                </span>
                <span className="text-[11px] font-medium text-slate-500">Odds: {Number(bet.totalOdds).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sub-view: Transaction History ───────────────────────────────────────────

const TXN_META: Record<string, { label: string; icon: string; color: string; sign: "+" | "-" }> = {
  DEPOSIT:    { label: "Deposit",    icon: "add_circle",    color: "text-emerald-400", sign: "+" },
  WITHDRAWAL: { label: "Withdrawal", icon: "remove_circle", color: "text-red-400",     sign: "-" },
  BET_STAKE:  { label: "Bet Placed", icon: "sports_soccer", color: "text-red-400",     sign: "-" },
  BET_WIN:    { label: "Bet Win",    icon: "emoji_events",  color: "text-emerald-400", sign: "+" },
  BONUS:      { label: "Bonus",      icon: "redeem",        color: "text-amber-400",   sign: "+" },
  REFUND:     { label: "Refund",     icon: "undo",          color: "text-sky-400",     sign: "+" },
};

function TransactionsView() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/wallet/transactions")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? "Failed to load transactions");
        return data;
      })
      .then((data) => setTxns(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load transactions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col px-5 py-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse border-b border-white/[0.05] bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[14px] font-bold text-slate-400">Could not load transactions</p>
        <p className="mt-1 text-[12px] font-medium text-slate-600">{error}</p>
      </div>
    );
  }

  if (!txns.length) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-[14px] font-bold text-slate-400">No transactions yet</p>
        <p className="mt-1 text-[12px] font-medium text-slate-600">Your deposits and withdrawals will appear here.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in divide-y divide-white/[0.05] border-y border-white/[0.06] duration-200">
      {txns.map((t) => {
        const meta = TXN_META[t.type] ?? { label: t.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
        return (
          <div key={t.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.02]">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white">{meta.label}</p>
              <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                {new Date(t.createdAt).toLocaleDateString("en-KE", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
                {t.provider ? ` · ${t.provider}` : ""}
                {" · "}
                <span className={
                  t.status === "COMPLETED" ? "text-emerald-500/80"
                  : t.status === "FAILED"  ? "text-red-400/80"
                  : "text-amber-400/80"
                }>
                  {t.status}
                </span>
              </p>
            </div>
            <p className={`shrink-0 text-[15px] font-black tabular-nums ${meta.color}`}>
              {meta.sign}{CURRENCY_SYMBOL} {Number(t.amount).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-view: Withdraw ───────────────────────────────────────────────────────

const COIN_ICONS: Record<string, string> = {
  USDT:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
  USDC:  "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
  BTC:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
  ETH:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  BNB:   "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
  MATIC: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/matic.svg",
};

const NET_LABEL: Record<string, string> = {
  TRC20: "TRC-20", ERC20: "ERC-20", BEP20: "BEP-20", BTC: "Bitcoin",
};

const MIN_CRYPTO: Record<string, number> = {
  USDT: 10, USDC: 10, BTC: 0.0001, ETH: 0.005, BNB: 0.01, MATIC: 5,
};

// Mirrors the temporary Lipa Haraka test-mode rules on the withdrawal API.
const MPESA_MIN_WITHDRAWAL = 11;
const MPESA_WITHDRAWAL_FEE_RATE = 0;

type CryptoBal = { crypto: string; network: string; available: number };

function WithdrawView({ balance, currency, onSuccess }: { balance: number; currency: string; onSuccess: (newBalance: number) => void }) {
  const { user } = useSupabaseAuth();
  const [mode, setMode] = useState<"fiat" | "crypto">("fiat");

  // — fiat state —
  const [amount, setAmount]   = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);

  // — crypto state —
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBal[]>([]);
  const [cryptoLoading, setCryptoLoading]   = useState(false);
  const [selectedBal, setSelectedBal]       = useState<CryptoBal | null>(null);
  const [cwAmount, setCwAmount]             = useState("");
  const [cwAddress, setCwAddress]           = useState("");
  const [cwLoading, setCwLoading]           = useState(false);
  const [cwError, setCwError]               = useState("");
  const [cwDone, setCwDone]                 = useState(false);
  const [cwOpen, setCwOpen]                 = useState(false);

  useEffect(() => {
    const ph = user?.phone ?? user?.user_metadata?.phone_number;
    if (ph && !phone) setPhone(String(ph).replace("+", ""));
  }, [user, phone]);

  useEffect(() => {
    if (mode !== "crypto") return;
    setCryptoLoading(true);
    fetch("/api/crypto/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        const rows = Array.isArray(data)
          ? data
          : (data && typeof data === "object" && Array.isArray((data as { balances?: unknown }).balances)
            ? (data as { balances: CryptoBal[] }).balances
            : []);
        const bals = (rows as CryptoBal[]).filter((b) => b.available > 0);
        setCryptoBalances(bals);
        if (bals.length && !selectedBal) setSelectedBal(bals[0]);
      })
      .catch(() => {})
      .finally(() => setCryptoLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fmtBal = `${currency === "KES" ? CURRENCY_SYMBOL : currency} ${balance.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}`;
  const cwPrec = selectedBal?.crypto === "BTC" || selectedBal?.crypto === "ETH" ? 8 : 6;

  async function submitFiat() {
    setError("");
    const amt = Number(amount);
    if (!amt || amt < MPESA_MIN_WITHDRAWAL) { setError(`Minimum withdrawal is ${CURRENCY_SYMBOL} ${MPESA_MIN_WITHDRAWAL}`); return; }
    if (amt > balance) { setError("Amount exceeds your balance"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKes: amt, phoneNumber: normalizeMsisdn(phone) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Withdrawal failed");
      setDone(true);
      onSuccess((data as { newBalance: number }).newBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCrypto() {
    if (!selectedBal) return;
    setCwError("");
    const amt = Number(cwAmount);
    const min = MIN_CRYPTO[selectedBal.crypto] ?? 0;
    if (!amt || amt < min) { setCwError(`Minimum withdrawal is ${min} ${selectedBal.crypto}`); return; }
    if (amt > selectedBal.available) { setCwError("Amount exceeds available balance"); return; }
    if (!cwAddress.trim()) { setCwError("Destination address is required"); return; }
    setCwLoading(true);
    try {
      const res = await fetch("/api/crypto/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crypto: selectedBal.crypto, network: selectedBal.network, amount: amt, address: cwAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Withdrawal failed");
      setCwDone(true);
    } catch (err) {
      setCwError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCwLoading(false);
    }
  }

  return (
    <div className="space-y-2.5 px-4 py-2">

      {/* ── Mode tabs ── */}
      <div className="grid grid-cols-2 rounded-xl bg-[#151518] p-1 ring-1 ring-white/[0.06]">
        <button
          type="button"
          onClick={() => { setMode("fiat"); setDone(false); setError(""); }}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12px] font-black transition ${mode === "fiat" ? "bg-[#087cff] text-white" : "text-slate-400 hover:text-white"}`}
        >
          <Icon name="phone_iphone" fill className="text-[15px]" />
          M-Pesa
        </button>
        <button
          type="button"
          onClick={() => { setMode("crypto"); setCwDone(false); setCwError(""); }}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12px] font-black transition ${mode === "crypto" ? "bg-[#087cff] text-white" : "text-slate-400 hover:text-white"}`}
        >
          <Icon name="currency_bitcoin" fill className="text-[15px]" />
          Crypto
        </button>
      </div>

      {/* ── M-Pesa tab ── */}
      {mode === "fiat" && (
        done ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Icon name="check_circle" fill className="text-[54px] text-emerald-400" />
            <p className="text-2xl font-black text-white">Request submitted</p>
            <p className="text-sm font-bold text-slate-400">Your withdrawal will arrive within 24 hours via M-Pesa.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-[#18191f] px-3 py-2 ring-1 ring-white/[0.06]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Available</p>
              <p className="text-xl font-black text-white">{fmtBal}</p>
            </div>

            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="M-Pesa number (07XX or 01XX)"
              className="h-11 w-full rounded-xl bg-[#18191f] px-4 text-[13px] font-bold text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-600 focus:ring-2 focus:ring-[#087cff]/50"
            />

            <div className="relative">
              <span className="absolute left-5 top-2 text-[10px] font-black text-slate-500">Amount (KSh)</span>
              <input
                type="number"
                min={MPESA_MIN_WITHDRAWAL}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-11 w-full rounded-xl bg-[#18191f] px-4 pt-3 text-[13px] font-bold text-white outline-none ring-1 ring-white/[0.08] focus:ring-2 focus:ring-[#087cff]/50"
              />
            </div>

            <p className="text-[11px] text-slate-600">Test mode: no fee · Min {CURRENCY_SYMBOL} {MPESA_MIN_WITHDRAWAL} · Max KSh 150,000</p>
            {Number(amount) > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[#151518] px-4 py-2.5 ring-1 ring-white/[0.06]">
                <span className="text-[11px] text-slate-500">You will receive</span>
                <span className="text-[13px] font-black text-emerald-400">{CURRENCY_SYMBOL} {(Number(amount) * (1 - MPESA_WITHDRAWAL_FEE_RATE)).toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 ring-1 ring-red-500/20">{error}</p>
            )}

            <button
              type="button"
              onClick={submitFiat}
              disabled={loading || !amount || !phone}
              className="h-14 w-full rounded-xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1990ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Withdraw via M-Pesa"}
            </button>
          </>
        )
      )}

      {/* ── Crypto tab ── */}
      {mode === "crypto" && (
        cwDone ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Icon name="check_circle" fill className="text-[54px] text-emerald-400" />
            <p className="text-2xl font-black text-white">Withdrawal submitted</p>
            <p className="text-sm font-bold text-slate-400">Your crypto is on its way. It may take a few minutes to arrive.</p>
          </div>
        ) : cryptoLoading ? (
          <div className="flex flex-col gap-3 py-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />)}
          </div>
        ) : !cryptoBalances.length ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Icon name="account_balance_wallet" fill className="text-[40px] text-slate-700" />
            <p className="text-sm font-black text-slate-400">No crypto balance</p>
            <p className="text-xs text-slate-600">Complete a P2P trade to earn crypto you can withdraw here.</p>
          </div>
        ) : (
          <>
            {/* Coin / network selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCwOpen((v) => !v)}
                className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#18191f] px-4 ring-1 ring-white/[0.08] transition hover:bg-white/[0.06]"
              >
                <span className="flex items-center gap-3">
                  {selectedBal && COIN_ICONS[selectedBal.crypto] ? (
                    <img src={COIN_ICONS[selectedBal.crypto]} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-black text-white">{selectedBal?.crypto?.[0]}</span>
                  )}
                  <span className="text-sm font-black text-white">
                    {selectedBal?.crypto}
                    <span className="ml-1.5 text-[11px] font-bold text-slate-500">{NET_LABEL[selectedBal?.network ?? ""] ?? selectedBal?.network}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-black text-slate-400">
                  {selectedBal?.available.toFixed(cwPrec)} avail.
                  <Icon name={cwOpen ? "expand_less" : "expand_more"} className="text-[18px]" />
                </span>
              </button>

              {cwOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl bg-[#151518] shadow-2xl shadow-black/50 ring-1 ring-white/[0.09]">
                  {cryptoBalances.map((b) => {
                    const p = b.crypto === "BTC" || b.crypto === "ETH" ? 8 : 6;
                    return (
                      <button
                        key={`${b.crypto}:${b.network}`}
                        type="button"
                        onClick={() => { setSelectedBal(b); setCwOpen(false); setCwAmount(""); }}
                        className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-white/[0.06]"
                      >
                        {COIN_ICONS[b.crypto] ? (
                          <img src={COIN_ICONS[b.crypto]} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-full" />
                        ) : (
                          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-slate-700 text-xs font-black text-white">{b.crypto[0]}</span>
                        )}
                        <span className="flex-1 text-left text-sm font-black text-white">
                          {b.crypto}
                          <span className="ml-1.5 text-[11px] font-bold text-slate-500">{NET_LABEL[b.network] ?? b.network}</span>
                        </span>
                        <span className="text-xs font-black text-slate-400">{b.available.toFixed(p)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="relative">
              <span className="absolute left-5 top-2 text-[10px] font-black text-slate-500">Amount ({selectedBal?.crypto})</span>
              <input
                type="number"
                step="any"
                value={cwAmount}
                onChange={(e) => { setCwAmount(e.target.value); setCwError(""); }}
                placeholder="0"
                className="h-14 w-full rounded-2xl bg-[#18191f] px-5 pt-4 pr-16 text-sm font-bold text-white outline-none ring-1 ring-white/[0.08] focus:ring-2 focus:ring-[#087cff]/50"
              />
              <button
                type="button"
                onClick={() => setCwAmount(selectedBal?.available.toFixed(cwPrec) ?? "")}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-white/[0.07] px-2 py-1 text-[10px] font-black text-[#087cff] transition hover:bg-white/[0.12]"
              >
                MAX
              </button>
            </div>

            {/* Destination address */}
            <input
              type="text"
              value={cwAddress}
              onChange={(e) => { setCwAddress(e.target.value); setCwError(""); }}
              placeholder={`Destination ${NET_LABEL[selectedBal?.network ?? ""] ?? selectedBal?.network} address`}
              className="h-14 w-full rounded-2xl bg-[#18191f] px-5 text-sm font-bold text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-600 focus:ring-2 focus:ring-[#087cff]/50"
            />

            <p className="text-[11px] text-slate-600">
              Min {MIN_CRYPTO[selectedBal?.crypto ?? ""] ?? 0} {selectedBal?.crypto} · 5% fee applies
            </p>
            {Number(cwAmount) > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[#151518] px-4 py-2.5 ring-1 ring-white/[0.06]">
                <span className="text-[11px] text-slate-500">You will receive</span>
                <span className="text-[13px] font-black text-emerald-400">{(Number(cwAmount) * 0.95).toFixed(cwPrec)} {selectedBal?.crypto}</span>
              </div>
            )}

            {cwError && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 ring-1 ring-red-500/20">{cwError}</p>
            )}

            <button
              type="button"
              onClick={submitCrypto}
              disabled={cwLoading || !cwAmount || !cwAddress.trim()}
              className="h-14 w-full rounded-xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1990ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cwLoading ? "Submitting…" : `Withdraw ${selectedBal?.crypto ?? "Crypto"}`}
            </button>
          </>
        )
      )}
    </div>
  );
}

// ── Sub-view: Bonuses ────────────────────────────────────────────────────────

function BonusesView() {
  return (
    <div className="px-5 pb-8 pt-2">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Welcome offer</p>
        <p className="mt-2 text-[1.35rem] font-black tracking-tight text-white">+130% First Deposit</p>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-400">
          Deposit at least KSh 150 and receive a 130% bonus on your first deposit.
        </p>
        <p className="mt-3 text-[12px] font-semibold text-slate-500">Wagering requirement: 5x</p>
      </div>
      <div className="py-10 text-center">
        <p className="text-[14px] font-bold text-slate-400">No active bonuses</p>
        <p className="mt-1 text-[12px] font-medium text-slate-600">Make your first deposit to claim your welcome bonus.</p>
      </div>
    </div>
  );
}

// ── Sub-view: Bonus codes ────────────────────────────────────────────────────

function BonusCodesView() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; code: string } | null>(null);
  const [notice, setNotice] = useState<{ kind: PromoNoticeKind; code: string } | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setLoading(true);
    const entered = code.trim().toUpperCase();
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: entered }),
      });
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean;
        amount?: number;
        code?: string;
        error?: string;
      };
      if (res.ok && data.ok) {
        window.dispatchEvent(new Event("wallet-refresh"));
        setSuccess({
          amount: Number(data.amount ?? 0),
          code: typeof data.code === "string" ? data.code : entered,
        });
        setCode("");
      } else {
        setNotice({
          kind: promoNoticeFromStatus(res.status, data.error),
          code: entered,
        });
        setCode("");
      }
    } catch {
      setNotice({ kind: "error", code: entered });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="px-5 pb-8 pt-2">
        <PromoSuccessCard
          amount={success.amount}
          code={success.code}
          cta="Apply another code"
          onDone={() => setSuccess(null)}
        />
      </div>
    );
  }

  if (notice) {
    return (
      <div className="px-5 pb-8 pt-2">
        <PromoNoticeCard
          kind={notice.kind}
          code={notice.code}
          cta={notice.kind === "already_used" ? "Got it" : "Try another code"}
          onDone={() => setNotice(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 pb-8 pt-2">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Promo code</p>
        <div className="flex items-center border-b border-white/[0.08] focus-within:border-[#087cff]/60">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="NEZEEM400"
            autoComplete="off"
            className="w-full bg-transparent py-3 text-center text-[1.35rem] font-black tracking-[0.2em] text-white outline-none placeholder:text-slate-700"
          />
        </div>
        <p className="mt-2 text-[12px] font-medium text-slate-500">Enter a promo or referral code to unlock rewards.</p>
      </div>
      <button
        type="button"
        onClick={apply}
        disabled={loading || !code.trim()}
        className="h-12 w-full rounded-xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1990ff] active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? "Checking…" : "Apply Code"}
      </button>
    </div>
  );
}

// ── Sub-view: Notifications ──────────────────────────────────────────────────

const NOTIF_KEYS = [
  { key: "notif_bets",   label: "Bet results",        sub: "When your bets are settled" },
  { key: "notif_promo",  label: "Promotions",         sub: "Bonuses and special offers" },
  { key: "notif_deposit",label: "Deposits & withdrawals", sub: "Wallet activity alerts" },
  { key: "notif_live",   label: "Live match alerts",  sub: "Score and status updates" },
];

function NotificationsView() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("nezeem_notif") ?? "{}");
    } catch { return {}; }
  });

  function toggle(key: string) {
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("nezeem_notif", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
      {NOTIF_KEYS.map((item) => (
        <div key={item.key} className="flex items-center gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-white">{item.label}</p>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">{item.sub}</p>
          </div>
          <button
            type="button"
            onClick={() => toggle(item.key)}
            className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${toggles[item.key] ? "bg-[#087cff]" : "bg-white/[0.10]"}`}
          >
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${toggles[item.key] ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Sub-view: Security ───────────────────────────────────────────────────────

type TwoFASetupState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "qr"; secret: string; uri: string }
  | { phase: "confirming"; secret: string; uri: string }
  | { phase: "done" };

function SecurityView({ email }: { email: string | undefined }) {
  const { user } = useSupabaseAuth();
  const [sent, setSent]       = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // 2FA state
  const is2FAEnabled = user?.user_metadata?.totp_enabled === true;
  const [setupState, setSetupState] = useState<TwoFASetupState>({ phase: "idle" });
  const [codeInput, setCodeInput]   = useState("");
  const [codeError, setCodeError]   = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  // Disable flow
  const [disabling, setDisabling]   = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disabled2FA, setDisabled2FA] = useState(false);
  const [emailOtpBusy, setEmailOtpBusy] = useState(false);
  const [emailOtpPhase, setEmailOtpPhase] = useState<"idle" | "sent" | "done">("idle");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpMasked, setEmailOtpMasked] = useState("");

  // Passkeys (WebAuthn) — withdrawal step-up (GoTrue MFA factors)

  // Sign-in passkeys — passwordless primary login (self-managed WebAuthn)
  const [signinPasskeys, setSigninPasskeys] = useState<Array<{ id: string; deviceName?: string | null; createdAt: string; lastUsedAt?: string | null }>>([]);
  const [signinPasskeyLoading, setSigninPasskeyLoading] = useState(false);
  const [signinPasskeyBusy, setSigninPasskeyBusy] = useState(false);

  const loadSigninPasskeys = useCallback(async () => {
    setSigninPasskeyLoading(true);
    try {
      const res = await fetch("/api/auth/passkey", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json() as { passkeys?: Array<{ id: string; deviceName?: string | null; createdAt: string; lastUsedAt?: string | null }> };
        setSigninPasskeys(j.passkeys ?? []);
      }
    } catch {
      // leave empty
    } finally {
      setSigninPasskeyLoading(false);
    }
  }, []);

  useEffect(() => { void loadSigninPasskeys(); }, [loadSigninPasskeys]);

  async function addSigninPasskey() {
    setSigninPasskeyBusy(true);
    try {
      const result = await enrollPasskey(`Passkey · ${new Date().toLocaleDateString()}`);
      if (!result.ok) {
        toast.error("Couldn't add sign-in passkey", result.error ?? "Please try again.");
        return;
      }
      toast.success("Sign-in passkey added", "You can now log in with this passkey — no password needed.");
      await loadSigninPasskeys();
    } catch {
      toast.error("Couldn't add sign-in passkey", "Your device may not support passkeys, or the prompt was dismissed.");
    } finally {
      setSigninPasskeyBusy(false);
    }
  }

  async function removeSigninPasskey(id: string) {
    setSigninPasskeyBusy(true);
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Couldn't remove passkey", "Try again."); return; }
      setSigninPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error("Couldn't remove passkey", "Try again.");
    } finally {
      setSigninPasskeyBusy(false);
    }
  }

  async function sendReset() {
    if (!email) return;
    setResetLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setResetLoading(false);
    }
  }

  async function startSetup() {
    setSetupState({ phase: "loading" });
    try {
      const res  = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      setSetupState({ phase: "qr", secret: data.secret as string, uri: data.uri as string });
    } catch (err) {
      setSetupState({ phase: "idle" });
      toast.error("Setup failed", err instanceof Error ? err.message : "Try again");
    }
  }

  async function confirmEnable() {
    if (setupState.phase !== "qr" && setupState.phase !== "confirming") return;
    const digits = codeInput.replace(/\D/g, "");
    if (digits.length !== 6) { setCodeError("Enter your 6-digit code"); return; }
    setCodeError("");
    setCodeLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/enable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ secret: setupState.secret, code: digits }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error ?? "Invalid code"); return; }
      setSetupState({ phase: "done" });
      toast.info("2FA enabled", "Google Authenticator is now protecting your account.");
    } catch {
      setCodeError("Network error — try again");
    } finally {
      setCodeLoading(false);
    }
  }

  async function confirmDisable() {
    const digits = disableCode.replace(/\D/g, "");
    if (digits.length !== 6) { setDisableError("Enter your 6-digit code"); return; }
    setDisableError("");
    setDisableLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/disable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: digits }),
      });
      const data = await res.json();
      if (!res.ok) { setDisableError(data.error ?? "Invalid code"); return; }
      setDisabling(false);
      setDisabled2FA(true);
      toast.info("2FA disabled", "Two-factor authentication has been removed.");
    } catch {
      setDisableError("Network error — try again");
    } finally {
      setDisableLoading(false);
    }
  }

  const effective2FA = (is2FAEnabled && !disabled2FA) || emailOtpPhase === "done";

  return (
    <div className="space-y-3 px-4 py-3">

      {/* Password reset */}
      {email && (
        <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Email</p>
            <p className="mt-0.5 text-[13px] font-black text-white">{email}</p>
          </div>
          <div className="mx-4 h-px bg-white/[0.05]" />
          <div className="px-4 py-3.5">
            {sent ? (
              <p className="text-[12px] font-bold text-emerald-400">Password reset email sent — check your inbox.</p>
            ) : (
              <button type="button" onClick={sendReset} disabled={resetLoading}
                className="text-[12px] font-black text-[#5ea9ff] transition hover:text-white disabled:opacity-50">
                {resetLoading ? "Sending…" : "Send password reset email"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 2FA card ── */}
      <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
            <Icon name="security" fill className="text-[16px] text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-black text-white">Two-Factor Authentication</p>
            <p className="text-[11px] text-slate-500">Pick one: authenticator app or email code</p>
          </div>
          {effective2FA || setupState.phase === "done" ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-400">On</span>
          ) : (
            <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-black text-slate-400">Off</span>
          )}
        </div>

        {/* ── ENABLED: show disable option ── */}
        {(effective2FA || setupState.phase === "done") && (
          <div className="border-t border-white/[0.05] px-4 py-3.5">
            {!disabling ? (
              <button type="button" onClick={() => { setDisabling(true); setDisableCode(""); setDisableError(""); }}
                className="text-[12px] font-black text-red-400 transition hover:text-red-300">
                Disable 2FA…
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-400">
                  Enter your authenticator or email code to confirm:
                </p>
                {user?.user_metadata?.email_otp_enabled === true && (
                  <button
                    type="button"
                    disabled={emailOtpBusy}
                    onClick={async () => {
                      setEmailOtpBusy(true); setDisableError("");
                      try {
                        const res = await fetch("/api/auth/2fa/email/send", { method: "POST" });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error ?? "Could not send code");
                        toast.success("Code sent", "Check your email, then enter it below.");
                      } catch (err) {
                        setDisableError(err instanceof Error ? err.message : "Could not send code");
                      } finally {
                        setEmailOtpBusy(false);
                      }
                    }}
                    className="text-[11px] font-black text-[#5ea9ff]"
                  >
                    {emailOtpBusy ? "Sending…" : "Email me a code"}
                  </button>
                )}
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={disableCode}
                  onChange={(e) => { setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setDisableError(""); }}
                  placeholder="000000"
                  className="h-11 w-full rounded-xl bg-white/[0.06] text-center text-base font-black tracking-[0.2em] text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#087cff]/50"
                  autoFocus
                />
                {disableError && <p className="text-[11px] font-bold text-red-400">{disableError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={confirmDisable} disabled={disableLoading || disableCode.length !== 6}
                    className="flex-1 rounded-xl bg-red-500/15 py-2 text-[12px] font-black text-red-400 ring-1 ring-red-500/20 transition hover:bg-red-500/25 disabled:opacity-50">
                    {disableLoading ? "Verifying…" : "Confirm disable"}
                  </button>
                  <button type="button" onClick={() => setDisabling(false)}
                    className="flex-1 rounded-xl bg-white/[0.06] py-2 text-[12px] font-black text-slate-400 transition hover:bg-white/[0.1]">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── NOT ENABLED: choose authenticator app OR email OTP ── */}
        {!effective2FA && setupState.phase === "idle" && emailOtpPhase === "idle" && (
          <div className="space-y-2 border-t border-white/[0.05] px-4 py-3.5">
            <p className="text-[11px] font-bold text-slate-500">Choose only one method:</p>
            <button type="button" onClick={startSetup}
              className="flex w-full items-center justify-between rounded-xl bg-[#151518] px-3 py-3 text-left ring-1 ring-white/[0.06] transition hover:bg-white/[0.07]">
              <span>
                <span className="block text-[12px] font-black text-white">Authenticator app</span>
                <span className="block text-[10px] font-bold text-slate-500">Google Authenticator / Authy</span>
              </span>
              <Icon name="chevron_right" className="text-[16px] text-slate-500" />
            </button>
            <button
              type="button"
              disabled={!email || emailOtpBusy}
              onClick={async () => {
                if (!email) { toast.error("Email required", "Add an email to your account first."); return; }
                setEmailOtpBusy(true); setEmailOtpError("");
                try {
                  const res = await fetch("/api/auth/2fa/email/send", { method: "POST" });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error ?? "Could not send code");
                  setEmailOtpMasked(typeof data.maskedEmail === "string" ? data.maskedEmail : email);
                  setEmailOtpPhase("sent");
                  toast.success("Code sent", "Check your email for the 6-digit code.");
                } catch (err) {
                  toast.error("Could not send code", err instanceof Error ? err.message : "Try again");
                } finally {
                  setEmailOtpBusy(false);
                }
              }}
              className="flex w-full items-center justify-between rounded-xl bg-[#151518] px-3 py-3 text-left ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              <span>
                <span className="block text-[12px] font-black text-white">Email code</span>
                <span className="block text-[10px] font-bold text-slate-500">
                  {emailOtpBusy ? "Sending…" : email ? `Send a code to ${email}` : "Add an email first"}
                </span>
              </span>
              <Icon name="chevron_right" className="text-[16px] text-slate-500" />
            </button>
          </div>
        )}

        {!effective2FA && emailOtpPhase === "sent" && (
          <div className="space-y-3 border-t border-white/[0.05] px-4 py-3.5">
            <p className="text-[11px] font-bold text-slate-400">
              Enter the 6-digit code we sent to <span className="text-slate-200">{emailOtpMasked || email}</span>
            </p>
            <input
              type="text" inputMode="numeric" maxLength={6}
              value={emailOtpCode}
              onChange={(e) => { setEmailOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailOtpError(""); }}
              placeholder="000000"
              className="h-11 w-full rounded-xl bg-white/[0.06] text-center text-base font-black tracking-[0.2em] text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#087cff]/50"
              autoFocus
            />
            {emailOtpError && <p className="text-[11px] font-bold text-red-400">{emailOtpError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={emailOtpBusy || emailOtpCode.length !== 6}
                onClick={async () => {
                  setEmailOtpBusy(true); setEmailOtpError("");
                  try {
                    const res = await fetch("/api/auth/2fa/email/enable", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: emailOtpCode }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) { setEmailOtpError(data.error ?? "Invalid code"); return; }
                    setEmailOtpPhase("done");
                    toast.success("Email authentication on", "We'll email a code when you sign in.");
                  } catch {
                    setEmailOtpError("Network error — try again");
                  } finally {
                    setEmailOtpBusy(false);
                  }
                }}
                className="flex-1 rounded-xl bg-[#087cff] py-2 text-[12px] font-black text-white disabled:opacity-50"
              >
                {emailOtpBusy ? "Verifying…" : "Activate email 2FA"}
              </button>
              <button
                type="button"
                onClick={() => { setEmailOtpPhase("idle"); setEmailOtpCode(""); setEmailOtpError(""); }}
                className="rounded-xl bg-white/[0.06] px-4 text-[12px] font-black text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {emailOtpPhase === "done" && !disabling && (
          <div className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-3.5">
            <Icon name="check_circle" fill className="text-[16px] text-emerald-400" />
            <p className="text-[12px] font-bold text-emerald-400">Email authentication is active</p>
          </div>
        )}

        {setupState.phase === "loading" && (
          <div className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-3.5">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-[#087cff]" />
            <span className="text-[12px] font-bold text-slate-500">Generating secret…</span>
          </div>
        )}

        {(setupState.phase === "qr" || setupState.phase === "confirming") && (
          <div className="space-y-4 border-t border-white/[0.05] px-4 py-4">
            <div>
              <p className="text-[12px] font-black text-white">1. Scan this QR code with Google Authenticator</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Or manually enter the key below the QR code.</p>
            </div>

            {/* QR code via Google Charts */}
            <div className="flex justify-center">
              <div className="rounded-2xl bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupState.uri)}&bgcolor=ffffff&color=000000&margin=4`}
                  alt="2FA QR code"
                  width={148}
                  height={148}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#151518] px-3 py-2.5 ring-1 ring-white/[0.06]">
              <p className="text-[10px] font-bold text-slate-500 mb-1 text-center">Manual key</p>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 break-all text-center font-mono text-[12px] font-black tracking-wider text-white">{setupState.secret}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(setupState.secret);
                      toast.success("Key copied", "Paste it into your authenticator app.");
                    } catch {
                      toast.error("Couldn't copy", "Copy the key manually.");
                    }
                  }}
                  aria-label="Copy manual key"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300 transition hover:bg-[#087cff] hover:text-white"
                >
                  <Icon name="content_copy" className="text-[14px]" />
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-black text-white">2. Enter the 6-digit code to confirm</p>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(""); }}
                placeholder="000000"
                className="h-12 w-full rounded-xl bg-white/[0.06] text-center text-xl font-black tracking-[0.25em] text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#087cff]/50"
                autoFocus
              />
              {codeError && <p className="mt-1.5 text-[11px] font-bold text-red-400">{codeError}</p>}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={confirmEnable} disabled={codeLoading || codeInput.length !== 6}
                className="flex-1 rounded-xl bg-[#087cff] py-2.5 text-[13px] font-black text-white transition hover:bg-[#1990ff] disabled:opacity-50">
                {codeLoading ? "Verifying…" : "Activate 2FA"}
              </button>
              <button type="button" onClick={() => { setSetupState({ phase: "idle" }); setCodeInput(""); setCodeError(""); }}
                className="rounded-xl bg-white/[0.06] px-4 text-[13px] font-black text-slate-400 transition hover:bg-white/[0.1]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {setupState.phase === "done" && !disabling && (
          <div className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-3.5">
            <Icon name="check_circle" fill className="text-[16px] text-emerald-400" />
            <p className="text-[12px] font-bold text-emerald-400">2FA is active on your account</p>
          </div>
        )}
      </div>

      {/* ── Sign-in passkeys card (passwordless login) ── */}
      <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
            <Icon name="passkey" fill className="text-[16px] text-[#5ea9ff]" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-black text-white">Passkeys</p>
            <p className="text-[11px] text-slate-500">Log in and confirm withdrawals with Face ID, fingerprint or a security key — no password</p>
          </div>
        </div>

        {signinPasskeys.length > 0 && (
          <div>
            {signinPasskeys.map((pk) => (
              <div key={pk.id} className="mx-4 flex items-center justify-between border-t border-white/[0.05] py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-white">{pk.deviceName || "Passkey"}</p>
                  <p className="text-[10px] text-slate-600">Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                </div>
                <button type="button" onClick={() => removeSigninPasskey(pk.id)} disabled={signinPasskeyBusy}
                  className="shrink-0 text-[11px] font-black text-red-400/80 transition hover:text-red-400 disabled:opacity-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mx-4 h-px bg-white/[0.05]" />
        <div className="px-4 py-3.5">
          <button type="button" onClick={addSigninPasskey} disabled={signinPasskeyBusy || signinPasskeyLoading}
            className="text-[12px] font-black text-[#5ea9ff] transition hover:text-white disabled:opacity-50">
            {signinPasskeyBusy ? "Working…" : signinPasskeyLoading ? "Loading…" : "+ Add a sign-in passkey"}
          </button>
        </div>
      </div>

      {/* KYC card */}
      <div className="overflow-hidden rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
            <Icon name="verified_user" fill className="text-[16px] text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-black text-white">KYC Verification</p>
            <p className="text-[11px] text-slate-500">Verify your identity to unlock higher limits</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-400">Soon</span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-view: Language & Region ──────────────────────────────────────────────

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

function LanguageView() {
  const [lang, setLang] = useState("en");

  return (
    <div className="px-5 pb-8 pt-2">
      <h3 className="mb-1 text-[13px] font-black text-white">Language</h3>
      <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => { setLang(l.code); toast.info("Language updated", `${l.label} selected.`); }}
            className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-white/[0.02]"
          >
            <span className="text-xl">{l.flag}</span>
            <span className="flex-1 text-[14px] font-bold text-white">{l.label}</span>
            {lang === l.code && <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />}
          </button>
        ))}
      </div>

      <h3 className="mb-1 mt-8 text-[13px] font-black text-white">Region</h3>
      <div className="flex items-center gap-3 border-y border-white/[0.06] py-3.5">
        <span className="text-xl">🇰🇪</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-white">Kenya</p>
          <p className="text-[12px] font-medium text-slate-500">Ledger: KES · Timezone: EAT (UTC+3)</p>
        </div>
        <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />
      </div>
    </div>
  );
}

function CurrencyView() {
  return <CurrencySwitcher variant="sheet" />;
}

// ── Sub-view: Help & Support ─────────────────────────────────────────────────

const SUPPORT_CHANNELS = [
  { icon: "chat",          label: "WhatsApp",   sub: "Fastest response",     href: `https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "254700000000"}`, color: "text-emerald-400" },
  { icon: "telegram",      label: "Telegram",   sub: "@NeezemSupport",       href: "https://t.me/NeezemSupport", color: "text-[#5ea9ff]" },
  { icon: "mail",          label: "Email",      sub: "support@nezeem.com",   href: "mailto:support@nezeem.com",  color: "text-slate-400" },
];

function SupportView() {
  return (
    <div className="px-5 pb-8 pt-2">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-[13px] font-bold text-white">Support is online · 24/7</p>
      </div>
      <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
        {SUPPORT_CHANNELS.map((ch) => (
          <a
            key={ch.label}
            href={ch.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-3.5 transition hover:bg-white/[0.02]"
          >
            <Icon name={ch.icon} fill className={`text-[18px] ${ch.color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white">{ch.label}</p>
              <p className="text-[12px] font-medium text-slate-500">{ch.sub}</p>
            </div>
            <Icon name="open_in_new" className="text-[14px] text-slate-600" />
          </a>
        ))}
      </div>

      <h3 className="mb-1 mt-8 text-[13px] font-black text-white">FAQ</h3>
      <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
        {["How do I deposit?", "How long do withdrawals take?", "How do I place a bet?"].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => toast.info(q, "Visit our full FAQ page for detailed answers.")}
            className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-white/[0.02]"
          >
            <span className="text-[13px] font-bold text-slate-300">{q}</span>
            <Icon name="chevron_right" className="shrink-0 text-[16px] text-slate-600" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const VIEW_TITLES: Record<ProfileView, string> = {
  main: "Profile",
  settings: "Settings",
  bets: "Bet History",
  transactions: "Transaction History",
  withdraw: "Withdraw",
  bonuses: "Bonuses",
  "bonus-codes": "Bonus Codes",
  notifications: "Notifications",
  security: "Security",
  language: "Language & Region",
  currency: "Display currency",
  support: "Help & Support",
};

export function ProfileModal({ onClose, onOpenWallet, initialView }: Props) {
  const { user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();
  const [view, setView] = useState<ProfileView>(initialView ?? "main");
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);

  const meta        = user?.user_metadata ?? {};
  const displayName = currentUsername ?? meta.username ?? meta.first_name ?? user?.email?.split("@")[0] ?? "User";
  const initials    = displayName.charAt(0).toUpperCase();
  const metaAvatar  = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  const avatarUrl   = avatarOverride ?? metaAvatar;
  const email       = user?.email;
  const phone       = user?.phone ?? meta.phone_number ?? null;
  const isVerified  = user?.email_confirmed_at != null;
  const fmtBalance  = `${currency === "KES" ? CURRENCY_SYMBOL : currency} ${balance.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2 })}`;
  const memberId    = user?.id?.slice(-8).toUpperCase() ?? "—";

  const back = useCallback(() => {
    if (view === "notifications" || view === "security" || view === "language" || view === "currency" || view === "support") {
      setView("settings");
    } else {
      setView("main");
    }
  }, [view]);

  async function handleSignOut() {
    await signOut();
    onClose();
    toast.info("Signed out", "See you next time!");
    router.push("/");
  }

  function startEditUsername() {
    setUsernameInput(displayName);
    setUsernameError("");
    setEditingUsername(true);
  }

  async function saveUsername() {
    const val = usernameInput.trim();
    if (!val) return;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(val)) {
      setUsernameError("3–20 chars, letters/numbers/underscore only");
      return;
    }
    setUsernameSaving(true);
    setUsernameError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: val }),
      });
      const data = await res.json();
      if (!res.ok) { setUsernameError(data.error ?? "Failed to save"); return; }
      setCurrentUsername(data.username);
      setEditingUsername(false);
      toast.info("Username updated", `You're now @${data.username}`);
    } catch {
      setUsernameError("Network error — try again");
    } finally {
      setUsernameSaving(false);
    }
  }

  const { code: displayCode, currency: displayCurrency } = useCurrency();

  const MENU = [
    { icon: "redeem",              label: "Bonuses",             sub: "Free spins and other offers",     action: () => setView("bonuses") },
    { icon: "confirmation_number", label: "Bonus codes",         sub: "Code activation",                 action: () => setView("bonus-codes") },
    { icon: "history",             label: "Bet history",         sub: "Open and settled bets",           action: () => setView("bets") },
    { icon: "receipt_long",        label: "Transaction history", sub: "Deposit and withdrawal statuses", action: () => setView("transactions") },
  ];

  const SETTINGS_ITEMS = [
    { icon: "notifications", label: "Notifications",     sub: "Push & email alerts",       action: () => setView("notifications") },
    { icon: "security",      label: "Security & 2FA",    sub: "Password, two-factor auth", action: () => setView("security") },
    { icon: "payments",      label: "Display currency",  sub: `${displayCode} · ${displayCurrency.name}`, action: () => setView("currency") },
    { icon: "language",      label: "Language & Region", sub: "English · Kenya",           action: () => setView("language") },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-[1.5rem] bg-[#151518] shadow-2xl ring-1 ring-white/[0.08] sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:max-w-md lg:max-w-3xl"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />

        {/* Header — wallet-style centered title + ghost circular controls */}
        <div className="grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 pb-2 pt-3 sm:px-5">
          {view !== "main" ? (
            <button
              type="button"
              onClick={back}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
              aria-label="Back"
            >
              <Icon name="arrow_back" className="text-[20px]" />
            </button>
          ) : (
            <span />
          )}
          <h2 className="text-center text-[15px] font-black tracking-tight text-white">{VIEW_TITLES[view]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center justify-self-end rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="no-scrollbar flex-1 overflow-y-auto bg-[#151518]">

          {/* ── MAIN ── */}
          {view === "main" && (
            <div className="mx-auto max-w-md px-5 pb-10 pt-4 sm:max-w-2xl lg:grid lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-10 lg:px-8">
              <div>
                {/* Identity — flat, no card */}
                <div className="flex items-center gap-3">
                  <AvatarUploader
                    currentUrl={avatarUrl}
                    initials={initials}
                    onUploaded={setAvatarOverride}
                    sizeClass="h-14 w-14"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-black tracking-tight text-white">{displayName}</p>
                    <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-500">ID {memberId}</p>
                    {isVerified && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#75b8ff]">
                        <Icon name="verified" fill className="text-[12px]" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Username edit */}
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                  {editingUsername ? (
                    <div>
                      <div className="flex items-center gap-2 border-b border-white/[0.08] focus-within:border-[#087cff]/60">
                        <span className="text-sm font-black text-slate-500">@</span>
                        <input
                          autoFocus
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
                          maxLength={20}
                          placeholder="your_username"
                          className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] font-bold text-white outline-none"
                        />
                      </div>
                      {usernameError && <p className="mt-1.5 text-[12px] font-bold text-red-400">{usernameError}</p>}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={saveUsername}
                          disabled={usernameSaving}
                          className="flex-1 rounded-xl bg-[#087cff] py-2.5 text-[12px] font-black text-white transition hover:bg-[#0970e8] disabled:opacity-50"
                        >
                          {usernameSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUsername(false)}
                          className="flex-1 rounded-xl py-2.5 text-[12px] font-black text-slate-300 transition hover:bg-white/[0.06]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Icon name="alternate_email" fill className="shrink-0 text-[14px] text-slate-500" />
                        <p className="truncate text-[14px] font-bold text-white">@{displayName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={startEditUsername}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        <Icon name="edit" className="text-[12px]" />
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Balance — bare like wallet */}
                <section className="mt-8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Account balance
                    </p>
                    <CurrencySwitcher />
                  </div>
                  <p className="mt-2 text-[1.75rem] font-black leading-none tracking-tight text-white sm:text-[2rem]">
                    {fmtBalance}
                  </p>
                  <div className="mt-8 grid grid-cols-4 gap-2">
                    {[
                      { label: "Deposit", icon: "arrow_downward", action: () => { onClose(); onOpenWallet("deposit"); } },
                      { label: "Send", icon: "send", action: () => { onClose(); onOpenWallet("send"); } },
                      { label: "Withdraw", icon: "arrow_upward", action: () => { onClose(); onOpenWallet("withdraw"); } },
                      { label: "History", icon: "history", action: () => setView("transactions") },
                    ].map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.action}
                        className="flex flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition hover:bg-white/[0.04] active:scale-[0.96]"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/[0.06]">
                          <Icon name={action.icon} className="text-[20px]" />
                        </span>
                        <span className="text-[11px] font-bold text-slate-300">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-8 lg:mt-0">
                <h3 className="mb-1 text-[13px] font-black text-white">Account</h3>
                <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
                  {MENU.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-white/[0.02] active:scale-[0.99]"
                    >
                      <Icon name={item.icon} fill className="shrink-0 text-[18px] text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-white">{item.label}</p>
                        <p className="text-[12px] font-medium text-slate-500">{item.sub}</p>
                      </div>
                      <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                    </button>
                  ))}
                </div>

                <h3 className="mb-1 mt-8 text-[13px] font-black text-white">More</h3>
                <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setView("support")}
                    className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-white/[0.02]"
                  >
                    <Icon name="support_agent" fill className="shrink-0 text-[18px] text-slate-400" />
                    <span className="flex-1 text-[14px] font-bold text-white">Support</span>
                    <span className="text-[11px] font-bold text-[#75b8ff]">24/7</span>
                    <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("settings")}
                    className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-white/[0.02]"
                  >
                    <Icon name="settings" fill className="shrink-0 text-[18px] text-slate-400" />
                    <span className="flex-1 text-[14px] font-bold text-white">Settings</span>
                    <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-8 flex w-full items-center justify-center gap-2 py-3 text-[13px] font-bold text-red-400 transition hover:text-red-300"
                >
                  <Icon name="logout" className="text-[16px]" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {view === "settings" && (
            <div className="mx-auto max-w-md px-5 pb-10 pt-2">
              {(email || phone) && (
                <>
                  <h3 className="mb-1 text-[13px] font-black text-white">Contact info</h3>
                  <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
                    {email && (
                      <div className="flex items-center justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-white">{email}</p>
                          <p className="text-[12px] font-medium text-slate-500">Email address</p>
                        </div>
                        <span className={`shrink-0 text-[11px] font-bold ${isVerified ? "text-emerald-400" : "text-slate-500"}`}>
                          {isVerified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                    )}
                    {phone && (
                      <div className="flex items-center justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-white">{phone}</p>
                          <p className="text-[12px] font-medium text-slate-500">Phone number</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-emerald-400">Verified</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <h3 className={`mb-1 text-[13px] font-black text-white ${(email || phone) ? "mt-8" : ""}`}>Preferences</h3>
              <div className="divide-y divide-white/[0.05] border-y border-white/[0.06]">
                {SETTINGS_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-white/[0.02] active:scale-[0.99]"
                  >
                    <Icon name={item.icon} fill className="shrink-0 text-[18px] text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-white">{item.label}</p>
                      <p className="text-[12px] font-medium text-slate-500">{item.sub}</p>
                    </div>
                    <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                  </button>
                ))}
              </div>

              <h3 className="mb-1 mt-8 text-[13px] font-black text-white">Sessions</h3>
              <div className="flex items-center justify-between gap-3 border-y border-white/[0.06] py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white">Active sessions</p>
                  <p className="text-[12px] font-medium text-slate-500">This device · {new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="shrink-0 text-[12px] font-bold text-red-400 transition hover:text-red-300"
                >
                  End all
                </button>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-8 flex w-full items-center justify-center gap-2 py-3 text-[13px] font-bold text-red-400 transition hover:text-red-300"
              >
                <Icon name="logout" className="text-[16px]" />
                Sign Out
              </button>
            </div>
          )}

          {/* ── SUB-VIEWS ── */}
          {view === "bets"         && <BetsView />}
          {view === "transactions" && <TransactionsView />}
          {view === "withdraw"     && <WithdrawView balance={balance} currency={currency} onSuccess={(nb) => { refreshBalance(); }} />}
          {view === "bonuses"      && <BonusesView />}
          {view === "bonus-codes"  && <BonusCodesView />}
          {view === "notifications"&& <NotificationsView />}
          {view === "security"     && <SecurityView email={email} />}
          {view === "language"     && <LanguageView />}
          {view === "currency"     && <CurrencyView />}
          {view === "support"      && <SupportView />}
        </div>
      </div>
    </div>
  );
}
