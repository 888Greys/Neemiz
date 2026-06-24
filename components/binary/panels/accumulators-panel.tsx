"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { GROWTH_RATES, maxTicksFor, payoutAtTick } from "@/lib/accumulator";
import { ValuePickerSheet } from "./digit-panel";

const CARD = "rounded-lg bg-[#181b22] p-1.5 sm:p-3";
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
      {/* ── Mobile: Deriv-style (Growth/Stake/Take-profit cards + slim Buy) ── */}
      <MobileAccumulators
        currency={currency}
        stake={stake} setStake={setStake}
        growthRate={growthRate} setGrowthRate={setGrowthRate}
        takeProfitOn={takeProfitOn} setTakeProfitOn={setTakeProfitOn}
        takeProfit={takeProfit} setTakeProfit={setTakeProfit}
        maxPayout={maxPayout}
        onBuy={onBuy} placing={placing} format={format}
      />

      {/* ── Desktop (sm+): existing config layout, untouched ── */}
      <div className="hidden sm:flex sm:h-full sm:min-h-0 sm:flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {/* Growth rate */}
        <div className={CARD}>
          <div className="mb-1.5 flex items-center justify-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">
            Growth rate
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {GROWTH_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setGrowthRate(r)}
                className={`rounded-md py-1 text-[10px] font-black transition sm:py-2 sm:text-[13px] ${
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
          <div className="mb-1.5 text-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">Stake</div>
          <div className="flex gap-1.5">
            <div className={`flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setStake(Math.max(1, stake - 1))}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input
                type="number" value={stake}
                onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setStake(stake + 1)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="add" className="text-[14px] sm:text-[18px]" />
              </button>
            </div>
            <button type="button" className={`${FIELD} gap-0.5 px-2 text-[11px] font-black text-slate-200 sm:gap-1 sm:px-3 sm:text-[13px]`}>
              <Icon name="chevron_left" className="text-[13px] text-slate-500 sm:text-[16px]" />
              {currency}
            </button>
          </div>
        </div>

        {/* Take profit */}
        <div className={CARD}>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-slate-200 sm:gap-2 sm:text-[13px]">
            <input type="checkbox" checked={takeProfitOn} onChange={(e) => setTakeProfitOn(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer rounded accent-[#16a085] sm:h-4 sm:w-4" />
            Take profit
          </label>
          {takeProfitOn && (
            <div className={`mt-1.5 sm:mt-2.5 ${FIELD}`}>
              <button type="button" onClick={() => setTakeProfit(Math.max(0, takeProfit - 1))}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input
                type="number" value={takeProfit}
                onChange={(e) => setTakeProfit(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setTakeProfit(takeProfit + 1)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="add" className="text-[14px] sm:text-[18px]" />
              </button>
            </div>
          )}
        </div>

        {/* Max payout / ticks */}
        <div className={`${CARD} grid grid-cols-2 gap-1 text-[10px] sm:block sm:space-y-2.5 sm:text-[13px]`}>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-400 sm:inline">Max. payout</span>
            <span className="block truncate font-black text-white sm:inline">{format(maxPayout)}</span>
          </div>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-400 sm:inline">Max. ticks</span>
            <span className="block truncate font-black text-white sm:inline">{maxTicks} ticks</span>
          </div>
        </div>
      </div>

      {/* Buy */}
      <div className="shrink-0 p-2 pt-1.5 sm:pt-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={placing}
          className="flex w-full items-center gap-2 rounded-lg bg-[#16a085] px-3 py-2 text-[12px] font-black text-white transition hover:bg-[#1bb198] active:scale-[0.99] disabled:opacity-50 sm:px-4 sm:py-3.5 sm:text-[15px]"
        >
          <Icon name="show_chart" className="text-[16px] sm:text-[18px]" />
          {placing ? <LoadingDots /> : "Buy"}
          <Icon name="arrow_forward" className="ml-auto text-[16px] sm:text-[18px]" />
        </button>
      </div>
      </div>
    </div>
  );
}

// Deriv-style mobile Accumulators surface: Growth rate / Stake / Take profit as
// three tappable cards (open picker sheets), a Max-payout line, and one slim Buy
// button. Mirrors the digit panel. Shown only below sm.
function MobileAccumulators({
  currency, stake, setStake, growthRate, setGrowthRate,
  takeProfitOn, setTakeProfitOn, takeProfit, setTakeProfit,
  maxPayout, onBuy, placing, format,
}: {
  currency: string;
  stake: number; setStake: (v: number) => void;
  growthRate: number; setGrowthRate: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  maxPayout: number;
  onBuy: () => void; placing: boolean;
  format: (v: number) => string;
}) {
  const [sheet, setSheet] = useState<null | "growth" | "stake" | "tp">(null);
  const fieldCard = "flex flex-col items-start rounded-2xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  return (
    <div className="flex h-full min-h-0 flex-col sm:hidden">
      <div className="min-h-0 flex-1" />

      <div className="space-y-2.5 px-3 pb-1">
        <div className="grid grid-cols-3 gap-2.5">
          <button type="button" onClick={() => setSheet("growth")} className={fieldCard}>
            <span className="text-[11px] font-bold text-slate-400">Growth rate</span>
            <span className="mt-0.5 text-[16px] font-black text-white">{growthRate}%</span>
          </button>
          <button type="button" onClick={() => setSheet("stake")} className={fieldCard}>
            <span className="text-[11px] font-bold text-slate-400">Stake</span>
            <span className="mt-0.5 text-[16px] font-black text-white">{stake} {currency}</span>
          </button>
          <button type="button" onClick={() => setSheet("tp")} className={`${fieldCard} relative`}>
            <span className="text-[11px] font-bold text-slate-400">Take profit</span>
            <span className="mt-0.5 text-[16px] font-black text-white">{takeProfitOn ? `${takeProfit}` : "—"}</span>
            {takeProfitOn && (
              <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setTakeProfitOn(false); }}
                className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-slate-400">
                <Icon name="close" className="text-[12px]" />
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-[12px]">
          <span className="font-bold text-slate-400">Max. payout</span>
          <span className="font-black text-white">{format(maxPayout)}</span>
        </div>
      </div>

      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={onBuy}
          disabled={placing}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#16a085] py-3 text-[15px] font-black text-white transition active:scale-[0.98] active:bg-[#1bb198] disabled:opacity-50"
        >
          {placing ? <LoadingDots /> : "Buy"}
        </button>
      </div>

      {sheet === "growth" && (
        <ValuePickerSheet
          title="Growth rate" unit="%" value={growthRate}
          presets={[...GROWTH_RATES]} min={GROWTH_RATES[0]} max={GROWTH_RATES[GROWTH_RATES.length - 1]} integer
          onChange={setGrowthRate} onClose={() => setSheet(null)}
        />
      )}
      {sheet === "stake" && (
        <ValuePickerSheet
          title="Stake" unit={currency} value={stake}
          presets={[10, 50, 100, 500, 1000, 5000]} min={1} max={1_000_000}
          onChange={setStake} onClose={() => setSheet(null)}
        />
      )}
      {sheet === "tp" && (
        <ValuePickerSheet
          title="Take profit" unit={currency} value={takeProfit || 10}
          presets={[5, 10, 20, 50, 100]} min={1} max={1_000_000}
          onChange={(v) => { setTakeProfit(v); setTakeProfitOn(true); }} onClose={() => setSheet(null)}
        />
      )}
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
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:space-y-2">
        <div className={`${CARD} text-center`}>
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300 sm:gap-2 sm:text-[12px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Running · {position.growthRate}%
          </div>
          <div className="mt-1.5 font-mono text-[20px] font-black leading-none text-white sm:mt-2 sm:text-[30px]">{format(position.netPayout)}</div>
          <div className={`mt-1 text-[11px] font-black sm:text-[13px] ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {profit >= 0 ? "+" : ""}{format(profit)}
          </div>
        </div>

        <div className={`${CARD} space-y-1.5 text-[11px] sm:space-y-2.5 sm:text-[13px]`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Stake</span>
            <span className="font-black text-white">{format(position.stake)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Ticks</span>
            <span className="font-mono font-black text-white">{position.ticksSurvived} / {position.maxTicks}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#0f1319] sm:h-1.5">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Cash out */}
      <div className="shrink-0 p-2 pt-1.5 sm:pt-2">
        <button
          type="button"
          onClick={onCashOut}
          disabled={closing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a085] px-3 py-2 text-[12px] font-black text-white transition hover:bg-[#1bb198] active:scale-[0.99] disabled:opacity-50 sm:px-4 sm:py-3.5 sm:text-[15px]"
        >
          <Icon name="payments" className="text-[16px] sm:text-[18px]" />
          {closing ? <LoadingDots /> : <>Cash out {format(position.netPayout)}</>}
        </button>
      </div>
    </div>
  );
}
