"use client";

import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";

const GROWTH_RATES = [1, 2, 3, 4, 5]; // percent per tick
const MAX_TICKS_BY_RATE: Record<number, number> = { 1: 230, 2: 120, 3: 80, 4: 60, 5: 50 };

const CARD = "rounded-lg bg-[#181b22] p-3";
const FIELD = "flex items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06]";

// Deriv-style Accumulators panel. Stake grows by `growthRate`% each tick while
// the price stays inside the dynamic range; busts if it breaks out.
// UI-only for now (demo) — `onBuy` is wired to settlement in a later pass.
export function AccumulatorsPanel({
  currency,
  stake, setStake,
  growthRate, setGrowthRate,
  takeProfitOn, setTakeProfitOn,
  takeProfit, setTakeProfit,
  onBuy, placing,
}: {
  currency: string;
  stake: number; setStake: (v: number) => void;
  growthRate: number; setGrowthRate: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  onBuy: () => void; placing: boolean;
}) {
  const maxTicks  = MAX_TICKS_BY_RATE[growthRate] ?? 50;
  const maxPayout = Math.round(stake * 30); // demo display only

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
            <span className="font-black text-white">{maxPayout.toLocaleString()} {currency}</span>
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
