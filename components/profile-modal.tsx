"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";

type View =
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
  | "support";

type Props = { onClose: () => void; onOpenWallet: () => void; initialView?: View };

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
  WON:     "bg-emerald-500/15 text-emerald-400",
  LOST:    "bg-red-500/15 text-red-400",
  VOID:    "bg-slate-500/15 text-slate-400",
  PENDING: "bg-amber-500/15 text-amber-400",
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
      <div className="flex flex-col gap-3 px-4 py-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  if (!bets.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon name="receipt_long" className="text-[48px] text-slate-700" />
        <p className="text-sm font-black text-slate-400">No bets yet</p>
        <p className="text-xs text-slate-600">Place your first bet to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 py-3">
      {bets.map((bet) => (
        <div key={bet.id} className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
          <button
            type="button"
            onClick={() => setExpanded(expanded === bet.id ? null : bet.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <Icon
              name={bet.type === "MULTI" ? "dynamic_feed" : "sports_soccer"}
              fill
              className="text-[18px] text-slate-500 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-black text-white">
                {bet.selections.length === 1
                  ? bet.selections[0].matchName
                  : `${bet.type} · ${bet.selections.length} selections`}
              </p>
              <p className="text-[10px] text-slate-500">{fmtDate(bet.createdAt)} · KSh {bet.stake.toLocaleString()}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_STYLE[bet.status] ?? STATUS_STYLE.PENDING}`}>
              {bet.status}
            </span>
          </button>

          {expanded === bet.id && (
            <div className="border-t border-white/[0.06] px-4 pb-3 pt-2 space-y-2">
              {bet.selections.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-black text-white">{s.matchName}</p>
                    <p className="text-[10px] text-slate-500">{s.market} · {s.label}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-black text-[#087cff]">{Number(s.odds).toFixed(2)}</span>
                    {s.result !== "PENDING" && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${STATUS_STYLE[s.result] ?? STATUS_STYLE.PENDING}`}>
                        {s.result}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-2">
                <span className="text-[10px] text-slate-500">
                  {bet.status === "WON" ? "Won" : "Potential"}: KSh {(bet.winAmount ?? bet.potentialWin).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500">Odds: {Number(bet.totalOdds).toFixed(2)}</span>
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
      <div className="flex flex-col gap-3 px-4 py-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <Icon name="error" fill className="text-[40px] text-red-400/70" />
        <p className="text-sm font-black text-slate-400">Could not load transactions</p>
        <p className="text-xs text-slate-600">{error}</p>
      </div>
    );
  }

  if (!txns.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <Icon name="receipt_long" fill className="text-[48px] text-slate-700" />
        <p className="text-sm font-black text-slate-400">No transactions yet</p>
        <p className="text-xs text-slate-600">Your deposits and withdrawals will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 py-3">
      {txns.map((t) => {
        const meta = TXN_META[t.type] ?? { label: t.type, icon: "swap_horiz", color: "text-white", sign: "+" as const };
        return (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
              <Icon name={meta.icon} fill className={`text-[18px] ${meta.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white">{meta.label}</p>
              <p className="text-[10px] text-slate-600">
                {new Date(t.createdAt).toLocaleDateString("en-KE", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
                {t.provider ? ` · ${t.provider}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[14px] font-black ${meta.color}`}>
                {meta.sign}KSh {Number(t.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-[10px] font-black uppercase ${
                t.status === "COMPLETED" ? "text-emerald-500/70"
                : t.status === "FAILED"  ? "text-red-400/70"
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
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        const bals = Array.isArray(data) ? (data as CryptoBal[]).filter((b) => b.available > 0) : [];
        setCryptoBalances(bals);
        if (bals.length && !selectedBal) setSelectedBal(bals[0]);
      })
      .catch(() => {})
      .finally(() => setCryptoLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fmtBal = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
  const cwPrec = selectedBal?.crypto === "BTC" || selectedBal?.crypto === "ETH" ? 8 : 6;

  async function submitFiat() {
    setError("");
    const amt = Number(amount);
    if (!amt || amt < 100) { setError("Minimum withdrawal is KSh 100"); return; }
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
    <div className="space-y-4 px-4 py-3">

      {/* ── Mode tabs ── */}
      <div className="grid grid-cols-2 rounded-2xl bg-white/[0.04] p-1 ring-1 ring-white/[0.07]">
        <button
          type="button"
          onClick={() => { setMode("fiat"); setDone(false); setError(""); }}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${mode === "fiat" ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white"}`}
        >
          <Icon name="phone_iphone" fill className="text-[15px]" />
          M-Pesa
        </button>
        <button
          type="button"
          onClick={() => { setMode("crypto"); setCwDone(false); setCwError(""); }}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-black transition ${mode === "crypto" ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white"}`}
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
            <div className="rounded-2xl bg-[#16171d] px-4 py-3 ring-1 ring-white/[0.07]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Available</p>
              <p className="text-2xl font-black text-white">{fmtBal}</p>
            </div>

            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="M-Pesa number (07XX or 01XX)"
              className="h-14 w-full rounded-2xl bg-[#16171d] px-5 text-sm font-bold text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-600 focus:ring-2 focus:ring-[#087cff]/50"
            />

            <div className="relative">
              <span className="absolute left-5 top-2 text-[10px] font-black text-slate-500">Amount (KSh)</span>
              <input
                type="number"
                min="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 w-full rounded-2xl bg-[#16171d] px-5 pt-4 text-sm font-bold text-white outline-none ring-1 ring-white/[0.08] focus:ring-2 focus:ring-[#087cff]/50"
              />
            </div>

            <p className="text-[11px] text-slate-600">Min KSh 100 · Max KSh 150,000 · 5% fee applies</p>
            {Number(amount) > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-white/[0.06]">
                <span className="text-[11px] text-slate-500">You will receive</span>
                <span className="text-[13px] font-black text-emerald-400">KSh {(Number(amount) * 0.95).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 ring-1 ring-red-500/20">{error}</p>
            )}

            <button
              type="button"
              onClick={submitFiat}
              disabled={loading || !amount || !phone}
              className="h-14 w-full rounded-xl bg-[#087cff] text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex h-14 w-full items-center justify-between rounded-2xl bg-[#16171d] px-4 ring-1 ring-white/[0.08] transition hover:bg-white/[0.06]"
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
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl bg-[#111316] shadow-2xl shadow-black/50 ring-1 ring-white/[0.09]">
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
                className="h-14 w-full rounded-2xl bg-[#16171d] px-5 pt-4 pr-16 text-sm font-bold text-white outline-none ring-1 ring-white/[0.08] focus:ring-2 focus:ring-[#087cff]/50"
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
              className="h-14 w-full rounded-2xl bg-[#16171d] px-5 text-sm font-bold text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-600 focus:ring-2 focus:ring-[#087cff]/50"
            />

            <p className="text-[11px] text-slate-600">
              Min {MIN_CRYPTO[selectedBal?.crypto ?? ""] ?? 0} {selectedBal?.crypto} · 5% fee applies
            </p>
            {Number(cwAmount) > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-white/[0.06]">
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
              className="h-14 w-full rounded-xl bg-[#087cff] text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1990ff] disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="space-y-3 px-4 py-3">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#11365b] via-[#087cff]/40 to-[#05b957]/20 p-5 ring-1 ring-[#087cff]/30">
        <p className="text-xs font-black uppercase tracking-widest text-[#5ea9ff]">Welcome Offer</p>
        <p className="mt-1 text-xl font-black text-white">+130% First Deposit</p>
        <p className="mt-1 text-xs font-bold text-slate-300">Deposit at least KSh 150 and receive a 130% bonus on your first deposit.</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-[10px] font-black text-white/70">
          <Icon name="info" fill className="text-[13px]" /> Wagering requirement: 5x
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#16171d] py-10 text-center ring-1 ring-white/[0.07]">
        <Icon name="redeem" fill className="text-[42px] text-slate-700" />
        <p className="text-sm font-black text-slate-400">No active bonuses</p>
        <p className="text-xs text-slate-600">Make your first deposit to claim your welcome bonus.</p>
      </div>
    </div>
  );
}

// ── Sub-view: Bonus codes ────────────────────────────────────────────────────

function BonusCodesView() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 800));
    // Stub: no real backend for codes yet
    setResult({ ok: false, message: "Invalid or expired bonus code." });
    setLoading(false);
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <div className="rounded-2xl bg-[#16171d] p-4 ring-1 ring-white/[0.07]">
        <p className="text-[11px] font-bold text-slate-500">Enter a promo or referral code to unlock rewards.</p>
      </div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="BONUS CODE"
        className="h-14 w-full rounded-2xl bg-[#16171d] px-5 text-center text-base font-black tracking-widest text-white outline-none ring-1 ring-white/[0.08] placeholder:text-slate-600 focus:ring-2 focus:ring-[#087cff]/50"
      />
      {result && (
        <p className={`rounded-xl px-4 py-3 text-sm font-bold ring-1 ${result.ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" : "bg-red-500/10 text-red-300 ring-red-500/20"}`}>
          {result.message}
        </p>
      )}
      <button
        type="button"
        onClick={apply}
        disabled={loading || !code.trim()}
        className="h-14 w-full rounded-xl bg-[#087cff] text-sm font-black text-white transition hover:bg-[#1990ff] disabled:opacity-50"
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
    <div className="px-4 py-3">
      <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
        {NOTIF_KEYS.map((item, i) => (
          <div key={item.key}>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1">
                <p className="text-[13px] font-black text-white">{item.label}</p>
                <p className="text-[11px] text-slate-500">{item.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(item.key)}
                className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${toggles[item.key] ? "bg-[#087cff]" : "bg-white/[0.10]"}`}
              >
                <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${toggles[item.key] ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {i < NOTIF_KEYS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-view: Security ───────────────────────────────────────────────────────

function SecurityView({ email }: { email: string | undefined }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendReset() {
    if (!email) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch {
      setSent(true); // don't leak whether the email exists
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {email && (
        <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Email</p>
            <p className="mt-0.5 text-[13px] font-black text-white">{email}</p>
          </div>
          <div className="mx-4 h-px bg-white/[0.05]" />
          <div className="px-4 py-3.5">
            {sent ? (
              <p className="text-[12px] font-bold text-emerald-400">Password reset email sent — check your inbox.</p>
            ) : (
              <button
                type="button"
                onClick={sendReset}
                disabled={loading}
                className="text-[12px] font-black text-[#5ea9ff] transition hover:text-white disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send password reset email"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
            <Icon name="security" fill className="text-[16px] text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-black text-white">Two-Factor Authentication</p>
            <p className="text-[11px] text-slate-500">Extra layer of account security</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-400">Soon</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
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
    <div className="space-y-3 px-4 py-3">
      <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
        <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Language</p>
        {LANGUAGES.map((l, i) => (
          <div key={l.code}>
            <button
              type="button"
              onClick={() => { setLang(l.code); toast.info("Language updated", `${l.label} selected.`); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
            >
              <span className="text-xl">{l.flag}</span>
              <span className="flex-1 text-[13px] font-black text-white">{l.label}</span>
              {lang === l.code && <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />}
            </button>
            {i < LANGUAGES.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
        <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Region</p>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-xl">🇰🇪</span>
          <div className="flex-1">
            <p className="text-[13px] font-black text-white">Kenya</p>
            <p className="text-[11px] text-slate-500">Currency: KES · Timezone: EAT (UTC+3)</p>
          </div>
          <Icon name="check_circle" fill className="text-[18px] text-[#087cff]" />
        </div>
      </div>
    </div>
  );
}

// ── Sub-view: Help & Support ─────────────────────────────────────────────────

const SUPPORT_CHANNELS = [
  { icon: "chat",          label: "WhatsApp",   sub: "Fastest response",     href: `https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "254700000000"}`, color: "text-emerald-400" },
  { icon: "telegram",      label: "Telegram",   sub: "@NeezemSupport",       href: "https://t.me/NeezemSupport", color: "text-[#5ea9ff]" },
  { icon: "mail",          label: "Email",      sub: "support@nezeem.com",   href: "mailto:support@nezeem.com",  color: "text-slate-400" },
];

function SupportView() {
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-[12px] font-black text-white">Support is online · 24/7</p>
        </div>
        {SUPPORT_CHANNELS.map((ch, i) => (
          <div key={ch.label}>
            <a
              href={ch.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <Icon name={ch.icon} fill className={`text-[16px] ${ch.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-black text-white">{ch.label}</p>
                <p className="text-[11px] text-slate-500">{ch.sub}</p>
              </div>
              <Icon name="open_in_new" className="text-[14px] text-slate-600" />
            </a>
            {i < SUPPORT_CHANNELS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[#16171d] px-4 py-3.5 ring-1 ring-white/[0.07]">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">FAQ</p>
        {["How do I deposit?", "How long do withdrawals take?", "How do I place a bet?"].map((q, i) => (
          <div key={i} className={`py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}>
            <button
              type="button"
              onClick={() => toast.info(q, "Visit our full FAQ page for detailed answers.")}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-[12px] font-bold text-slate-300">{q}</span>
              <Icon name="chevron_right" className="text-[14px] text-slate-600 shrink-0" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const VIEW_TITLES: Record<View, string> = {
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
  support: "Help & Support",
};

export function ProfileModal({ onClose, onOpenWallet, initialView }: Props) {
  const { user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();
  const [view, setView] = useState<View>(initialView ?? "main");
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  const meta        = user?.user_metadata ?? {};
  const displayName = currentUsername ?? meta.username ?? meta.first_name ?? user?.email?.split("@")[0] ?? "User";
  const initials    = displayName.charAt(0).toUpperCase();
  const avatarUrl   = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  const email       = user?.email;
  const phone       = user?.phone ?? meta.phone_number ?? null;
  const isVerified  = user?.email_confirmed_at != null;
  const fmtBalance  = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
  const memberId    = user?.id?.slice(-8).toUpperCase() ?? "—";

  const back = useCallback(() => {
    if (view === "notifications" || view === "security" || view === "language" || view === "support") {
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

  const MENU = [
    { icon: "redeem",              label: "Bonuses",             sub: "Free spins and other offers",     action: () => setView("bonuses") },
    { icon: "confirmation_number", label: "Bonus codes",         sub: "Code activation",                 action: () => setView("bonus-codes") },
    { icon: "history",             label: "Bet history",         sub: "Open and settled bets",           action: () => setView("bets") },
    { icon: "receipt_long",        label: "Transaction history", sub: "Deposit and withdrawal statuses", action: () => setView("transactions") },
  ];

  const SETTINGS_ITEMS = [
    { icon: "notifications", label: "Notifications",     sub: "Push & email alerts",       action: () => setView("notifications") },
    { icon: "security",      label: "Security & 2FA",    sub: "Password, two-factor auth", action: () => setView("security") },
    { icon: "language",      label: "Language & Region", sub: "English · Kenya",           action: () => setView("language") },
    { icon: "support_agent", label: "Help & Support",    sub: "24/7 live chat",            action: () => setView("support") },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-[#111316] shadow-2xl ring-1 ring-white/[0.08] sm:max-w-sm sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle mobile */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/10 sm:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {view !== "main" && (
              <button
                type="button"
                onClick={back}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <Icon name="arrow_back" className="text-[16px]" />
              </button>
            )}
            <h2 className="text-lg font-black text-white">{VIEW_TITLES[view]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="no-scrollbar flex-1 overflow-y-auto">

          {/* ── MAIN ── */}
          {view === "main" && (
            <>
              <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-1 text-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-full object-cover shadow-[0_0_30px_rgba(8,124,255,0.24)] ring-2 ring-white/[0.08]"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#087cff] to-[#0556c8] text-2xl font-black text-white shadow-[0_0_30px_rgba(8,124,255,0.4)]">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-lg font-black text-white">{displayName}</p>
                  <p className="font-mono text-[11px] text-slate-500">ID {memberId}</p>
                </div>
              </div>

              {/* ── Username editor ── */}
              <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Username</p>
                {editingUsername ? (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm font-black">@</span>
                      <input
                        autoFocus
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); if (e.key === "Escape") setEditingUsername(false); }}
                        maxLength={20}
                        placeholder="your_username"
                        className="min-w-0 flex-1 rounded-xl bg-white/[0.07] px-3 py-2 text-[13px] font-black text-white outline-none ring-1 ring-white/[0.08] focus:ring-[#087cff]/60"
                      />
                    </div>
                    {usernameError && <p className="mt-1.5 text-[11px] font-bold text-red-400">{usernameError}</p>}
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={saveUsername}
                        disabled={usernameSaving}
                        className="flex-1 rounded-xl bg-[#087cff] py-2 text-[12px] font-black text-white transition hover:bg-[#0970e8] disabled:opacity-50"
                      >
                        {usernameSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingUsername(false)}
                        className="flex-1 rounded-xl bg-white/[0.06] py-2 text-[12px] font-black text-slate-300 transition hover:bg-white/[0.1]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="alternate_email" fill className="text-[15px] text-slate-500" />
                      <p className="text-[13px] font-black text-white">@{displayName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={startEditUsername}
                      className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-black text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      <Icon name="edit" className="text-[12px]" />
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.08]">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Balance</p>
                  <p className="mt-0.5 text-3xl font-black text-white">{fmtBalance}</p>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => { onClose(); onOpenWallet(); }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#05b957] py-2.5 text-sm font-black text-white transition hover:bg-[#07cc63] active:scale-[0.98]"
                  >
                    <Icon name="add_circle" fill className="text-[16px]" />
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("withdraw")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] py-2.5 text-sm font-black text-slate-300 ring-1 ring-white/[0.09] transition hover:bg-white/[0.11] active:scale-[0.98]"
                  >
                    <Icon name="remove_circle" fill className="text-[16px] text-slate-400" />
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                {MENU.map((item, i) => (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] active:scale-[0.99]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                        <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.sub}</p>
                      </div>
                      <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                    </button>
                    {i < MENU.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
                  </div>
                ))}
              </div>

              <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setView("settings")}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Icon name="settings" fill className="text-[16px] text-slate-400" />
                  </div>
                  <span className="flex-1 text-[13px] font-black text-white">Settings</span>
                  <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                </button>
              </div>

              <div className="px-4 pb-6">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/[0.07] py-3 text-sm font-black text-red-400 ring-1 ring-red-500/[0.12] transition hover:bg-red-500/[0.12] hover:ring-red-500/30"
                >
                  <Icon name="logout" className="text-[16px]" />
                  Sign Out
                </button>
              </div>
            </>
          )}

          {/* ── SETTINGS ── */}
          {view === "settings" && (
            <>
              {(email || phone) && (
                <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">Contact Info</p>
                  {email && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon name="mail" fill className="text-[15px] text-slate-500" />
                        <div>
                          <p className="text-[12px] font-black text-white">{email}</p>
                          <p className="text-[10px] text-slate-600">Email address</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isVerified ? "bg-emerald-500/12 text-emerald-400" : "bg-amber-500/12 text-amber-400"}`}>
                        {isVerified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  )}
                  {email && phone && <div className="mx-4 h-px bg-white/[0.05]" />}
                  {phone && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Icon name="phone" fill className="text-[15px] text-slate-500" />
                        <div>
                          <p className="text-[12px] font-black text-white">{phone}</p>
                          <p className="text-[10px] text-slate-600">Phone number</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-black text-emerald-400">Verified</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                {SETTINGS_ITEMS.map((item, i) => (
                  <div key={item.label}>
                    <button type="button" onClick={item.action} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] active:scale-[0.99]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                        <Icon name={item.icon} fill className="text-[16px] text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-black text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.sub}</p>
                      </div>
                      <Icon name="chevron_right" className="text-[16px] text-slate-600" />
                    </button>
                    {i < SETTINGS_ITEMS.length - 1 && <div className="mx-4 h-px bg-white/[0.05]" />}
                  </div>
                ))}
              </div>

              <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                      <Icon name="devices" fill className="text-[16px] text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-white">Active sessions</p>
                      <p className="text-[11px] text-slate-500">This device · {new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs font-black text-red-400 transition hover:text-red-300"
                  >
                    End all
                  </button>
                </div>
              </div>

              <div className="px-4 pb-6">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/[0.07] py-3 text-sm font-black text-red-400 ring-1 ring-red-500/[0.12] transition hover:bg-red-500/[0.12] hover:ring-red-500/30"
                >
                  <Icon name="logout" className="text-[16px]" />
                  Sign Out
                </button>
              </div>
            </>
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
          {view === "support"      && <SupportView />}
        </div>
      </div>
    </div>
  );
}
