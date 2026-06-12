"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useBetslip } from "@/lib/betslip-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";

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
    WON:       "bg-emerald-500/15 text-emerald-400",
    LOST:      "bg-red-500/15 text-red-400",
    VOID:      "bg-white/[0.07] text-slate-400",
    PENDING:   "bg-amber-500/15 text-amber-400",
    CASHED_OUT:"bg-purple-500/15 text-purple-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${colors[status] ?? colors.PENDING}`}>
      {status}
    </span>
  );
}

// ─── Wheel of Fortune ─────────────────────────────────────────────────────────

const WHEEL_SEGS = [
  { label: "×1.5", mult: 1.5, fill: "#1a3a6c", text: "#75b8ff" },
  { label: "×2",   mult: 2,   fill: "#087cff", text: "#fff"    },
  { label: "×0.5", mult: 0.5, fill: "#111420", text: "#8b94b8" },
  { label: "×3",   mult: 3,   fill: "#0055b3", text: "#fff"    },
  { label: "×1.5", mult: 1.5, fill: "#1a3a6c", text: "#75b8ff" },
  { label: "×2",   mult: 2,   fill: "#087cff", text: "#fff"    },
  { label: "×5",   mult: 5,   fill: "#b45309", text: "#fde68a" },
  { label: "×3",   mult: 3,   fill: "#0055b3", text: "#fff"    },
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
  return date.toLocaleString("en-KE", {
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

  const amt            = parseFloat(amount || "0");
  const notEnoughFunds = isSignedIn && amt > 0 && amt > balance;

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
        body: JSON.stringify({ amount: amt }),
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
                    fontSize="10.5" fontWeight="900"
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
            {result.netChange < 0 ? "Partial return" : result.multiplier >= 5 ? "Big win!" : "You won!"}
          </p>
          <p className={`text-xl font-black tabular-nums ${
            result.netChange < 0 ? "text-red-400" : result.multiplier >= 5 ? "text-amber-400" : "text-emerald-400"
          }`}>
            {result.netChange < 0
              ? `KSh ${result.winAmount.toFixed(2)} returned`
              : `+KSh ${result.netChange.toFixed(2)} profit`}
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
            KSh {result ? result.winAmount.toFixed(2) : "—"}
          </span>
        </div>
      </div>

      {/* Bet amount input */}
      <div className="w-full mb-2">
        <div className={`flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 transition-shadow ${
          notEnoughFunds ? "ring-red-500/40" : "ring-white/[0.07] focus-within:ring-[#087cff]/40"
        }`}>
          <span className="shrink-0 text-[11px] font-black text-slate-500">KSh</span>
          <input
            type="number" min={MIN_PLAY_AMOUNT} placeholder="Bet amount"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-black text-white outline-none placeholder:text-slate-600"
          />
        </div>
        {notEnoughFunds && (
          <p className="mt-1 text-[10px] text-red-400 font-bold">
            Insufficient balance — KSh {balance.toFixed(2)} available
          </p>
        )}
      </div>

      {/* Range hint */}
      <p className="mb-2.5 text-[10px] text-slate-600 self-start">
        from KSh {MIN_PLAY_AMOUNT} to KSh {balance > 0 ? balance.toLocaleString("en-KE", { maximumFractionDigits: 2 }) : "—"}
      </p>

      {/* Multiplier quick-pick */}
      <div className="mb-3 flex w-full gap-2">
        {([1.5, 2, 3] as const).map((m) => (
          <button key={m} type="button"
            onClick={() => setAmount((v) => (parseFloat(v || "0") * m).toFixed(2))}
            className="flex-1 rounded-xl bg-white/[0.05] py-1.5 text-[11px] font-black text-slate-400 ring-1 ring-white/[0.06] hover:bg-[#087cff]/15 hover:text-[#75b8ff] transition">
            ×{m}
          </button>
        ))}
      </div>

      {/* CTA button — changes based on state */}
      {!isSignedIn ? (
        <button type="button" onClick={openLogin}
          className="w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-[0_4px_20px_rgba(8,124,255,.35)] hover:bg-[#0570e8] active:scale-[.98] transition-all">
          Log in to Spin
        </button>
      ) : notEnoughFunds ? (
        <Link href="/wallet"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#06c96e] py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(6,201,110,.3)] hover:bg-[#05b85f] active:scale-[.98] transition-all">
          <Icon name="account_balance_wallet" className="w-4 h-4" />
          Deposit to Spin
        </Link>
      ) : (
        <button type="button" onClick={spin}
          disabled={spinning || loading || !amt || amt < MIN_PLAY_AMOUNT}
          className="w-full rounded-2xl bg-[#087cff] py-3.5 text-sm font-black text-white shadow-[0_4px_20px_rgba(8,124,255,.35)] hover:bg-[#0570e8] active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {(spinning || loading) ? (
            <LoadingDots label={loading ? "Placing" : "Spinning"} />
          ) : "Spin"}
        </button>
      )}
    </div>
  );
}

// ─── Share Bet Modal ───────────────────────────────────────────────────────────

function ShareBetModal({ onClose }: { onClose: () => void }) {
  const [code]    = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const link = typeof window !== "undefined"
    ? `${window.location.origin}/sports?bet=${code}`
    : `/sports?bet=${code}`;

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied("code");
    setTimeout(() => setCopied(null), 2000);
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Nezeem Bet", url: link });
        return;
      } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(link);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-[#13161f] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-[15px] font-black text-white">Share bet</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Copy the code or share a link</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.12] transition">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Code field */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.08] mb-4">
            <span className="flex-1 font-mono text-[16px] font-black text-white tracking-widest">{code}</span>
            <button type="button" onClick={copyCode}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                copied === "code"
                  ? "bg-emerald-500 text-white"
                  : "bg-[#087cff] text-white hover:bg-[#0570e8]"
              }`}>
              <Icon name={copied === "code" ? "check" : "photo_camera"} className="w-4 h-4" />
            </button>
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-[11px] font-black text-slate-600">OR</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Share link button */}
          <button
            type="button"
            onClick={shareLink}
            className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-black transition ${
              copied === "link"
                ? "bg-emerald-500 text-white"
                : "bg-[#087cff] text-white hover:bg-[#0570e8]"
            }`}
          >
            <Icon name={copied === "link" ? "check" : "open_in_new"} className="w-4 h-4" />
            {copied === "link" ? "Link copied!" : "Share a link"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Betslip ─────────────────────────────────────────────────────────────

export function SportsBetSlip() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin }  = useAuthModal();
  const { bets, removeBet, clearBets } = useBetslip();
  const { balance, currency, refresh: refreshBalance } = useWalletBalance();

  const [amounts,    setAmounts]    = useState<Record<string, string>>({});
  const [tab,        setTab]        = useState<"single" | "multi" | "mybets">("single");
  const [placing,    setPlacing]    = useState(false);
  const [placedMsg,  setPlacedMsg]  = useState<{ ok: boolean; text: string } | null>(null);
  const [myBets,     setMyBets]     = useState<MyBet[]>([]);
  const [betsLoading,setBetsLoading]= useState(false);
  const [expandedBet,setExpandedBet]= useState<string | null>(null);
  const [showShare,  setShowShare]  = useState(false);

  const totalOdds  = bets.reduce((acc, b) => acc * parseFloat(b.value || "1"), 1);
  const multiStake = parseFloat(amounts["__multi__"] || "0");
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
        if (!multiStake || multiStake < MIN_PLAY_AMOUNT) {
          setPlacedMsg({ ok: false, text: `Minimum stake is KSh ${MIN_PLAY_AMOUNT}` });
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
            const stake = parseFloat(amounts[bet.id] || "0");
            if (!stake || stake < MIN_PLAY_AMOUNT) return { ok: false, error: `Minimum stake is KSh ${MIN_PLAY_AMOUNT}` };
            const res = await fetch("/api/bets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "SINGLE", stake,
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

  const fmtBalance = `${currency === "KES" ? "KSh" : currency} ${balance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const stakeTotal = tab === "multi"
    ? multiStake
    : bets.reduce((sum, b) => sum + parseFloat(amounts[b.id] || "0"), 0);
  const notEnoughFunds = isSignedIn && stakeTotal > 0 && stakeTotal > balance;

  return (
    <>
      {showShare && <ShareBetModal onClose={() => setShowShare(false)} />}

      <div className="flex h-full min-h-0 w-full flex-col bg-[#0d0e11]">
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
                <Icon name="account_balance_wallet" className="w-3 h-3 text-slate-400" />
                <span className="text-[12px] font-black text-slate-300">{fmtBalance}</span>
              </Link>
            )}
            {bets.length > 0 && (
              <button type="button" onClick={clearBets}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
                aria-label="Clear betslip">
                <Icon name="delete_outline" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex shrink-0 border-b border-white/[0.07]">
          {(["single", "multi", "mybets"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-black transition ${
                tab === t
                  ? "border-b-2 border-[#087cff] text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              {t === "single" ? `Single${bets.length > 0 ? ` (${bets.length})` : ""}` : t === "multi" ? "Multi" : "My Bets"}
            </button>
          ))}
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
          {/* Flash message */}
          {placedMsg && (
            <div className={`mx-3 mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold ${
              placedMsg.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}>
              <Icon name={placedMsg.ok ? "check_circle" : "error"} fill className="w-4 h-4 shrink-0" />
              <span className="flex-1">{placedMsg.text}</span>
              <button type="button" onClick={() => setPlacedMsg(null)}>
                <Icon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {tab === "mybets" ? (
            /* ── My Bets ── */
            <div className="divide-y divide-white/[0.05]">
              {!isSignedIn ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Icon name="lock" fill className="w-8 h-8 text-slate-600 mb-3" />
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
                  <Icon name="receipt_long" className="w-8 h-8 text-slate-600 mb-3" />
                  <p className="text-sm font-black text-slate-500">No bets yet</p>
                </div>
              ) : (
                myBets.map((bet) => {
                  const isOpen = expandedBet === bet.id;
                  const shownSelections = isOpen ? bet.selections : bet.selections.slice(0, 1);
                  const hiddenCount = bet.selections.length - shownSelections.length;
                  return (
                  <div key={bet.id} className={`px-4 py-3.5 transition-colors ${isOpen ? "bg-white/[0.03]" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setExpandedBet(isOpen ? null : bet.id)}
                      aria-expanded={isOpen}
                      className="w-full text-left transition active:scale-[0.99]"
                    >
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {bet.status === "PENDING" && (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                            </span>
                          )}
                          <StatusBadge status={bet.status} />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{bet.type}</span>
                          {bet.selections.length > 1 && (
                            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-black text-slate-400">
                              {bet.selections.length} LEGS
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-600">
                            {new Date(bet.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <Icon name="expand_more" className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                      {shownSelections.map((s, i) => (
                        <div key={i} className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[10px] text-slate-500">{s.matchName}</div>
                            <div className="truncate text-[12px] font-black text-white">
                              {s.label}
                              <span className="ml-1 text-[10px] font-bold text-slate-500">· {s.market}</span>
                            </div>
                            {kickoffEAT(s.kickoff) && (
                              <div className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-slate-600">
                                <Icon name="schedule" className="h-2.5 w-2.5" />
                                {kickoffEAT(s.kickoff)}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            <span className="rounded-md bg-[#087cff]/15 px-1.5 py-0.5 text-[11px] font-black text-[#75b8ff]">
                              {s.odds.toFixed(2)}
                            </span>
                            {s.result !== "PENDING" && (
                              <span className={`text-[9px] font-black uppercase ${statusColor(s.result)}`}>{s.result}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <div className="mb-2 text-[10px] font-black text-[#75b8ff]">
                          + {hiddenCount} more selection{hiddenCount > 1 ? "s" : ""} — tap to view
                        </div>
                      )}
                    </button>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-[11px]">
                      <span className="text-slate-500">Stake <span className="font-black text-white">KSh {bet.stake.toFixed(2)}</span></span>
                      {bet.status === "WON" && bet.winAmount ? (
                        <span className="font-black text-emerald-400">+KSh {bet.winAmount.toFixed(2)}</span>
                      ) : bet.status === "LOST" ? (
                        <span className="text-red-400 font-black">-KSh {bet.stake.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-500">To win <span className="font-black text-amber-400">KSh {bet.potentialWin.toFixed(2)}</span></span>
                      )}
                    </div>
                    {isOpen && (
                      <div className="mt-2 space-y-1.5 rounded-xl bg-white/[0.02] px-3 py-2.5 text-[11px] ring-1 ring-white/[0.05]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Total odds</span>
                          <span className="font-black text-white">{bet.totalOdds.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Potential win</span>
                          <span className="font-black text-amber-400">KSh {bet.potentialWin.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Placed</span>
                          <span className="font-bold text-slate-300">
                            {new Date(bet.createdAt).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Bet ID</span>
                          <span className="font-mono text-[10px] text-slate-400">#{bet.id.slice(-8).toUpperCase()}</span>
                        </div>
                        <Link href="/my-bets"
                          className="mt-1 flex items-center justify-center gap-1 rounded-lg bg-[#087cff]/15 py-1.5 text-[11px] font-black text-[#75b8ff] transition hover:bg-[#087cff]/25">
                          View full details
                          <Icon name="arrow_forward" className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
              <Link href="/my-bets"
                className="mx-3 my-3 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.06] transition hover:bg-white/[0.08]">
                <span className="text-[11px] font-black text-slate-400">Open full My Bets page</span>
                <Icon name="arrow_forward" className="w-3.5 h-3.5 text-[#087cff]" />
              </Link>
            </div>

          ) : bets.length === 0 ? (
            /* ── Empty state → Wheel ── */
            <WheelOfFortune
              balance={balance}
              isSignedIn={isSignedIn}
              openLogin={openLogin}
              refreshBalance={refreshBalance}
            />

          ) : tab === "single" ? (
            /* ── Single bets ── */
            <div className="divide-y divide-white/[0.05]">
              {bets.map((bet) => {
                const stake  = parseFloat(amounts[bet.id] || "0");
                const grossPayout = stake > 0 ? stake * parseFloat(bet.value) : 0;
                const payout = stake > 0 ? retainedPayout(stake, grossPayout).toFixed(2) : null;
                return (
                  <div key={bet.id} className="px-4 py-3">
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] text-slate-500">{bet.matchName}</div>
                        <div className="truncate text-[13px] font-black text-white">{bet.market} · {bet.label}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-lg bg-[#087cff] px-2.5 py-0.5 text-[13px] font-black text-white tabular-nums">
                          {bet.value}
                        </span>
                        <button type="button" onClick={() => removeBet(bet.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400">
                          <Icon name="close" className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/[0.06] focus-within:ring-[#087cff]/40">
                      <span className="shrink-0 text-[11px] font-black text-slate-500">KSh</span>
                      <input
                        type="number" min="0" placeholder="0"
                        value={amounts[bet.id] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [bet.id]: e.target.value }))}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-black text-white outline-none placeholder:text-slate-600"
                      />
                      <button type="button"
                        className="shrink-0 text-[11px] font-black text-[#087cff] transition hover:text-[#4fa8ff]"
                        onClick={() => setAmounts((a) => ({ ...a, [bet.id]: String(Math.floor(balance)) }))}>
                        Max
                      </button>
                    </div>
                    <div className="mt-1.5 flex gap-1.5">
                      {[50, 100, 200, 500].map((q) => (
                        <button key={q} type="button"
                          onClick={() => setAmounts((a) => ({ ...a, [bet.id]: String(parseFloat(a[bet.id] || "0") + q) }))}
                          className="flex-1 rounded-lg bg-white/[0.05] py-1 text-[10px] font-black text-slate-400 transition hover:bg-[#087cff]/20 hover:text-[#75b8ff]">
                          +{q}
                        </button>
                      ))}
                    </div>
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
                      <Icon name="close" className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3">
                <div className="mb-2.5 flex items-center justify-between text-[12px]">
                  <span className="text-slate-400 font-bold">Total odds</span>
                  <span className="font-black text-white tabular-nums">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/[0.06]">
                  <input
                    type="number" min="0" placeholder="Bet amount"
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

        {/* ── Footer ── */}
        {bets.length > 0 && tab !== "mybets" && (
          <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/[0.07] bg-[#0d0e11] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {notEnoughFunds ? (
              <div className="mb-3 flex flex-col items-center gap-2 rounded-2xl bg-[#16171d] px-4 py-4 text-center ring-1 ring-white/[0.07]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                  <Icon name="warning" fill className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-[13px] font-black text-white">Not enough funds</p>
                <p className="text-[11px] text-slate-500">Top up your account to continue</p>
                <Link href="/wallet"
                  className="mt-1 w-full rounded-xl bg-[#05b957] py-2.5 text-center text-[13px] font-black text-white transition hover:bg-[#07cc63]">
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
                {/* Possible win row with share button */}
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="text-[11px] text-slate-500">Possible win</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-black text-emerald-400 tabular-nums">
                      KSh {tab === "multi"
                        ? (multiPayout ?? "0.00")
                        : bets.reduce((s, b) => {
                            const stake = parseFloat(amounts[b.id] || "0");
                            return s + (stake > 0 ? retainedPayout(stake, stake * parseFloat(b.value)) : 0);
                          }, 0).toFixed(2)}
                    </span>
                    {/* Share button */}
                    <button
                      type="button"
                      onClick={() => setShowShare(true)}
                      title="Share bet"
                      className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.07] text-slate-400 hover:bg-white/[0.12] hover:text-white transition"
                    >
                      <Icon name="open_in_new" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={placeBets}
                  disabled={placing}
                  className="w-full rounded-2xl bg-[#06c96e] py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(6,201,110,.3)] transition hover:bg-[#05b85f] active:scale-[.98] disabled:opacity-60"
                >
                  {placing ? (
                    <LoadingDots label="Placing" />
                  ) : isSignedIn
                    ? `Place ${bets.length === 1 ? "Bet" : `${bets.length} Bets`}`
                    : "Log in to Bet"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
