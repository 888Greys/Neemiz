"use client";

import { useState } from "react";

export function SportsBetSlip() {
  const [betAmount, setBetAmount] = useState("");
  const [multiplier, setMultiplier] = useState<"x1.5" | "x2" | "x3">("x2");
  const [spinning, setSpinning] = useState(false);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setTimeout(() => setSpinning(false), 1500);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto no-scrollbar bg-[#0d0e11] p-3 gap-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[18px] font-black text-white">Betslip</span>
        <div className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5">
          <CurrencyIcon />
          <span className="text-[12px] font-black text-slate-400">KSh 0.00</span>
        </div>
      </div>

      {/* ── Bet code ── */}
      <div className="flex gap-2">
        <input
          placeholder="Bet code"
          className="min-w-0 flex-1 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-[#087cff]/50"
        />
        <button
          type="button"
          className="shrink-0 rounded-2xl bg-[#06c96e] px-5 py-3 text-sm font-black text-white transition hover:bg-[#05b85f] active:scale-[0.97]"
        >
          View bet
        </button>
      </div>

      {/* ── Wheel of fortune card ── */}
      <div className="rounded-3xl bg-[#16171d] ring-1 ring-white/[0.07] p-4">
        <div className="mb-0.5 text-[15px] font-black text-white">Wheel of fortune</div>
        <div className="mb-4 text-[13px] text-slate-400">Spin and try your luck!</div>

        {/* Wheel */}
        <div className="flex justify-center py-2">
          <WheelGraphic spinning={spinning} />
        </div>

        {/* Bet amount */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.07] px-4 py-3">
          <input
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="Bet amount"
            type="number"
            min="0"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            className="shrink-0 text-[13px] font-black text-[#087cff] transition hover:text-[#4fa8ff]"
          >
            Bet all
          </button>
        </div>

        {/* Multiplier label */}
        <div className="mt-3 text-[12px] font-bold text-slate-500">Bet amount per spin</div>

        {/* Multipliers + Spin in one row */}
        <div className="mt-2 flex gap-2">
          {(["x1.5", "x2", "x3"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMultiplier(m)}
              className={`flex-1 rounded-2xl py-3 text-[13px] font-black transition active:scale-[0.97] ${
                multiplier === m
                  ? "bg-white/[0.15] text-white ring-1 ring-white/20"
                  : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.10] hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning}
            className="flex-1 rounded-2xl bg-[#087cff] py-3 text-[13px] font-black text-white shadow-[0_4px_14px_rgba(8,124,255,.35)] transition hover:bg-[#0668d6] active:scale-[0.97] disabled:opacity-70"
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Spinning
              </span>
            ) : "Spin"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrencyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#64748b" strokeWidth="1.5" />
      <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="900" fill="#64748b">
        KSh
      </text>
    </svg>
  );
}

function WheelGraphic({ spinning }: { spinning: boolean }) {
  const cx = 100;
  const cy = 100;
  const r = 74;
  const sw = 14;

  return (
    <svg
      viewBox="0 0 200 200"
      className={`h-44 w-44 transition-all duration-300 ${spinning ? "animate-spin" : ""}`}
      style={spinning ? { animationDuration: "0.6s" } : undefined}
      aria-hidden="true"
    >
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2b35" strokeWidth={sw + 4} />

      {/* Red half (left) */}
      <path
        d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`}
        fill="none"
        stroke="#ff4757"
        strokeWidth={sw}
        strokeLinecap="butt"
      />
      {/* Green half (right) */}
      <path
        d={`M ${cx} ${cy + r} A ${r} ${r} 0 0 0 ${cx} ${cy - r}`}
        fill="none"
        stroke="#2ed573"
        strokeWidth={sw}
        strokeLinecap="butt"
      />

      {/* Blue pointer at top */}
      <polygon
        points={`${cx},${cy - r - 12} ${cx - 8},${cy - r + 4} ${cx + 8},${cy - r + 4}`}
        fill="#087cff"
      />

      {/* Center fill */}
      <circle cx={cx} cy={cy} r={r - sw / 2 - 4} fill="#16171d" />

      {/* Center labels */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="12" fill="#64748b" fontWeight="600">
        Win
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="18" fill="#ffffff" fontWeight="900">
        KSh 0.00
      </text>
    </svg>
  );
}
