"use client";

import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { GROWTH_RATES, maxTicksFor, payoutAtTick } from "@/lib/accumulator";

const CARD = "rounded-lg bg-[#181b22] p-3";
const FIELD = "flex items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06]";

export type RunningAccumulator = {
  ticksSurvived: number;
  maxTicks: number;
  growthRate: number;
  stake: number;
  netPayout: number;
};

// Deriv-style Accumulators panel. Stake grows by `growthRate`% each tick while
// the price stays inside the dynamic range; busts if it breaks out. When a
// contract is running, the panel swaps the config for a live payout + cash-out.
export function AccumulatorsPanel({
  currency,
  stake, setStake,
  growthRate, setGrowthRate,
  takeProfitOn, setTakeProfitOn,
  takeProfit, setTakeProfit,
  onBuy, placing,
  position, onCashOut, closing, format,
}: {
  currency: string;
  stake: number; setStake: (v: number) => void;
  growthRate: number; setGrowthRate: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  onBuy: () => void; placing: boolean;
  position: RunningAccumulator | null;
  onCashOut: () => void; closing: boolean;
  format: (v: number) => string;
}) {
  const maxTicks  = maxTicksFor(growthRate);
  const maxPayout = payoutAtTick(stake, growthRate, maxTicks);

  // A contract is running — show live payout + cash-out instead of the config.
  if (position) return <RunningContract position={position} onCashOut={onCashOut} closing={closing} format={format} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {/* Growth rate */}
        <div className={CARD}>
          <div className="mb-2.5 flex items-center justify-center gap-1 text-[13px] font-bold text-slate-200">
            Growth rate
            <Icon name="info" className="text-[14px] text-slate-500" />
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {GROWTH_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setGrowthRate(r)}
                className={`rounded-md py-2 text-[13px] font-black transition ${
                  growthRate === r
                    ? "bg-[#3a414d] text-white"
                    : "bg-[#0f1319] text-slate-400 hover:text-white"
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>

        {/* Stake */}
        <div className={CARD}>
          <div className="mb-2.5 text-center text-[13px] font-bold text-slate-200">Stake</div>
          <div className="flex gap-1.5">
            <div className={`flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setStake(Math.max(1, stake - 1))}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="remove" className="text-[18px]" />
              </button>
              <input
                type="number" value={stake}
                onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setStake(stake + 1)}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="add" className="text-[18px]" />
              </button>
            </div>
            <button type="button" className={`${FIELD} gap-1 px-3 text-[13px] font-black text-slate-200`}>
              <Icon name="chevron_left" className="text-[16px] text-slate-500" />
              {currency}
            </button>
          </div>
        </div>

        {/* Take profit */}
        <div className={CARD}>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-slate-200">
            <input type="checkbox" checked={takeProfitOn} onChange={(e) => setTakeProfitOn(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-[#16a085]" />
            Take profit
            <Icon name="info" className="text-[14px] text-slate-500" />
          </label>
          {takeProfitOn && (
            <div className={`mt-2.5 ${FIELD}`}>
              <button type="button" onClick={() => setTakeProfit(Math.max(0, takeProfit - 1))}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="remove" className="text-[18px]" />
              </button>
              <input
                type="number" value={takeProfit}
                onChange={(e) => setTakeProfit(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setTakeProfit(takeProfit + 1)}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="add" className="text-[18px]" />
              </button>
            </div>
          )}
        </div>

        {/* Max payout / ticks */}
        <div className={`${CARD} space-y-2.5 text-[13px]`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Max. payout</span>
            <span className="font-black text-white">{format(maxPayout)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Max. ticks</span>
            <span className="font-black text-white">{maxTicks} ticks</span>
          </div>
        </div>
      </div>

      {/* Buy */}
      <div className="shrink-0 p-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={placing}
          className="flex w-full items-center gap-2 rounded-lg bg-[#16a085] px-4 py-3.5 text-[15px] font-black text-white transition hover:bg-[#1bb198] active:scale-[0.99] disabled:opacity-50"
        >
          <Icon name="show_chart" className="text-[18px]" />
          {placing ? <LoadingDots /> : "Buy"}
          <Icon name="arrow_forward" className="ml-auto text-[18px]" />
        </button>
      </div>
    </div>
  );
}

// Live view of the running contract — payout grows tick by tick; one tap cashes
// out at the current value (server-authoritative). Replaces the config UI.
function RunningContract({
  position, onCashOut, closing, format,
}: {
  position: RunningAccumulator;
  onCashOut: () => void;
  closing: boolean;
  format: (v: number) => string;
}) {
  const profit = position.netPayout - position.stake;
  const progress = Math.min(1, position.ticksSurvived / position.maxTicks);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div className={`${CARD} text-center`}>
          <div className="flex items-center justify-center gap-2 text-[12px] font-black uppercase tracking-wider text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Running · {position.growthRate}%
          </div>
          <div className="mt-2 font-mono text-[30px] font-black leading-none text-white">{format(position.netPayout)}</div>
          <div className={`mt-1 text-[13px] font-black ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {profit >= 0 ? "+" : ""}{format(profit)}
          </div>
        </div>

        <div className={`${CARD} space-y-2.5 text-[13px]`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Stake</span>
            <span className="font-black text-white">{format(position.stake)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Ticks</span>
            <span className="font-mono font-black text-white">{position.ticksSurvived} / {position.maxTicks}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#0f1319]">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Cash out */}
      <div className="shrink-0 p-2">
        <button
          type="button"
          onClick={onCashOut}
          disabled={closing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a085] px-4 py-3.5 text-[15px] font-black text-white transition hover:bg-[#1bb198] active:scale-[0.99] disabled:opacity-50"
        >
          <Icon name="payments" className="text-[18px]" />
          {closing ? <LoadingDots /> : <>Cash out {format(position.netPayout)}</>}
        </button>
      </div>
    </div>
  );
}
