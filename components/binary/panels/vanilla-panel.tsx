"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import type { DirectionalSide } from "@/lib/directional";

type DirSide = DirectionalSide;

const CARD = "rounded-lg bg-[#181b22] p-3";
const FIELD = "flex items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06]";

// Vanilla options (Call/Put). Unlike the fixed-payout directional contracts, the
// payout is proportional: the stake buys a number of contracts, each paying out
// per in-the-money point at expiry (capped). Settlement is server-authoritative.
export function VanillaPanel({
  currency, sides,
  stake, setStake,
  duration, setDuration,
  strikeOffset, setStrikeOffset,
  latestSpot,
  stakePresets, minStake,
  payoutPerPointFor, maxPayout,
  format, formatSpot,
  onTrade, placing, openPositions,
}: {
  currency: string;
  sides: DirSide[];
  stake: number; setStake: (v: number) => void;
  duration: number; setDuration: (v: number) => void;
  strikeOffset: number; setStrikeOffset: (v: number) => void;
  latestSpot: number;
  stakePresets: number[];
  minStake: number;
  payoutPerPointFor: (side: DirSide) => number;
  maxPayout: number;
  format: (v: number) => string;
  formatSpot: (v: number) => string;
  onTrade: (side: DirSide) => void;
  placing: boolean;
  openPositions: { id: string; side: DirSide; settlesAt: number }[];
}) {
  const offsetStep = Math.max(0.01, Math.round(latestSpot * 0.0003 * 100) / 100);
  const strike = latestSpot + strikeOffset;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {/* Stake */}
        <div className={CARD}>
          <div className="mb-2.5 text-center text-[13px] font-bold text-slate-200">Stake</div>
          <div className="flex gap-1.5">
            <div className={`flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setStake(Math.max(minStake, stake - 1))}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="remove" className="text-[18px]" />
              </button>
              <input type="number" value={stake}
                onChange={(e) => setStake(Math.max(minStake, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setStake(stake + 1)}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="add" className="text-[18px]" />
              </button>
            </div>
            <span className={`${FIELD} px-3 text-[13px] font-black text-slate-200`}>{currency}</span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {stakePresets.map((amount) => (
              <button key={amount} type="button" onClick={() => setStake(amount)}
                className={`rounded-md py-1.5 text-[11px] font-black transition ${
                  stake === amount ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                }`}>{amount}</button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className={CARD}>
          <div className="mb-2.5 flex items-center justify-center gap-1 text-[13px] font-bold text-slate-200">Duration</div>
          <div className={FIELD}>
            <button type="button" onClick={() => setDuration(Math.max(1, duration - 1))}
              className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
              <Icon name="remove" className="text-[18px]" />
            </button>
            <input type="number" value={duration}
              onChange={(e) => setDuration(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="button" onClick={() => setDuration(Math.min(30, duration + 1))}
              className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
              <Icon name="add" className="text-[18px]" />
            </button>
            <span className="px-3 text-[12px] font-black text-slate-500">ticks</span>
          </div>
        </div>

        {/* Strike (offset from spot; 0 = at-the-money) */}
        <div className={CARD}>
          <div className="mb-2.5 flex items-center justify-center gap-1 text-[13px] font-bold text-slate-200">
            Strike offset
          </div>
          <div className={FIELD}>
            <button type="button" onClick={() => setStrikeOffset(Math.round((strikeOffset - offsetStep) * 100) / 100)}
              className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
              <Icon name="remove" className="text-[18px]" />
            </button>
            <input type="number" value={strikeOffset}
              onChange={(e) => setStrikeOffset(Number(e.target.value) || 0)}
              className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="button" onClick={() => setStrikeOffset(Math.round((strikeOffset + offsetStep) * 100) / 100)}
              className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
              <Icon name="add" className="text-[18px]" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="font-bold text-slate-400">Strike</span>
            <span className="font-mono font-black text-amber-300">{formatSpot(strike)}</span>
          </div>
        </div>

        {/* Payout preview — proportional (per point) + capped max */}
        <div className={`${CARD} space-y-2.5 text-[13px]`}>
          {sides.map((side) => (
            <div key={side} className="flex items-center justify-between">
              <span className="font-bold text-slate-400">{side} payout/point</span>
              <span className="font-black text-white">{format(payoutPerPointFor(side))}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
            <span className="font-bold text-slate-400">Max payout</span>
            <span className="font-black text-emerald-300">{format(maxPayout)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Spot</span>
            <span className="font-mono font-black text-sky-300">{formatSpot(latestSpot)}</span>
          </div>
        </div>
      </div>

      {openPositions.length > 0 && <ActivePositions positions={openPositions} />}

      {/* Action buttons */}
      <div className="grid shrink-0 grid-cols-2 gap-2 p-2">
        {sides.map((side) => {
          const isPut = side === "PUT";
          return (
            <button key={side} type="button" onClick={() => onTrade(side)} disabled={placing}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-3 text-center font-black text-white transition active:scale-[0.98] disabled:opacity-50 ${
                isPut ? "bg-[#e2474b] hover:bg-[#ec5a5e]" : "bg-[#16a085] hover:bg-[#1bb198]"
              }`}>
              <span className="flex items-center gap-1 text-[14px]">
                <Icon name={isPut ? "trending_down" : "trending_up"} className="text-[16px]" />
                {placing ? <LoadingDots /> : side}
              </span>
              <span className="font-mono text-[12px] text-white/85">{format(payoutPerPointFor(side))}/pt</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivePositions({ positions }: { positions: { id: string; side: DirSide; settlesAt: number }[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const soonest = positions.reduce((a, b) => (b.settlesAt < a.settlesAt ? b : a));
  const secondsLeft = Math.max(0, Math.ceil((soonest.settlesAt - now) / 1000));

  return (
    <div className="shrink-0 px-2">
      <div className="flex items-center justify-between rounded-lg bg-[#101722] px-3 py-2 ring-1 ring-sky-400/25">
        <span className="flex items-center gap-2 text-[12px] font-black text-sky-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
          </span>
          {positions.length} active {positions.length === 1 ? "trade" : "trades"}
        </span>
        <span className="font-mono text-[12px] font-black text-white">
          {secondsLeft === 0 ? "Settling…" : `${soonest.side} · ${secondsLeft}s`}
        </span>
      </div>
    </div>
  );
}
