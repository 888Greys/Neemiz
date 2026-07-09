"use client";

import { useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { useCurrency } from "@/lib/currency-context";

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
const MIN_PLAY_AMOUNT = 10;

function polarXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(i: number) {
  const s = polarXY(CX, CY, R, i * DEG);
  const e = polarXY(CX, CY, R, (i + 1) * DEG);
  return `M${CX},${CY} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${R},${R},0,0,1,${e.x.toFixed(2)},${e.y.toFixed(2)}Z`;
}

type WheelResult = {
  segmentIndex: number;
  label: string;
  multiplier: number;
  stake: number;
  winAmount: number;
  netChange: number;
};

export function LuckySpinWheel() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const { balance, refresh: refreshBalance } = useWalletBalance();
  const { convert, toKes, format, currency } = useCurrency();

  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("50");

  const amt = parseFloat(amount || "0");
  const amtKes = Math.round(toKes(amt));
  const notEnoughFunds = isSignedIn && amt > 0 && amtKes > balance;

  async function spin() {
    if (!isSignedIn) {
      openLogin();
      return;
    }
    if (spinning || animating || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);

    let data: WheelResult;
    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amtKes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Spin failed");
        setLoading(false);
        return;
      }
      data = json as WheelResult;
    } catch {
      setError("Network error — please try again");
      setLoading(false);
      return;
    }
    setLoading(false);

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
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 pb-8 pt-4">
      <div className="relative mb-5" style={{ width: 240, height: 240 }}>
        <div className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]">
          <svg width="18" height="20" viewBox="0 0 16 18">
            <path d="M8 18 L0 0 L16 0 Z" fill="white" />
          </svg>
        </div>

        <svg
          width="240"
          height="240"
          viewBox="0 0 200 200"
          style={{
            transform: `rotate(${rotation}deg)`,
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
                <path d={slicePath(i)} fill={seg.fill} stroke="#151518" strokeWidth="1.5" />
                <g transform={`rotate(${mid},${CX},${CY})`}>
                  <text
                    x={CX}
                    y={CY - TEXT_R}
                    fill={seg.text}
                    fontSize="9.5"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ userSelect: "none", fontFamily: "inherit" }}
                  >
                    {seg.label}
                  </text>
                </g>
                {(() => {
                  const p = polarXY(CX, CY, R - 4, i * DEG);
                  return <circle cx={p.x} cy={p.y} r="2" fill="#151518" opacity="0.7" />;
                })()}
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="16" fill="#151518" stroke="#1e2a3a" strokeWidth="2" />
          <circle cx={CX} cy={CY} r="7" fill="#087cff" />
          <circle cx={CX} cy={CY} r="3" fill="#fff" opacity="0.6" />
        </svg>
      </div>

      {isSignedIn && (
        <div className="mb-4 flex w-full items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.06]">
          <span className="text-[11px] font-bold text-slate-500">Balance</span>
          <Link href="/wallet" className="text-[13px] font-black tabular-nums text-white hover:text-[#75b8ff]">
            {format(balance)}
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-3 w-full rounded-xl bg-red-500/10 px-4 py-2.5 text-center ring-1 ring-red-500/20">
          <p className="text-[12px] font-bold text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div
          className={`mb-3 w-full rounded-xl px-4 py-3 text-center ring-1 transition-all ${
            result.netChange < 0
              ? "bg-red-500/10 ring-red-500/20"
              : result.multiplier >= 5
                ? "bg-amber-500/10 ring-amber-500/20"
                : "bg-emerald-500/10 ring-emerald-500/20"
          }`}
        >
          <p
            className={`mb-0.5 text-[11px] font-bold ${
              result.netChange < 0
                ? "text-red-400"
                : result.multiplier >= 5
                  ? "text-amber-400"
                  : "text-emerald-400"
            }`}
          >
            {result.multiplier === 0
              ? "No win"
              : result.netChange < 0
                ? "Partial return"
                : result.multiplier >= 5
                  ? "Big win!"
                  : "You won!"}
          </p>
          <p
            className={`text-xl font-black tabular-nums ${
              result.netChange < 0
                ? "text-red-400"
                : result.multiplier >= 5
                  ? "text-amber-400"
                  : "text-emerald-400"
            }`}
          >
            {result.multiplier === 0
              ? `${format(result.stake)} lost`
              : result.netChange < 0
                ? `${format(result.winAmount)} returned`
                : `+${format(result.netChange)} profit`}
          </p>
        </div>
      )}

      <div className="mb-3 w-full rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Win</span>
          <span
            className={`font-black tabular-nums ${
              result ? (result.netChange < 0 ? "text-red-400" : "text-emerald-400") : "text-slate-300"
            }`}
          >
            {result ? format(result.winAmount) : "—"}
          </span>
        </div>
      </div>

      <div className="mb-2 w-full">
        <div
          className={`flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 transition ${
            notEnoughFunds ? "ring-red-500/40" : "ring-white/[0.06] focus-within:ring-[#087cff]/50"
          }`}
        >
          <span className="shrink-0 text-[11px] font-black text-slate-500">{currency.symbol}</span>
          <input
            type="number"
            min={convert(MIN_PLAY_AMOUNT)}
            placeholder="Spin amount"
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

      <div className="mb-4 flex w-full gap-1.5">
        {([1.5, 2, 3] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setAmount((v) => (parseFloat(v || "0") * m).toFixed(2))}
            className="flex-1 rounded-lg bg-white/[0.04] py-1.5 text-[11px] font-black text-slate-400 ring-1 ring-white/[0.06] transition hover:bg-[#087cff]/15 hover:text-[#75b8ff]"
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
