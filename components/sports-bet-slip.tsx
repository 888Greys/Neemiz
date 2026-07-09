"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useBetslip } from "@/lib/betslip-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { MONEY_LOCALE } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { formatInCurrency } from "@/lib/currency-config";

// ─── Types ────────────────────────────────────────────────────────────────────

type MyBet = {
  id: string;
  type: string;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  winAmount: number | null;
  status: string;
  createdAt: string;
  selections: { matchName: string; market: string; label: string; odds: number; result: string; kickoff?: string | null }[];
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
    VOID: "bg-white/[0.06] text-slate-400",
    PENDING: "bg-amber-500/15 text-amber-400",
    CASHED_OUT: "bg-[#087cff]/15 text-[#75b8ff]",
  };
  const label = status === "PENDING" ? "Running" : status.replace("_", " ");
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${colors[status] ?? colors.PENDING}`}>
      {label}
    </span>
  );
}

// ─── Wheel of Fortune ─────────────────────────────────────────────────────────

// Must match the server SEGMENTS in /api/wheel/spin exactly (same order/index).
const WHEEL_SEGS = [
  { label: "×0.5", mult: 0.5, fill: "#1f2937", text: "#cbd5e1" },
  { label: "×2",   mult: 2,   fill: "#087cff", text: "#fff"    },
  { label: "×0",   mult: 0,   fill: "#2a1118", text: "#fb7185" },
  { label: "×1.5", mult: 1.5, fill: "#1a3a6c", text: "#75b8ff" },
  { label: "×3",   mult: 3,   fill: "#0055b3", text: "#fff"    },
  { label: "×0",   mult: 0,   fill: "#2a1118", text: "#fb7185" },
  { label: "×2",   mult: 2,   fill: "#087cff", text: "#fff"    },
  { label: "×0.5", mult: 0.5, fill: "#1f2937", text: "#cbd5e1" },
  { label: "×5",   mult: 5,   fill: "#b45309", text: "#fde68a" },
  { label: "×0",   mult: 0,   fill: "#2a1118", text: "#fb7185" },
  { label: "×1.5", mult: 1.5, fill: "#1a3a6c", text: "#75b8ff" },
  { label: "×10",  mult: 10,  fill: "#7c3aed", text: "#fff"    },
];

const N = WHEEL_SEGS.length;
const DEG = 360 / N;
const CX = 100, CY = 100, R = 86, TEXT_R = 58;

function polarXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(i: number) {
  const s = polarXY(CX, CY, R, i * DEG);
  const e = polarXY(CX, CY, R, (i + 1) * DEG);
  return `M${CX},${CY} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${R},${R},0,0,1,${e.x.toFixed(2)},${e.y.toFixed(2)}Z`;
}

type WheelResult = { segmentIndex: number; label: string; multiplier: number; stake: number; winAmount: number; netChange: number };

const MIN_PLAY_AMOUNT = 10;
const USER_PROFIT_RATE = 0.70;

function kickoffEAT(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString(MONEY_LOCALE, {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function retainedPayout(stake: number, grossPayout: number) {
  if (grossPayout <= stake) return grossPayout;
  return stake + (grossPayout - stake) * USER_PROFIT_RATE;
}

function WheelOfFortune({
  balance,
  isSignedIn,
  openLogin,
  refreshBalance,
}: {
  balance: number;
  isSignedIn: boolean;
  openLogin: () => void;
  refreshBalance: () => void;
}) {
  const [rotation, setRotation]   = useState(0);
  const [loading,  setLoading]    = useState(false);
  const [spinning, setSpinning]   = useState(false);
  const [animating, setAnimating] = useState(false);
  const [result, setResult]       = useState<WheelResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [amount, setAmount]       = useState("50");

  // `amount` is what the user typed, in the active DISPLAY currency; the server
  // and balance are canonical KES, so convert at the edge.
  const { convert, toKes, format, currency } = useCurrency();
  const amt            = parseFloat(amount || "0");           // display units
  const amtKes         = Math.round(toKes(amt));              // → canonical KES
  const notEnoughFunds = isSignedIn && amt > 0 && amtKes > balance;

  async function spin() {
    if (!isSignedIn) { openLogin(); return; }
    if (spinning || animating || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);

    // Call the server — it decides the winner and deducts/credits balance
    let data: WheelResult;
    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amtKes }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Spin failed"); setLoading(false); return; }
      data = json as WheelResult;
    } catch {
      setError("Network error — please try again");
      setLoading(false);
      return;
    }
    setLoading(false);

    // Animate wheel to land on the server-determined segment
    const segMid = data.segmentIndex * DEG + DEG / 2;
    const newRot = rotation + 5 * 360 + ((360 - ((rotation % 360 + segMid) % 360)) % 360);

    setAnimating(true);
    setSpinning(true);
    setRotation(newRot);

    setTimeout(() => {
      setSpinning(false);
      setAnimating(false);
      setResult(data);
      refreshBalance();
      window.dispatchEvent(new Event("wallet-refresh"));
    }, 4200);
  }

  return (
    <div className="flex flex-col items-center px-4 pb-4 pt-2">
      {/* Wheel container */}
      <div className="relative mb-3" style={{ width: 200, height: 200 }}>
        {/* Pointer */}
        <div className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]">
          <svg width="16" height="18" viewBox="0 0 16 18">
            <path d="M8 18 L0 0 L16 0 Z" fill="white" />
          </svg>
        </div>

        {/* SVG wheel */}
        <svg
          width="200"
          height="200"
          style={{
            transform:  `rotate(${rotation}deg)`,
            transition: animating ? "transform 4.2s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
            display: "block",
          }}
        >
          <circle cx={CX} cy={CY} r={R + 3} fill="none" stroke="#087cff" strokeWidth="1" opacity="0.25" />
          <circle cx={CX} cy={CY} r={R + 1} fill="none" stroke="#087cff" strokeWidth="0.5" opacity="0.4" />

          {WHEEL_SEGS.map((seg, i) => {
            const mid = i * DEG + DEG / 2;
            return (
              <g key={i}>
                <path d={slicePath(i)} fill={seg.fill} stroke="#0d0e11" strokeWidth="1.5" />
                <g transform={`rotate(${mid},${CX},${CY})`}>
                  <text
                    x={CX} y={CY - TEXT_R}
                    fill={seg.text}
                    fontSize="9.5" fontWeight="900"
                    textAnchor="middle" dominantBaseline="middle"
                    style={{ userSelect: "none", fontFamily: "inherit" }}
                  >
                    {seg.label}
                  </text>
                </g>
                {(() => {
                  const p = polarXY(CX, CY, R - 4, i * DEG);
                  return <circle cx={p.x} cy={p.y} r="2" fill="#0d0e11" opacity="0.7" />;
                })()}
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="16" fill="#0d0e11" stroke="#1e2a3a" strokeWidth="2" />
          <circle cx={CX} cy={CY} r="7"  fill="#087cff" />
          <circle cx={CX} cy={CY} r="3"  fill="#fff" opacity="0.6" />
        </svg>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 w-full rounded-2xl bg-red-500/10 px-4 py-2.5 text-center ring-1 ring-red-500/20">
          <p className="text-[12px] font-bold text-red-400">{error}</p>
        </div>
      )}

      {/* Win/loss result */}
      {result && (
        <div className={`mb-3 w-full rounded-2xl px-4 py-3 text-center ring-1 transition-all ${
          result.netChange < 0
            ? "bg-red-500/10 ring-red-500/20"
            : result.multiplier >= 5
            ? "bg-amber-500/10 ring-amber-500/20"
            : "bg-emerald-500/10 ring-emerald-500/20"
        }`}>
          <p className={`text-[11px] font-bold mb-0.5 ${
            result.netChange < 0 ? "text-red-400" : result.multiplier >= 5 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {result.multiplier === 0 ? "No win" : result.netChange < 0 ? "Partial return" : result.multiplier >= 5 ? "Big win!" : "You won!"}
          </p>
          <p className={`text-xl font-black tabular-nums ${
            result.netChange < 0 ? "text-red-400" : result.multiplier >= 5 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {result.multiplier === 0
              ? `${format(result.stake)} lost`
              : result.netChange < 0
              ? `${format(result.winAmount)} returned`
              : `+${format(result.netChange)} profit`}
          </p>
        </div>
      )}

      {/* Win info bar */}
      <div className="mb-3 w-full rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Win</span>
          <span className={`font-black tabular-nums ${
            result ? result.netChange < 0 ? "text-red-400" : "text-emerald-400" : "text-slate-300"
          }`}>
            {result ? format(result.winAmount) : "—"}
          </span>
        </div>
      </div>

      {/* Bet amount input */}
      <div className="mb-2 w-full">
        <div
          className={`flex items-center gap-2 rounded-xl bg-[#1c2433] px-3 py-2.5 ring-1 transition ${
            notEnoughFunds ? "ring-red-500/40" : "ring-white/[0.06] focus-within:ring-[#087cff]/50"
          }`}
        >
          <span className="shrink-0 text-[11px] font-black text-slate-500">{currency.symbol}</span>
          <input
            type="number"
            min={convert(MIN_PLAY_AMOUNT)}
            placeholder="Bet amount"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-black tabular-nums text-white outline-none placeholder:text-slate-600"
          />
        </div>
        {notEnoughFunds && (
          <p className="mt-1 text-[10px] font-bold text-red-400">
            Insufficient balance — {format(balance)} available
          </p>
        )}
      </div>

      <p className="mb-2.5 self-start text-[10px] text-slate-600">
        from {format(MIN_PLAY_AMOUNT)} to {balance > 0 ? format(balance) : "—"}
      </p>

      <div className="mb-3 flex w-full gap-1.5">
        {([1.5, 2, 3] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setAmount((v) => (parseFloat(v || "0") * m).toFixed(2))}
            className="flex-1 rounded-lg bg-[#141820] py-1.5 text-[11px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-[#087cff]/15 hover:text-[#75b8ff]"
          >
            ×{m}
          </button>
        ))}
      </div>

      {!isSignedIn ? (
        <button
          type="button"
          onClick={openLogin}
          className="w-full rounded-xl bg-[#087cff] py-3.5 text-sm font-black text-white transition hover:bg-[#0570e8] active:scale-[.99]"
        >
          Log in to Spin
        </button>
      ) : notEnoughFunds ? (
        <Link
          href="/wallet"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#06c96e] py-3.5 text-sm font-black text-white transition hover:bg-[#05b85f] active:scale-[.99]"
        >
          <Icon name="account_balance_wallet" className="h-4 w-4" />
          Deposit to Spin
        </Link>
      ) : (
        <button
          type="button"
          onClick={spin}
          disabled={spinning || loading || !amt || amtKes < MIN_PLAY_AMOUNT}
          className="w-full rounded-xl bg-[#087cff] py-3.5 text-sm font-black text-white transition hover:bg-[#0570e8] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {spinning || loading ? <LoadingDots label={loading ? "Placing" : "Spinning"} /> : "Spin"}
        </button>
      )}
    </div>
  );
}

// ─── Main Betslip ─────────────────────────────────────────────────────────────

export function SportsBetSlip() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin }  = useAuthModal();
  const { bets, removeBet, clearBets } = useBetslip();
  const { balance, refresh: refreshBalance } = useWalletBalance();
  // Stakes are entered/shown in the active display currency; server stays KES.
  const { convert, toKes, format, currency: dispCur } = useCurrency();

  const [amounts,    setAmounts]    = useState<Record<string, string>>({});
  const [tab,        setTab]        = useState<"single" | "multi" | "mybets">("single");
  const [showWheel,  setShowWheel]  = useState(false);
  const [placing,    setPlacing]    = useState(false);
  const [placedMsg,  setPlacedMsg]  = useState<{ ok: boolean; text: string } | null>(null);
  const [myBets,     setMyBets]     = useState<MyBet[]>([]);
  const [betsLoading,setBetsLoading]= useState(false);
  const [expandedBet,setExpandedBet]= useState<string | null>(null);

  const totalOdds  = bets.reduce((acc, b) => acc * parseFloat(b.value || "1"), 1);
  // `amounts` values are display-currency strings; *_Kes are the canonical
  // amounts sent to / compared against the KES server + wallet balance.
  const multiStake = parseFloat(amounts["__multi__"] || "0");        // display
  const multiStakeKes = Math.round(toKes(multiStake));               // KES
  // Payout preview is computed from the display stake, so it's already in the
  // display currency — render it directly (do NOT re-convert).
  const multiPayout= multiStake > 0 ? retainedPayout(multiStake, multiStake * totalOdds).toFixed(2) : null;

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

  // Auto-refresh every 30 s while the My Bets tab is open and bets are still PENDING
  const hasPendingBets = myBets.some((b) => b.status === "PENDING");
  useEffect(() => {
    if (tab !== "mybets" || !hasPendingBets) return;
    const id = setInterval(fetchMyBets, 30_000);
    return () => clearInterval(id);
  }, [tab, hasPendingBets, fetchMyBets]);

  async function placeBets() {
    if (!isSignedIn) { openLogin(); return; }
    setPlacing(true);
    setPlacedMsg(null);
    try {
      if (tab === "multi") {
        if (!multiStake || multiStakeKes < MIN_PLAY_AMOUNT) {
          setPlacedMsg({ ok: false, text: `Minimum stake is ${format(MIN_PLAY_AMOUNT)}` });
          return;
        }
        const res = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "MULTI",
            stake: multiStakeKes,
            selections: bets.map((b) => ({
              fixtureId: b.id.split("-")[0],
              matchName: b.matchName,
              market:    b.market,
              label:     b.label,
              odds:      parseFloat(b.value),
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        clearBets(); refreshBalance(); window.dispatchEvent(new Event("wallet-refresh"));
        await fetchMyBets(); setTab("mybets");
      } else {
        const results = await Promise.all(
          bets.map(async (bet) => {
            const stake = parseFloat(amounts[bet.id] || "0");           // display
            const stakeKes = Math.round(toKes(stake));                  // KES
            if (!stake || stakeKes < MIN_PLAY_AMOUNT) return { ok: false, error: `Minimum stake is ${format(MIN_PLAY_AMOUNT)}` };
            const res = await fetch("/api/bets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "SINGLE", stake: stakeKes,
                selections: [{
                  fixtureId: bet.id.split("-")[0],
                  matchName: bet.matchName,
                  market:    bet.market,
                  label:     bet.label,
                  odds:      parseFloat(bet.value),
                }],
              }),
            });
            const data = await res.json();
            return res.ok ? { ok: true } : { ok: false, error: data.error };
          })
        );
        const placed = results.filter((r) => r.ok).length;
        if (placed > 0) {
          clearBets(); refreshBalance(); window.dispatchEvent(new Event("wallet-refresh"));
          await fetchMyBets(); setTab("mybets");
        } else {
          setPlacedMsg({ ok: false, text: results[0]?.error ?? "Failed to place bets" });
        }
      }
    } catch (err: unknown) {
      setPlacedMsg({ ok: false, text: (err as Error).message ?? "Something went wrong" });
    } finally {
      setPlacing(false);
    }
  }

  const fmtBalance = format(balance);

  const stakeTotal = tab === "multi"
    ? multiStake
    : bets.reduce((sum, b) => sum + parseFloat(amounts[b.id] || "0"), 0);
  const notEnoughFunds = isSignedIn && stakeTotal > 0 && toKes(stakeTotal) > balance;

  return (
    <>
      <div className="flex h-full min-h-0 w-full flex-col bg-[#0d0e11]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#141820] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-black text-white">Betslip</span>
            {bets.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#087cff] px-1.5 text-[10px] font-black tabular-nums text-white">
                {bets.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isSignedIn && (
              <Link
                href="/wallet"
                className="flex items-center gap-1 rounded-full bg-[#1c2433] px-2.5 py-1.5 transition hover:bg-[#243044]"
              >
                <Icon name="account_balance_wallet" className="h-3 w-3 text-slate-500" />
                <span className="text-[11px] font-black tabular-nums text-slate-300">{fmtBalance}</span>
              </Link>
            )}
            {bets.length > 0 && (
              <button
                type="button"
                onClick={clearBets}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1c2433] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
                aria-label="Clear betslip"
              >
                <Icon name="delete_outline" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-white/10">
          {(["single", "multi", "mybets"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition ${
                tab === t
                  ? "border-b-2 border-[#087cff] bg-[#087cff]/10 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "single"
                ? `Single${bets.length > 0 ? ` ${bets.length}` : ""}`
                : t === "multi"
                  ? "Multi"
                  : "My Bets"}
            </button>
          ))}
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {placedMsg && (
            <div
              className={`mx-3 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${
                placedMsg.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              <Icon name={placedMsg.ok ? "check_circle" : "error"} fill className="h-4 w-4 shrink-0" />
              <span className="flex-1">{placedMsg.text}</span>
              <button type="button" onClick={() => setPlacedMsg(null)}>
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {tab === "mybets" ? (
            <div>
              {!isSignedIn ? (
                <div className="flex flex-col items-center px-4 py-12 text-center">
                  <Icon name="lock" fill className="mb-3 h-7 w-7 text-slate-600" />
                  <p className="text-[13px] font-black text-slate-400">Sign in to see your bets</p>
                  <button
                    type="button"
                    onClick={openLogin}
                    className="mt-4 rounded-xl bg-[#087cff] px-5 py-2 text-[12px] font-black text-white"
                  >
                    Log in
                  </button>
                </div>
              ) : betsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#087cff]/25 border-t-[#087cff]" />
                </div>
              ) : myBets.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-12 text-center">
                  <Icon name="receipt_long" className="mb-3 h-7 w-7 text-slate-600" />
                  <p className="text-[13px] font-black text-slate-400">No bets yet</p>
                  <p className="mt-1 text-[11px] text-slate-600">Pick odds from the sports list</p>
                </div>
              ) : (
                myBets.map((bet) => {
                  const isOpen = expandedBet === bet.id;
                  const shownSelections = isOpen ? bet.selections : bet.selections.slice(0, 1);
                  const hiddenCount = bet.selections.length - shownSelections.length;
                  return (
                    <div
                      key={bet.id}
                      className={`border-b border-white/[0.06] ${isOpen ? "bg-[#141820]" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedBet(isOpen ? null : bet.id)}
                        aria-expanded={isOpen}
                        className="w-full px-3 py-3 text-left transition active:bg-white/[0.02]"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {bet.status === "PENDING" && (
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                              </span>
                            )}
                            <StatusBadge status={bet.status} />
                            <span className="text-[9px] font-bold uppercase text-slate-600">{bet.type}</span>
                            {bet.selections.length > 1 && (
                              <span className="text-[9px] font-black text-slate-500">
                                {bet.selections.length} legs
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-[10px] tabular-nums text-slate-600">
                              {new Date(bet.createdAt).toLocaleString(MONEY_LOCALE, {
                                timeZone: "Africa/Nairobi",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <Icon
                              name="expand_more"
                              className={`h-4 w-4 text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>
                        {shownSelections.map((s, i) => (
                          <div key={i} className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[10px] text-slate-500">{s.matchName}</div>
                              <div className="truncate text-[12px] font-black text-white">
                                {s.label}
                                <span className="ml-1 text-[10px] font-bold text-slate-500">{s.market}</span>
                              </div>
                              {kickoffEAT(s.kickoff) && (
                                <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-600">
                                  <Icon name="schedule" className="h-2.5 w-2.5" />
                                  {kickoffEAT(s.kickoff)}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="rounded-lg bg-[#1c2433] px-1.5 py-0.5 text-[11px] font-black tabular-nums text-white">
                                {s.odds.toFixed(2)}
                              </span>
                              {s.result !== "PENDING" && (
                                <span className={`text-[9px] font-black uppercase ${statusColor(s.result)}`}>
                                  {s.result}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {hiddenCount > 0 && (
                          <div className="text-[10px] font-bold text-[#75b8ff]">
                            +{hiddenCount} more · tap to view
                          </div>
                        )}
                      </button>
                      <div className="flex items-center justify-between border-t border-white/[0.04] px-3 py-2 text-[11px]">
                        <span className="text-slate-500">
                          Stake <span className="font-black tabular-nums text-white">{format(bet.stake)}</span>
                        </span>
                        {bet.status === "WON" && bet.winAmount ? (
                          <span className="font-black tabular-nums text-emerald-400">+{format(bet.winAmount)}</span>
                        ) : bet.status === "LOST" ? (
                          <span className="font-black tabular-nums text-red-400">-{format(bet.stake)}</span>
                        ) : (
                          <span className="text-slate-500">
                            To win{" "}
                            <span className="font-black tabular-nums text-white">{format(bet.potentialWin)}</span>
                          </span>
                        )}
                      </div>
                      {isOpen && (
                        <div className="space-y-1.5 border-t border-white/[0.04] bg-[#0a0b0e] px-3 py-2.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Total odds</span>
                            <span className="font-black tabular-nums text-white">{bet.totalOdds.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Bet ID</span>
                            <span className="font-mono text-[10px] text-slate-400">
                              #{bet.id.slice(-8).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {myBets.length > 0 && (
                <div className="border-t border-white/[0.06] px-3 py-3">
                  <Link
                    href="/my-bets"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#087cff] py-2.5 text-[12px] font-black text-white transition hover:bg-[#0570e8] active:scale-[0.99]"
                  >
                    View all bets
                    <Icon name="arrow_forward" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : bets.length === 0 ? (
            <div className="flex flex-col">
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1c2433] text-[#087cff]">
                  <Icon name="receipt_long" className="h-6 w-6" />
                </span>
                <p className="text-[14px] font-black text-white">Your betslip is empty</p>
                <p className="mt-1.5 max-w-[220px] text-[12px] font-medium leading-relaxed text-slate-500">
                  Tap odds on any match to add selections here.
                </p>
                <Link
                  href="/sports"
                  className="mt-5 rounded-xl bg-[#087cff] px-5 py-2.5 text-[12px] font-black text-white transition hover:bg-[#0570e8] active:scale-[0.98]"
                >
                  Browse sports
                </Link>
              </div>
              <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-white/10 bg-[#141820]">
                <button
                  type="button"
                  onClick={() => setShowWheel((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2.5"
                >
                  <span className="text-[12px] font-black text-white">Lucky Spin</span>
                  <Icon name={showWheel ? "expand_less" : "expand_more"} className="h-4 w-4 text-slate-400" />
                </button>
                {showWheel && (
                  <WheelOfFortune
                    balance={balance}
                    isSignedIn={isSignedIn}
                    openLogin={openLogin}
                    refreshBalance={refreshBalance}
                  />
                )}
              </div>
            </div>
          ) : tab === "single" ? (
            <div>
              {bets.map((bet) => {
                const stake = parseFloat(amounts[bet.id] || "0");
                const grossPayout = stake > 0 ? stake * parseFloat(bet.value) : 0;
                const payout = stake > 0 ? retainedPayout(stake, grossPayout).toFixed(2) : null;
                return (
                  <div key={bet.id} className="border-b border-white/[0.06] px-3 py-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] text-slate-500">{bet.matchName}</div>
                        <div className="truncate text-[13px] font-black text-white">
                          {bet.label}
                          <span className="ml-1.5 text-[10px] font-bold text-slate-500">{bet.market}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-lg bg-[#087cff] px-2 py-1 text-[13px] font-black tabular-nums text-white">
                          {bet.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBet(bet.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1c2433] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
                          aria-label="Remove selection"
                        >
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-[#1c2433] px-3 py-2 ring-1 ring-white/[0.06] focus-within:ring-[#087cff]/50">
                      <span className="shrink-0 text-[11px] font-black text-slate-500">{dispCur.symbol}</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={amounts[bet.id] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [bet.id]: e.target.value }))}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-black tabular-nums text-white outline-none placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        className="shrink-0 text-[11px] font-black text-[#087cff] transition hover:text-[#4fa8ff]"
                        onClick={() =>
                          setAmounts((a) => ({ ...a, [bet.id]: String(Math.floor(convert(balance))) }))
                        }
                      >
                        Max
                      </button>
                    </div>
                    <div className="mt-1.5 flex gap-1.5">
                      {[50, 100, 200, 500].map((q) => {
                        const qd = Math.round(convert(q));
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() =>
                              setAmounts((a) => ({
                                ...a,
                                [bet.id]: String(parseFloat(a[bet.id] || "0") + qd),
                              }))
                            }
                            className="flex-1 rounded-lg bg-[#141820] py-1.5 text-[10px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-[#087cff]/20 hover:text-[#75b8ff]"
                          >
                            +{qd.toLocaleString(dispCur.locale)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Possible win</span>
                      <span className={`font-black tabular-nums ${payout ? "text-emerald-400" : "text-slate-600"}`}>
                        {formatInCurrency(payout ? Number(payout) : 0, dispCur.code)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {bets.map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] text-slate-500">{bet.matchName}</div>
                    <div className="truncate text-[12px] font-black text-white">{bet.label}</div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1.5">
                    <span className="rounded-lg bg-[#1c2433] px-1.5 py-0.5 text-[12px] font-black tabular-nums text-white">
                      {bet.value}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBet(bet.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141820] text-slate-500 hover:text-red-400"
                      aria-label="Remove selection"
                    >
                      <Icon name="close" className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="px-3 py-3">
                <div className="mb-2.5 flex items-center justify-between text-[12px]">
                  <span className="font-bold text-slate-400">Total odds</span>
                  <span className="font-black tabular-nums text-white">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#1c2433] px-3 py-2.5 ring-1 ring-white/[0.06] focus-within:ring-[#087cff]/50">
                  <span className="shrink-0 text-[11px] font-black text-slate-500">{dispCur.symbol}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Bet amount"
                    value={amounts["__multi__"] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, __multi__: e.target.value }))}
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-black tabular-nums text-white outline-none placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-black text-[#087cff]"
                    onClick={() =>
                      setAmounts((a) => ({ ...a, __multi__: String(Math.floor(convert(balance))) }))
                    }
                  >
                    Max
                  </button>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {[50, 100, 200, 500].map((q) => {
                    const qd = Math.round(convert(q));
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() =>
                          setAmounts((a) => ({
                            ...a,
                            __multi__: String(parseFloat(a["__multi__"] || "0") + qd),
                          }))
                        }
                        className="flex-1 rounded-lg bg-[#141820] py-1.5 text-[10px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-[#087cff]/20 hover:text-[#75b8ff]"
                      >
                        +{qd.toLocaleString(dispCur.locale)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Possible win</span>
                  <span
                    className={`font-black tabular-nums ${multiPayout ? "text-emerald-400" : "text-slate-600"}`}
                  >
                    {formatInCurrency(multiPayout ? Number(multiPayout) : 0, dispCur.code)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {bets.length > 0 && tab !== "mybets" && (
            <div className="mx-3 mb-3 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#141820]">
              <button
                type="button"
                onClick={() => setShowWheel((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5"
              >
                <span className="text-[12px] font-black text-white">Lucky Spin</span>
                <Icon name={showWheel ? "expand_less" : "expand_more"} className="h-4 w-4 text-slate-400" />
              </button>
              {showWheel && (
                <WheelOfFortune
                  balance={balance}
                  isSignedIn={isSignedIn}
                  openLogin={openLogin}
                  refreshBalance={refreshBalance}
                />
              )}
            </div>
          )}
        </div>

        {bets.length > 0 && tab !== "mybets" && (
          <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/10 bg-[#141820] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {notEnoughFunds ? (
              <div className="mb-2 flex flex-col items-center gap-2 rounded-xl bg-[#0d0e11] px-3 py-4 text-center ring-1 ring-white/10">
                <Icon name="warning" fill className="h-5 w-5 text-amber-400" />
                <p className="text-[13px] font-black text-white">Not enough funds</p>
                <p className="text-[11px] text-slate-500">Top up to place this bet</p>
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
                    <button type="button" onClick={openLogin} className="font-bold text-[#087cff] hover:underline">
                      Log in
                    </button>{" "}
                    to place bets
                  </p>
                )}
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <span className="text-[11px] text-slate-500">Possible win</span>
                  <span className="text-[13px] font-black tabular-nums text-emerald-400">
                    {formatInCurrency(
                      tab === "multi"
                        ? multiPayout
                          ? Number(multiPayout)
                          : 0
                        : bets.reduce((s, b) => {
                            const stake = parseFloat(amounts[b.id] || "0");
                            return s + (stake > 0 ? retainedPayout(stake, stake * parseFloat(b.value)) : 0);
                          }, 0),
                      dispCur.code,
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={placeBets}
                  disabled={placing}
                  className="w-full rounded-xl bg-[#06c96e] py-3.5 text-sm font-black text-white transition hover:bg-[#05b85f] active:scale-[.99] disabled:opacity-60"
                >
                  {placing ? (
                    <LoadingDots label="Placing" />
                  ) : isSignedIn ? (
                    `Place ${bets.length === 1 ? "Bet" : `${bets.length} Bets`}`
                  ) : (
                    "Log in to Bet"
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
