"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";

type ContractFamily = "evenOdd" | "matchDiffer" | "overUnder";
type ContractSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";

const CARD = "rounded-lg bg-[#181b22] p-2 sm:p-3";
const FIELD = "flex items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06]";
const DIGITS = Array.from({ length: 10 }, (_, i) => i);

// The "down"/bearish side of each family is rendered red, matching the picker.
const RED_SIDES = new Set<ContractSide>(["Odd", "Differs", "Under"]);

function actionLabel(side: ContractSide) {
  if (side === "Matches") return "MATCHES";
  if (side === "Differs") return "DIFFERS";
  return side.toUpperCase();
}

// Deriv-style digit-contract panel — Even/Odd, Matches/Differs, Over/Under.
// Settlement is server-authoritative (real users) or client-side off the local
// feed (demo); this panel only collects stake / duration / target and fires the
// two side actions. Wired to placeTrade() in binary-client.
export function DigitPanel({
  currency,
  family,
  sides,
  stake, setStake,
  duration, setDuration,
  targetDigit, setTargetDigit,
  lastDigit,
  stakePresets,
  minStake,
  payoutFor,
  format,
  onTrade,
  placing,
  openPositions,
}: {
  currency: string;
  family: ContractFamily;
  sides: ContractSide[];
  stake: number; setStake: (v: number) => void;
  duration: number; setDuration: (v: number) => void;
  targetDigit: number; setTargetDigit: (v: number) => void;
  lastDigit: number;
  stakePresets: number[];
  minStake: number;
  payoutFor: (side: ContractSide) => number;
  format: (v: number) => string;
  onTrade: (side: ContractSide) => void;
  placing: boolean;
  openPositions: { id: string; side: ContractSide; settlesAt: number }[];
}) {
  // Even/Odd is decided purely by the exit digit's parity — no barrier digit.
  const needsTarget = family !== "evenOdd";
  const targetVerb = family === "matchDiffer" ? "Target digit" : "Barrier digit";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {/* Stake */}
        <div className={CARD}>
          <div className="mb-2 text-center text-[12px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">Stake</div>
          <div className="flex gap-1.5">
            <div className={`flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setStake(Math.max(minStake, stake - 1))}
                className="grid h-8 w-9 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[17px] sm:text-[18px]" />
              </button>
              <input
                type="number" value={stake}
                onChange={(e) => setStake(Math.max(minStake, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setStake(stake + 1)}
                className="grid h-8 w-9 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="add" className="text-[17px] sm:text-[18px]" />
              </button>
            </div>
            <span className={`${FIELD} px-2.5 text-[12px] font-black text-slate-200 sm:px-3 sm:text-[13px]`}>{currency}</span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {stakePresets.map((amount) => (
              <button key={amount} type="button" onClick={() => setStake(amount)}
                className={`rounded-md py-1 text-[10px] font-black transition sm:py-1.5 sm:text-[11px] ${
                  stake === amount ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                }`}>
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className={CARD}>
          <div className="mb-2 flex items-center justify-center gap-1 text-[12px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">
            Duration
            <Icon name="info" className="text-[14px] text-slate-500" />
          </div>
          <div className={FIELD}>
            <button type="button" onClick={() => setDuration(Math.max(3, duration - 1))}
              className="grid h-8 w-9 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
              <Icon name="remove" className="text-[17px] sm:text-[18px]" />
            </button>
            <input
              type="number" value={duration}
              onChange={(e) => setDuration(Math.min(30, Math.max(3, Number(e.target.value) || 3)))}
              className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => setDuration(Math.min(30, duration + 1))}
              className="grid h-8 w-9 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
              <Icon name="add" className="text-[17px] sm:text-[18px]" />
            </button>
            <span className="px-2 text-[11px] font-black text-slate-500 sm:px-3 sm:text-[12px]">ticks</span>
          </div>
        </div>

        {/* Target / barrier digit — Matches/Differs & Over/Under only */}
        {needsTarget && (
          <div className={CARD}>
            <div className="mb-2 text-center text-[12px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">{targetVerb}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {DIGITS.map((d) => {
                const active = targetDigit === d;
                const isLast = lastDigit === d;
                return (
                  <button key={d} type="button" onClick={() => setTargetDigit(d)}
                    className={`relative rounded-md py-1.5 font-mono text-[14px] font-black transition sm:py-2 sm:text-[15px] ${
                      active ? "bg-[#3a414d] text-white ring-1 ring-sky-400/60"
                             : "bg-[#0f1319] text-slate-400 hover:text-white"
                    }`}>
                    {d}
                    {isLast && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Payout preview */}
        <div className={`${CARD} space-y-2 text-[12px] sm:space-y-2.5 sm:text-[13px]`}>
          {sides.map((side) => (
            <div key={side} className="flex items-center justify-between">
              <span className="font-bold text-slate-400">{actionLabel(side)} payout</span>
              <span className="font-black text-white">{format(payoutFor(side))}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
            <span className="font-bold text-slate-400">Last digit</span>
            <span className="font-mono font-black text-amber-300">{lastDigit}</span>
          </div>
        </div>
      </div>

      {/* Live position banner — keeps the in-flight trade visible right where
          the user clicked, so placing a trade has immediate, felt feedback. */}
      {openPositions.length > 0 && <ActivePositions positions={openPositions} format={format} />}

      {/* Action buttons */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 p-2 sm:gap-2">
        {sides.map((side) => {
          const isRed = RED_SIDES.has(side);
          return (
            <button
              key={side}
              type="button"
              onClick={() => onTrade(side)}
              disabled={placing}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-2 text-center font-black text-white transition active:scale-[0.98] disabled:opacity-50 sm:px-3 sm:py-3 ${
                isRed ? "bg-[#e2474b] hover:bg-[#ec5a5e]" : "bg-[#16a085] hover:bg-[#1bb198]"
              }`}
            >
              <span className="flex items-center gap-1 text-[12px] sm:text-[14px]">
                <Icon name={isRed ? "trending_down" : "trending_up"} className="text-[14px] sm:text-[16px]" />
                {placing ? <LoadingDots /> : actionLabel(side)}
              </span>
              <span className="font-mono text-[10px] text-white/85 sm:text-[12px]">{format(payoutFor(side))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact live banner of in-flight positions shown above the action buttons.
// Ticks every 500ms so the user watches their contract count down in place.
function ActivePositions({
  positions, format,
}: {
  positions: { id: string; side: ContractSide; settlesAt: number }[];
  format: (v: number) => string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const soonest = positions.reduce((a, b) => (b.settlesAt < a.settlesAt ? b : a));
  const secondsLeft = Math.max(0, Math.ceil((soonest.settlesAt - now) / 1000));
  const settling = secondsLeft === 0;

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
          {settling ? "Settling…" : `${soonest.side} · ${secondsLeft}s`}
        </span>
      </div>
    </div>
  );
}
