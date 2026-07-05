"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { GROWTH_RATES, maxTicksFor, payoutAtTick, barrierFracFor } from "@/lib/accumulator";
import { ValuePickerSheet } from "./digit-panel";
import { useCurrency } from "@/lib/currency-context";

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
  sigma,
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
  sigma: number | null;
}) {
  const { convert, toKes, currency: cc } = useCurrency();
  const stakeDisplay = Number(convert(stake).toFixed(cc.decimals));
  const setStakeDisplay = (shown: number) => setStake(Math.max(1, Math.round(toKes(shown))));
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
        sigma={sigma}
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
              <button type="button" onClick={() => setStakeDisplay(stakeDisplay - 1)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input
                type="number" value={stakeDisplay}
                onChange={(e) => setStakeDisplay(Number(e.target.value) || 0)}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setStakeDisplay(stakeDisplay + 1)}
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
  maxPayout, onBuy, placing, format, sigma,
}: {
  currency: string;
  stake: number; setStake: (v: number) => void;
  growthRate: number; setGrowthRate: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  maxPayout: number;
  onBuy: () => void; placing: boolean;
  format: (v: number) => string;
  sigma: number | null;
}) {
  const { convert, currency: cc } = useCurrency();
  const stakeShown = convert(stake).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals });
  const [sheet, setSheet] = useState<null | "growth" | "stake" | "tp" | "maxpayout">(null);
  // Deriv shows the resulting barrier band (±%) and the max duration for the
  // selected growth rate at the foot of the growth-rate sheet.
  const barrierPct = sigma != null ? barrierFracFor(sigma, growthRate) * 100 : null;
  const growthFooter = (
    <div className="grid grid-cols-2 gap-2 text-center">
      <div>
        <div className="border-b border-dotted border-slate-600 pb-0.5 text-[11px] font-bold text-slate-400">Barrier</div>
        <div className="mt-1 text-[13px] font-black text-white">{barrierPct != null ? `±${barrierPct.toFixed(5)}%` : "—"}</div>
      </div>
      <div>
        <div className="border-b border-dotted border-slate-600 pb-0.5 text-[11px] font-bold text-slate-400">Max duration</div>
        <div className="mt-1 text-[13px] font-black text-white">{maxTicksFor(growthRate)} ticks</div>
      </div>
    </div>
  );
  // Collapsed by default: the three cards sit in a row where the 3rd peeks off
  // the right edge (Deriv). Tapping the grab handle expands to full-width stacks.
  const [expanded, setExpanded] = useState(false);
  const fieldCard = "flex flex-col items-start rounded-xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  const cards = [
    { key: "growth", label: "Growth rate", value: `${growthRate}%`, onClick: () => setSheet("growth") },
    { key: "stake", label: "Stake", value: `${stakeShown} ${currency}`, onClick: () => setSheet("stake") },
    { key: "tp", label: "Take profit", value: takeProfitOn ? `${takeProfit}` : "—", onClick: () => setSheet("tp") },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col sm:hidden">
      <div className="min-h-0 flex-1" />

      {/* Centered grab handle (Deriv-style) — expands/collapses the field cards */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse" : "Expand"}
        className="flex w-full shrink-0 justify-center py-1.5 text-slate-400 active:text-white"
      >
        <Icon name={expanded ? "expand_more" : "expand_less"} className="text-[22px]" />
      </button>

      <div className="space-y-2.5 px-3 pb-1">
        {expanded ? (
          <div className="space-y-2.5">
            {cards.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} className={`${fieldCard} w-full`}>
                <span className="text-[11px] font-bold text-slate-400">{c.label}</span>
                <span className="mt-0.5 text-[16px] font-black text-white">{c.value}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} className={`${fieldCard} w-[40%] shrink-0`}>
                <span className="whitespace-nowrap text-[11px] font-bold text-slate-400">{c.label}</span>
                <span className="mt-0.5 whitespace-nowrap text-[16px] font-black text-white">{c.value}</span>
              </button>
            ))}
          </div>
        )}

        {/* Max. payout — tappable (dotted underline) opens the info sheet, Deriv-style */}
        <div className="flex items-center justify-between px-1 text-[12px]">
          <button type="button" onClick={() => setSheet("maxpayout")}
            className="border-b border-dotted border-slate-500 pb-px font-bold text-slate-400">
            Max. payout
          </button>
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
          onChange={setGrowthRate} onClose={() => setSheet(null)} footer={growthFooter}
        />
      )}
      {sheet === "stake" && (
        <ValuePickerSheet
          money
          title="Stake" unit={currency} value={stake}
          presets={[10, 50, 100, 500, 1000, 5000]} min={1} max={1_000_000}
          onChange={setStake} onClose={() => setSheet(null)}
        />
      )}
      {sheet === "tp" && (
        <TakeProfitSheet
          currency={currency}
          on={takeProfitOn} setOn={setTakeProfitOn}
          value={takeProfit || 10} setValue={setTakeProfit}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "maxpayout" && <MaxPayoutInfoSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

// Deriv-exact Take profit sheet: a toggle switch, a +/- amount stepper that's
// disabled until the toggle is on, the ongoing-contract note, and one Save CTA.
// Exported so other leveraged panels (Turbo) reuse the same sheet.
export function TakeProfitSheet({
  currency, on, setOn, value, setValue, onClose, note = "Note: Cannot be adjusted for ongoing accumulator contracts.",
}: {
  currency: string;
  on: boolean; setOn: (v: boolean) => void;
  value: number; setValue: (v: number) => void;
  onClose: () => void;
  note?: string;
}) {
  const [enabled, setEnabled] = useState(on);
  const [amount, setAmount] = useState(value);
  const save = () => {
    setOn(enabled);
    if (enabled) setValue(Math.max(1, amount || 1));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="flex items-center justify-center px-4 pb-1 pt-2">
          <span className="text-[15px] font-black text-white">Take profit</span>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-slate-200">Take profit</span>
            <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-[#16a085]" : "bg-[#3a414d]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          <div className={`mt-3 flex items-center rounded-xl bg-[#0f1319] px-1 ring-1 ring-white/[0.06] transition ${enabled ? "" : "opacity-40"}`}>
            <button type="button" disabled={!enabled} onClick={() => setAmount((a) => Math.max(1, (a || 1) - 1))}
              className="grid h-11 w-11 place-items-center text-slate-300">
              <Icon name="remove" className="text-[18px]" />
            </button>
            <input type="number" inputMode="decimal" disabled={!enabled} value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full min-w-0 bg-transparent text-center text-[16px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <span className="px-1 text-[12px] font-black text-slate-500">{currency}</span>
            <button type="button" disabled={!enabled} onClick={() => setAmount((a) => (a || 0) + 1)}
              className="grid h-11 w-11 place-items-center text-slate-300">
              <Icon name="add" className="text-[18px]" />
            </button>
          </div>

          <p className="mt-4 text-center text-[12px] font-medium text-slate-500">{note}</p>

          <button type="button" onClick={save}
            className="mt-4 w-full rounded-2xl bg-white py-3.5 text-[15px] font-black text-[#16181d] transition active:scale-[0.98]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Deriv-exact Max. payout info sheet.
function MaxPayoutInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/65 lg:hidden" role="dialog" aria-modal="true" aria-label="About max payout">
      <div className="rounded-t-3xl bg-[#1b202a] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-2xl">
        <div className="mx-auto h-1 w-9 rounded-full bg-white/25" />
        <h2 className="mt-5 text-[20px] font-black text-white">Max. payout</h2>
        <p className="mt-3 text-[14px] font-medium leading-6 text-slate-300">
          Your contract will be automatically closed when your payout reaches this amount.
        </p>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-white py-3.5 text-[14px] font-black text-[#16181d]">Got it</button>
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
