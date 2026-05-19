"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useBetslip } from "@/lib/betslip-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";

type MyBet = {
  id: string;
  type: string;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  winAmount: number | null;
  status: string;
  createdAt: string;
  selections: { matchName: string; market: string; label: string; odds: number; result: string }[];
};

function statusColor(s: string) {
  if (s === "WON") return "text-emerald-400";
  if (s === "LOST") return "text-red-400";
  if (s === "VOID") return "text-slate-400";
  return "text-amber-400";
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    WON: "bg-emerald-500/15 text-emerald-400",
    LOST: "bg-red-500/15 text-red-400",
    VOID: "bg-white/[0.07] text-slate-400",
    PENDING: "bg-amber-500/15 text-amber-400",
    CASHED_OUT: "bg-purple-500/15 text-purple-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${colors[status] ?? colors.PENDING}`}>
      {status}
    </span>
  );
}

export function SportsBetSlip() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const { bets, removeBet, clearBets } = useBetslip();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"single" | "multi" | "mybets">("single");
  const [placing, setPlacing] = useState(false);
  const [placedMsg, setPlacedMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);

  const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.value || "1"), 1);
  const multiStake = parseFloat(amounts["__multi__"] || "0");
  const multiPayout = multiStake > 0 ? (multiStake * totalOdds).toFixed(2) : null;

  const fetchMyBets = useCallback(async () => {
    if (!isSignedIn) return;
    setBetsLoading(true);
    try {
      const res = await fetch("/api/bets/mine?limit=20");
      if (res.ok) setMyBets(await res.json());
    } finally {
      setBetsLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (tab === "mybets") fetchMyBets();
  }, [tab, fetchMyBets]);

  async function placeBets() {
    if (!isSignedIn) { openLogin(); return; }
    setPlacing(true);
    setPlacedMsg(null);

    try {
      if (tab === "multi") {
        if (!multiStake || multiStake <= 0) {
          setPlacedMsg({ ok: false, text: "Enter a stake amount" });
          return;
        }
        const res = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "MULTI",
            stake: multiStake,
            selections: bets.map((b) => ({
              fixtureId: b.id.split("-")[0],
              matchName: b.matchName,
              market: b.market,
              label: b.label,
              odds: parseFloat(b.value),
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setPlacedMsg({ ok: true, text: `Multi bet placed! Possible win: KSh ${data.bet.potentialWin.toFixed(2)}` });
        clearBets();
        refreshBalance();
      } else {
        // Place each single bet
        const results = await Promise.all(
          bets.map(async (bet) => {
            const stake = parseFloat(amounts[bet.id] || "0");
            if (!stake || stake <= 0) return { ok: false, name: bet.label, error: "No stake" };
            const res = await fetch("/api/bets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "SINGLE",
                stake,
                selections: [{
                  fixtureId: bet.id.split("-")[0],
                  matchName: bet.matchName,
                  market: bet.market,
                  label: bet.label,
                  odds: parseFloat(bet.value),
                }],
              }),
            });
            const data = await res.json();
            return res.ok ? { ok: true } : { ok: false, error: data.error };
          })
        );
        const failed = results.filter((r) => !r.ok);
        const placed = results.filter((r) => r.ok).length;
        if (placed > 0) {
          setPlacedMsg({
            ok: failed.length === 0,
            text: failed.length === 0
              ? `${placed} bet${placed > 1 ? "s" : ""} placed!`
              : `${placed} placed, ${failed.length} failed: ${failed.map((f) => f.error).join(", ")}`,
          });
          clearBets();
          refreshBalance();
        } else {
          setPlacedMsg({ ok: false, text: failed[0]?.error ?? "Failed to place bets" });
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setPlacedMsg({ ok: false, text: e.message ?? "Something went wrong" });
    } finally {
      setPlacing(false);
    }
  }

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── client-side balance guard ──
  const stakeTotal = tab === "multi"
    ? multiStake
    : bets.reduce((sum, b) => sum + parseFloat(amounts[b.id] || "0"), 0);
  const notEnoughFunds = isSignedIn && stakeTotal > 0 && stakeTotal > balance;

  return (
    <div className="flex h-full w-full flex-col bg-[#0d0e11]">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-black text-white">Betslip</span>
          {bets.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#087cff] text-[10px] font-black text-white">
              {bets.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSignedIn && (
            <Link href="/wallet" className="flex items-center gap-1 rounded-full bg-white/[0.07] px-3 py-1.5 transition hover:bg-white/[0.12]">
              <Icon name="account_balance_wallet" className="text-[13px] text-slate-400" />
              <span className="text-[12px] font-black text-slate-300">{fmtBalance}</span>
            </Link>
          )}
          {bets.length > 0 && (
            <button
              type="button"
              onClick={clearBets}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
              aria-label="Clear betslip"
            >
              <Icon name="delete_outline" className="text-[16px]" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-b border-white/[0.07]">
        {(["single", "multi", "mybets"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[11px] font-black transition ${
              tab === t
                ? "border-b-2 border-[#087cff] text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "single" ? `Single${bets.length > 0 ? ` (${bets.length})` : ""}` : t === "multi" ? "Multi" : "My Bets"}
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {/* ── Success / error flash ── */}
        {placedMsg && (
          <div className={`mx-3 mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold ${
            placedMsg.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            <Icon name={placedMsg.ok ? "check_circle" : "error"} fill className="text-[16px] shrink-0" />
            <span className="flex-1">{placedMsg.text}</span>
            <button type="button" onClick={() => setPlacedMsg(null)}>
              <Icon name="close" className="text-[13px]" />
            </button>
          </div>
        )}

        {tab === "mybets" ? (
          /* ── My Bets ── */
          <div className="divide-y divide-white/[0.05]">
            {!isSignedIn ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Icon name="lock" fill className="text-[32px] text-slate-600 mb-3" />
                <p className="text-sm font-black text-slate-500">Sign in to see your bets</p>
                <button type="button" onClick={openLogin}
                  className="mt-4 rounded-xl bg-[#087cff] px-5 py-2 text-xs font-black text-white">
                  Log in
                </button>
              </div>
            ) : betsLoading ? (
              <div className="flex justify-center py-10">
                <svg className="h-6 w-6 animate-spin text-[#087cff]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : myBets.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Icon name="receipt_long" className="text-[32px] text-slate-600 mb-3" />
                <p className="text-sm font-black text-slate-500">No bets yet</p>
              </div>
            ) : (
              myBets.map((bet) => (
                <div key={bet.id} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase">{bet.type}</span>
                      <StatusBadge status={bet.status} />
                    </div>
                    <span className="text-[10px] text-slate-600">
                      {new Date(bet.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {bet.selections.map((s, i) => (
                    <div key={i} className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] text-slate-500">{s.matchName}</div>
                        <div className="truncate text-[11px] font-black text-white">{s.market} · {s.label}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="text-[11px] font-black text-[#087cff]">{s.odds.toFixed(2)}</span>
                        {s.result !== "PENDING" && (
                          <span className={`text-[9px] font-black uppercase ${statusColor(s.result)}`}>{s.result}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px]">
                    <span className="text-slate-500">Stake <span className="font-black text-white">KSh {bet.stake.toFixed(2)}</span></span>
                    {bet.status === "WON" && bet.winAmount ? (
                      <span className="font-black text-emerald-400">Won KSh {bet.winAmount.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-500">To win <span className={`font-black ${statusColor(bet.status)}`}>KSh {bet.potentialWin.toFixed(2)}</span></span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        ) : bets.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05]">
              <Icon name="receipt_long" className="text-[28px] text-slate-600" />
            </span>
            <p className="text-sm font-black text-slate-500">Your betslip is empty</p>
            <p className="mt-1 text-[11px] text-slate-600">Click odds on any match to add selections</p>
          </div>

        ) : tab === "single" ? (
          /* ── Single bets — edge-to-edge cards ── */
          <div className="divide-y divide-white/[0.05]">
            {bets.map((bet) => {
              const stake = parseFloat(amounts[bet.id] || "0");
              const payout = stake > 0 ? (stake * parseFloat(bet.value)).toFixed(2) : null;
              return (
                <div key={bet.id} className="px-4 py-3">
                  {/* Match + odds + remove */}
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] text-slate-500">{bet.matchName}</div>
                      <div className="truncate text-[13px] font-black text-white">{bet.market} · {bet.label}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-lg bg-[#087cff] px-2.5 py-0.5 text-[13px] font-black text-white tabular-nums">
                        {bet.value}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBet(bet.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
                      >
                        <Icon name="close" className="text-[13px]" />
                      </button>
                    </div>
                  </div>

                  {/* Stake row */}
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/[0.06]">
                    <input
                      type="number"
                      min="0"
                      placeholder="Bet amount"
                      value={amounts[bet.id] ?? ""}
                      onChange={(e) => { setAmounts((a) => ({ ...a, [bet.id]: e.target.value })); }}
                      className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      className="shrink-0 text-[11px] font-black text-[#087cff] transition hover:text-[#4fa8ff]"
                      onClick={() => setAmounts((a) => ({ ...a, [bet.id]: String(Math.floor(balance)) }))}
                    >
                      All in
                    </button>
                  </div>

                  {/* Possible win */}
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Possible win</span>
                    <span className={`font-black ${payout ? "text-emerald-400" : "text-slate-600"}`}>
                      KSh {payout ?? "0.00"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (
          /* ── Multi bet ── */
          <div className="divide-y divide-white/[0.05]">
            {bets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] text-slate-500">{bet.matchName}</div>
                  <div className="truncate text-[11px] font-black text-white">{bet.label}</div>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className="text-[12px] font-black text-[#087cff]">{bet.value}</span>
                  <button type="button" onClick={() => removeBet(bet.id)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-slate-500 hover:text-red-400">
                    <Icon name="close" className="text-[11px]" />
                  </button>
                </div>
              </div>
            ))}
            {/* Multi stake card */}
            <div className="px-4 py-3">
              <div className="mb-2.5 flex items-center justify-between text-[12px]">
                <span className="text-slate-400 font-bold">Total odds</span>
                <span className="font-black text-white tabular-nums">{totalOdds.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/[0.06]">
                <input
                  type="number"
                  min="0"
                  placeholder="Bet amount"
                  value={amounts["__multi__"] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, __multi__: e.target.value }))}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600"
                />
                <button type="button" className="shrink-0 text-[11px] font-black text-[#087cff]"
                  onClick={() => setAmounts((a) => ({ ...a, __multi__: String(Math.floor(balance)) }))}>
                  All in
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Possible win</span>
                <span className={`font-black ${multiPayout ? "text-emerald-400" : "text-slate-600"}`}>
                  KSh {multiPayout ?? "0.00"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: not enough funds / place bet ── */}
      {bets.length > 0 && tab !== "mybets" && (
        <div className="shrink-0 border-t border-white/[0.07] p-3">
          {notEnoughFunds ? (
            /* ── Not enough funds card ── */
            <div className="mb-3 flex flex-col items-center gap-2 rounded-2xl bg-[#16171d] px-4 py-4 text-center ring-1 ring-white/[0.07]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                <Icon name="warning" fill className="text-[20px] text-amber-400" />
              </div>
              <p className="text-[13px] font-black text-white">Not enough funds</p>
              <p className="text-[11px] text-slate-500">Top up your account to continue</p>
              <Link
                href="/wallet"
                className="mt-1 w-full rounded-xl bg-[#05b957] py-2.5 text-center text-[13px] font-black text-white transition hover:bg-[#07cc63]"
              >
                Deposit
              </Link>
            </div>
          ) : (
            <>
              {!isSignedIn && (
                <p className="mb-2 text-center text-[11px] text-slate-500">
                  <button type="button" onClick={openLogin} className="font-bold text-[#087cff] hover:underline">Log in</button>
                  {" "}to place bets
                </p>
              )}
              <button
                type="button"
                onClick={placeBets}
                disabled={placing}
                className="w-full rounded-2xl bg-[#06c96e] py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(6,201,110,.3)] transition hover:bg-[#05b85f] active:scale-[.98] disabled:opacity-60"
              >
                {placing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Placing…
                  </span>
                ) : isSignedIn ? (
                  `Place ${bets.length === 1 ? "Bet" : `${bets.length} Bets`}`
                ) : "Log in to Bet"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
