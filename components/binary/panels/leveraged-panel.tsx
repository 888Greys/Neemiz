"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { ValuePickerSheet } from "./digit-panel";
import { TakeProfitSheet } from "./accumulators-panel";
import { MULTIPLIERS, type LeveragedKindT, type LeveragedDirection } from "@/lib/leveraged";

const CARD = "rounded-lg bg-[#181b22] p-1.5 sm:p-3";
const FIELD = "flex items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06]";

export type RunningLeveraged = {
  kind: LeveragedKindT;
  direction: LeveragedDirection;
  stake: number;
  netPayout: number; // retained cash-out credit at the live spot
  multiplier: number | null;
  dangerSpot: number | null; // stop-out (Multiplier) or knockout barrier (Turbo)
};

// Multipliers (leveraged P&L, stop-out) and Turbos (knockout barrier). Both are
// open-ended live cash-out contracts; settlement is server-authoritative. When a
// contract is running the panel swaps the config for a live P&L + cash-out.
export function LeveragedPanel({
  currency, kind,
  stake, setStake,
  multiplier, setMultiplier,
  barrierOffset, setBarrierOffset,
  takeProfitOn, setTakeProfitOn, takeProfit, setTakeProfit,
  stopLossOn, setStopLossOn, stopLoss, setStopLoss,
  latestSpot, payoutPerPoint, dangerSpot, maxPayout,
  stakePresets, minStake,
  format, formatSpot,
  onTrade, placing,
  position, onCashOut, closing,
}: {
  currency: string;
  kind: LeveragedKindT;
  stake: number; setStake: (v: number) => void;
  multiplier: number; setMultiplier: (v: number) => void;
  barrierOffset: number; setBarrierOffset: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  stopLossOn: boolean; setStopLossOn: (v: boolean) => void;
  stopLoss: number; setStopLoss: (v: number) => void;
  latestSpot: number;
  payoutPerPoint: number; // TURBO preview
  dangerSpot: number;     // stop-out price (MULTIPLIER) or knockout barrier (TURBO) at current config
  maxPayout: number;
  stakePresets: number[];
  minStake: number;
  format: (v: number) => string;
  formatSpot: (v: number) => string;
  onTrade: (direction: LeveragedDirection) => void;
  placing: boolean;
  position: RunningLeveraged | null;
  onCashOut: () => void; closing: boolean;
}) {
  if (position) return <RunningContract position={position} onCashOut={onCashOut} closing={closing} format={format} formatSpot={formatSpot} />;

  const isTurbo = kind === "TURBO";
  const offsetStep = Math.max(0.01, Math.round(latestSpot * 0.0003 * 100) / 100);

  return (
    <>
      {isTurbo ? (
        <MobileTurboPanel
          currency={currency}
          stake={stake} setStake={setStake}
          barrierOffset={barrierOffset} setBarrierOffset={setBarrierOffset}
          takeProfitOn={takeProfitOn} setTakeProfitOn={setTakeProfitOn}
          takeProfit={takeProfit} setTakeProfit={setTakeProfit}
          payoutPerPoint={payoutPerPoint} dangerSpot={dangerSpot}
          stakePresets={stakePresets} minStake={minStake}
          format={format} formatSpot={formatSpot}
          onTrade={onTrade} placing={placing} offsetStep={offsetStep}
        />
      ) : (
        <MobileMultiplierPanel
          currency={currency}
          stake={stake} setStake={setStake}
          multiplier={multiplier} setMultiplier={setMultiplier}
          takeProfitOn={takeProfitOn} setTakeProfitOn={setTakeProfitOn} takeProfit={takeProfit} setTakeProfit={setTakeProfit}
          stopLossOn={stopLossOn} setStopLossOn={setStopLossOn} stopLoss={stopLoss} setStopLoss={setStopLoss}
          dangerSpot={dangerSpot}
          stakePresets={stakePresets} minStake={minStake}
          format={format} formatSpot={formatSpot}
          onTrade={onTrade} placing={placing}
        />
      )}
    <div className="hidden h-full min-h-0 flex-col sm:flex">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {/* Multiplier (MULTIPLIER) or barrier distance (TURBO) */}
        {!isTurbo ? (
          <div className={CARD}>
            <div className="mb-1.5 flex items-center justify-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">Multiplier</div>
            <div className="grid grid-cols-5 gap-1.5">
              {MULTIPLIERS.map((m) => (
                <button key={m} type="button" onClick={() => setMultiplier(m)}
                  className={`rounded-md py-1 text-[10px] font-black transition sm:py-2 sm:text-[12px] ${
                    multiplier === m ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                  }`}>×{m}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`${CARD} flex items-center gap-2 sm:block`}>
            <div className="flex w-[72px] shrink-0 items-center justify-center text-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:w-auto sm:text-[13px]">Barrier distance</div>
            <div className={`min-w-0 flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setBarrierOffset(Math.round((barrierOffset - offsetStep) * 100) / 100)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input type="number" value={barrierOffset}
                onChange={(e) => setBarrierOffset(Number(e.target.value) || 0)}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setBarrierOffset(Math.round((barrierOffset + offsetStep) * 100) / 100)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="add" className="text-[14px] sm:text-[18px]" />
              </button>
            </div>
            <div className="hidden items-center justify-between text-[12px] sm:mt-2 sm:flex">
              <span className="font-bold text-slate-400">Payout / point</span>
              <span className="font-black text-white">{format(payoutPerPoint)}</span>
            </div>
          </div>
        )}

        {/* Stake */}
        <div className={CARD}>
          <div className="mb-1.5 text-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">Stake</div>
          <div className="flex gap-1.5">
            <div className={`flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setStake(Math.max(minStake, stake - 1))}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input type="number" value={stake}
                onChange={(e) => setStake(Math.max(minStake, Number(e.target.value) || 0))}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setStake(stake + 1)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="add" className="text-[14px] sm:text-[18px]" />
              </button>
            </div>
            <span className={`${FIELD} px-2 text-[11px] font-black text-slate-200 sm:px-3 sm:text-[13px]`}>{currency}</span>
          </div>
          <div className="mt-1.5 grid grid-cols-6 gap-1">
            {stakePresets.map((amount) => (
              <button key={amount} type="button" onClick={() => setStake(amount)}
                className={`rounded-md py-0.5 text-[10px] font-black transition sm:py-1.5 sm:text-[11px] ${
                  stake === amount ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                }`}>{amount}</button>
            ))}
          </div>
        </div>

        {/* Take profit / Stop loss */}
        <div className={`${CARD} grid grid-cols-2 gap-1.5 sm:block sm:space-y-2.5`}>
          <Toggle label="Take profit" on={takeProfitOn} setOn={setTakeProfitOn} value={takeProfit} setValue={setTakeProfit} min={0} />
          <Toggle label="Stop loss" on={stopLossOn} setOn={setStopLossOn} value={stopLoss} setValue={setStopLoss} min={0} max={stake} />
        </div>

        {/* Risk preview */}
        <div className={`${CARD} grid grid-cols-3 gap-1 text-[10px] sm:block sm:space-y-2.5 sm:text-[13px]`}>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-400 sm:inline">{isTurbo ? "Knockout" : "Stop-out"}</span>
            <span className="block truncate font-mono font-black text-amber-300 sm:inline">{formatSpot(dangerSpot)}</span>
          </div>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-400 sm:inline">Max. payout</span>
            <span className="block truncate font-black text-white sm:inline">{format(maxPayout)}</span>
          </div>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:border-t sm:border-white/[0.06] sm:bg-transparent sm:p-0 sm:pt-2">
            <span className="block truncate font-bold text-slate-400 sm:inline">Spot</span>
            <span className="block truncate font-mono font-black text-sky-300 sm:inline">{formatSpot(latestSpot)}</span>
          </div>
        </div>
      </div>

      {/* Direction buttons */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 p-2 pt-1.5 sm:gap-2 sm:pt-2">
        <button type="button" onClick={() => onTrade("UP")} disabled={placing}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#16a085] px-2.5 py-1.5 text-center font-black text-white transition hover:bg-[#1bb198] active:scale-[0.98] disabled:opacity-50 sm:flex-col sm:gap-0.5 sm:px-3 sm:py-3">
          <span className="flex items-center gap-1 text-[11px] sm:text-[14px]">
            <Icon name="trending_up" className="text-[13px] sm:text-[16px]" />
            {placing ? <LoadingDots /> : "UP"}
          </span>
          <span className="font-mono text-[9px] leading-none text-white/85 sm:text-[12px]">{isTurbo ? "Long" : `×${multiplier}`}</span>
        </button>
        <button type="button" onClick={() => onTrade("DOWN")} disabled={placing}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#e2474b] px-2.5 py-1.5 text-center font-black text-white transition hover:bg-[#ec5a5e] active:scale-[0.98] disabled:opacity-50 sm:flex-col sm:gap-0.5 sm:px-3 sm:py-3">
          <span className="flex items-center gap-1 text-[11px] sm:text-[14px]">
            <Icon name="trending_down" className="text-[13px] sm:text-[16px]" />
            {placing ? <LoadingDots /> : "DOWN"}
          </span>
          <span className="font-mono text-[9px] leading-none text-white/85 sm:text-[12px]">{isTurbo ? "Short" : `×${multiplier}`}</span>
        </button>
      </div>
    </div>
    </>
  );
}

// Turbo has a dedicated compact mobile ticket. It follows the same card rhythm
// as the Deriv ticket (direction first, concise fields, one clear Buy action)
// while retaining our live knockout and cash-out contract mechanics.
function MobileTurboPanel({
  currency, stake, setStake, barrierOffset, setBarrierOffset,
  takeProfitOn, setTakeProfitOn, takeProfit, setTakeProfit,
  payoutPerPoint, dangerSpot, stakePresets, minStake,
  format, formatSpot, onTrade, placing, offsetStep,
}: {
  currency: string; stake: number; setStake: (v: number) => void;
  barrierOffset: number; setBarrierOffset: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  payoutPerPoint: number; dangerSpot: number; stakePresets: number[]; minStake: number;
  format: (v: number) => string; formatSpot: (v: number) => string;
  onTrade: (direction: LeveragedDirection) => void; placing: boolean; offsetStep: number;
}) {
  const [direction, setDirection] = useState<LeveragedDirection>("UP");
  const [picker, setPicker] = useState<null | "stake" | "barrier" | "tp">(null);
  // Collapsed by default: the 3 cards sit in a row where the 3rd (Take profit)
  // peeks off the right edge (Deriv); the grab handle expands to full-width.
  const [expanded, setExpanded] = useState(false);
  const fieldCard = "flex flex-col items-start rounded-xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  const cards = [
    { key: "stake", label: "Stake", value: `${stake} ${currency}`, accent: "text-white", onClick: () => setPicker("stake") },
    { key: "payout", label: "Payout per point", value: format(payoutPerPoint), accent: "text-white", onClick: () => setPicker("barrier") },
    { key: "tp", label: "Take profit", value: takeProfitOn ? `${takeProfit}` : "—", accent: "text-white", onClick: () => setPicker("tp") },
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

      <div className="space-y-2.5 px-3 pb-2">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-[#0d1015] p-1 ring-1 ring-white/[0.07]">
          {(["UP", "DOWN"] as LeveragedDirection[]).map((side) => (
            <button key={side} type="button" onClick={() => setDirection(side)}
              className={`rounded-full py-2 text-[13px] font-black transition ${
                direction === side
                  ? side === "UP" ? "bg-[#16a085] text-white" : "bg-[#e2474b] text-white"
                  : "text-slate-400"
              }`}
            >{side === "UP" ? "Up" : "Down"}</button>
          ))}
        </div>

        {/* Fields: Stake | Payout per point | Take profit — peek row collapsed, stack expanded */}
        {expanded ? (
          <div className="space-y-2.5">
            {cards.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} className={`${fieldCard} w-full`}>
                <span className="text-[11px] font-bold text-slate-400">{c.label}</span>
                <span className={`mt-0.5 text-[16px] font-black ${c.accent}`}>{c.value}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} className={`${fieldCard} w-[40%] shrink-0`}>
                <span className="whitespace-nowrap text-[11px] font-bold text-slate-400">{c.label}</span>
                <span className={`mt-0.5 whitespace-nowrap text-[16px] font-black ${c.accent}`}>{c.value}</span>
              </button>
            ))}
          </div>
        )}


        <button type="button" onClick={() => onTrade(direction)} disabled={placing}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-black text-white transition active:scale-[0.98] disabled:opacity-50 ${direction === "UP" ? "bg-[#16a085]" : "bg-[#e2474b]"}`}>
          {placing ? <LoadingDots /> : <>Buy {direction === "UP" ? "Up" : "Down"}</>}
        </button>
      </div>
      {picker === "stake" && <ValuePickerSheet title="Stake" unit={currency} value={stake} presets={stakePresets} min={minStake} max={1_000_000} onChange={setStake} onClose={() => setPicker(null)} />}
      {picker === "barrier" && <ValuePickerSheet title="Payout per point" unit="" value={barrierOffset} presets={[offsetStep, offsetStep * 2, offsetStep * 3, offsetStep * 5, offsetStep * 8, offsetStep * 13].map((v) => Number(v.toFixed(2)))} min={-999_999} max={999_999} onChange={setBarrierOffset} onClose={() => setPicker(null)} />}
      {picker === "tp" && <TakeProfitSheet currency={currency} on={takeProfitOn} setOn={setTakeProfitOn} value={takeProfit || 10} setValue={setTakeProfit} note="Note: Cannot be adjusted for ongoing Turbo contracts." onClose={() => setPicker(null)} />}
    </div>
  );
}

// Multipliers mobile ticket, matched to Deriv: direction toggle, then three
// tappable cards — Multiplier (sheet), Stake (sheet) and Risk management (TP/SL
// + deal-cancellation sheet) — with the live Stop-out line and one Buy action.
function MobileMultiplierPanel({
  currency, stake, setStake, multiplier, setMultiplier,
  takeProfitOn, setTakeProfitOn, takeProfit, setTakeProfit,
  stopLossOn, setStopLossOn, stopLoss, setStopLoss,
  dangerSpot, stakePresets, minStake,
  format, formatSpot, onTrade, placing,
}: {
  currency: string; stake: number; setStake: (v: number) => void;
  multiplier: number; setMultiplier: (v: number) => void;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void;
  takeProfit: number; setTakeProfit: (v: number) => void;
  stopLossOn: boolean; setStopLossOn: (v: boolean) => void;
  stopLoss: number; setStopLoss: (v: number) => void;
  dangerSpot: number; stakePresets: number[]; minStake: number;
  format: (v: number) => string; formatSpot: (v: number) => string;
  onTrade: (direction: LeveragedDirection) => void; placing: boolean;
}) {
  const [direction, setDirection] = useState<LeveragedDirection>("UP");
  const [sheet, setSheet] = useState<null | "multiplier" | "stake" | "risk" | "stopout">(null);
  // Collapsed by default: the 3 cards sit in a row where the 3rd peeks off the
  // right edge (Deriv); the grab handle expands to a full-width stack.
  const [expanded, setExpanded] = useState(false);
  const fieldCard = "flex flex-col items-start rounded-xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  const riskValue = takeProfitOn || stopLossOn ? [takeProfitOn ? "TP" : null, stopLossOn ? "SL" : null].filter(Boolean).join(" · ") : "—";
  const cards = [
    { key: "multiplier", label: "Multiplier", value: `x${multiplier}`, accent: "text-white", onClick: () => setSheet("multiplier") },
    { key: "stake", label: "Stake", value: `${stake} ${currency}`, accent: "text-white", onClick: () => setSheet("stake") },
    { key: "risk", label: "Risk management", value: riskValue, accent: "text-white", onClick: () => setSheet("risk") },
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

      <div className="space-y-2.5 px-3 pb-2">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-[#0d1015] p-1 ring-1 ring-white/[0.07]">
          {(["UP", "DOWN"] as LeveragedDirection[]).map((side) => (
            <button key={side} type="button" onClick={() => setDirection(side)}
              className={`rounded-full py-2 text-[13px] font-black transition ${
                direction === side
                  ? side === "UP" ? "bg-[#16a085] text-white" : "bg-[#e2474b] text-white"
                  : "text-slate-400"
              }`}
            >{side === "UP" ? "Up" : "Down"}</button>
          ))}
        </div>

        {/* Fields: Multiplier | Stake | Risk management — peek row / full stack */}
        {expanded ? (
          <div className="space-y-2.5">
            {cards.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} className={`${fieldCard} w-full`}>
                <span className="text-[11px] font-bold text-slate-400">{c.label}</span>
                <span className={`mt-0.5 text-[16px] font-black ${c.accent}`}>{c.value}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} className={`${fieldCard} w-[40%] shrink-0`}>
                <span className="whitespace-nowrap text-[11px] font-bold text-slate-400">{c.label}</span>
                <span className={`mt-0.5 whitespace-nowrap text-[16px] font-black ${c.accent}`}>{c.value}</span>
              </button>
            ))}
          </div>
        )}

        {/* Stop out — dotted-underline line that opens the info sheet (Deriv) */}
        <button type="button" onClick={() => setSheet("stopout")} className="flex w-full items-center justify-between border-b border-dotted border-slate-500 pb-1 text-[12px] text-slate-300">
          <span className="font-bold">Stop out</span>
          <span className="font-mono font-black text-amber-300">{formatSpot(dangerSpot)}</span>
        </button>

        <button type="button" onClick={() => onTrade(direction)} disabled={placing}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-black text-white transition active:scale-[0.98] disabled:opacity-50 ${direction === "UP" ? "bg-[#16a085]" : "bg-[#e2474b]"}`}>
          {placing ? <LoadingDots /> : <>Buy {direction === "UP" ? "Up" : "Down"} · ×{multiplier}</>}
        </button>
      </div>

      {sheet === "multiplier" && <MultiplierSheet value={multiplier} onChange={setMultiplier} onClose={() => setSheet(null)} />}
      {sheet === "stake" && <ValuePickerSheet title="Stake" unit={currency} value={stake} presets={stakePresets} min={minStake} max={1_000_000} onChange={setStake} onClose={() => setSheet(null)} />}
      {sheet === "risk" && (
        <RiskManagementSheet
          currency={currency}
          takeProfitOn={takeProfitOn} setTakeProfitOn={setTakeProfitOn} takeProfit={takeProfit} setTakeProfit={setTakeProfit}
          stopLossOn={stopLossOn} setStopLossOn={setStopLossOn} stopLoss={stopLoss} setStopLoss={setStopLoss}
          maxStopLoss={stake} onClose={() => setSheet(null)}
        />
      )}
      {sheet === "stopout" && <StopOutInfoSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

// Deriv-style Multiplier picker: the available multiplier chips stacked, with a
// Save action. (Commission is omitted — we don't charge a per-trade commission.)
function MultiplierSheet({ value, onChange, onClose }: { value: number; onChange: (v: number) => void; onClose: () => void }) {
  const [sel, setSel] = useState(value);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-1 pt-2 text-center text-[15px] font-black text-white">Multiplier</div>
        <div className="space-y-2 px-4 pt-3">
          {MULTIPLIERS.map((m) => (
            <button key={m} type="button" onClick={() => setSel(m)}
              className={`w-full rounded-xl py-3 text-[15px] font-black transition ${sel === m ? "bg-[#3a414d] text-white ring-1 ring-sky-400/60" : "bg-[#0f1319] text-slate-300"}`}>
              x{m}
            </button>
          ))}
        </div>
        <div className="px-4 pt-4">
          <button type="button" onClick={() => { onChange(sel); onClose(); }}
            className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-black text-[#16181d] transition active:scale-[0.98]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Deriv-style Risk management sheet. The "TP & SL" tab is fully wired; the
// "Deal cancellation" tab is shown for parity but not yet offered (disabled).
function RiskManagementSheet({
  currency, takeProfitOn, setTakeProfitOn, takeProfit, setTakeProfit,
  stopLossOn, setStopLossOn, stopLoss, setStopLoss, maxStopLoss, onClose,
}: {
  currency: string;
  takeProfitOn: boolean; setTakeProfitOn: (v: boolean) => void; takeProfit: number; setTakeProfit: (v: number) => void;
  stopLossOn: boolean; setStopLossOn: (v: boolean) => void; stopLoss: number; setStopLoss: (v: number) => void;
  maxStopLoss: number; onClose: () => void;
}) {
  const [tab, setTab] = useState<"tpsl" | "deal">("tpsl");
  const [tpOn, setTpOn] = useState(takeProfitOn);
  const [tp, setTp] = useState(takeProfit || 10);
  const [slOn, setSlOn] = useState(stopLossOn);
  const [sl, setSl] = useState(stopLoss || Math.max(1, Math.round(maxStopLoss / 2)));

  const save = () => {
    setTakeProfitOn(tpOn); if (tpOn) setTakeProfit(Math.max(1, tp || 1));
    setStopLossOn(slOn); if (slOn) setStopLoss(Math.min(maxStopLoss, Math.max(1, sl || 1)));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-1 pt-2 text-center text-[15px] font-black text-white">Risk management</div>

        <div className="grid grid-cols-2 gap-2 px-4 pt-2">
          {([["tpsl", "TP & SL"], ["deal", "Deal cancellation"]] as const).map(([t, label]) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-xl py-2.5 text-[12px] font-black transition ${tab === t ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "tpsl" ? (
          <div className="space-y-4 px-4 pt-4">
            <RiskRow label="Take profit" on={tpOn} setOn={setTpOn} value={tp} setValue={setTp} currency={currency} />
            <RiskRow label="Stop loss" on={slOn} setOn={setSlOn} value={sl} setValue={setSl} currency={currency} max={maxStopLoss} />
          </div>
        ) : (
          <div className="px-4 pt-6 pb-2 text-center">
            <p className="text-[13px] font-bold text-slate-300">Deal cancellation</p>
            <p className="mt-2 text-[12px] font-medium leading-5 text-slate-500">Cancel a losing trade within a set window. Coming soon.</p>
          </div>
        )}

        <div className="px-4 pt-5">
          <button type="button" onClick={save}
            className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-black text-[#16181d] transition active:scale-[0.98]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// One toggle + amount stepper row inside the Risk management sheet.
function RiskRow({
  label, on, setOn, value, setValue, currency, max,
}: {
  label: string; on: boolean; setOn: (v: boolean) => void;
  value: number; setValue: (v: number) => void; currency: string; max?: number;
}) {
  const clamp = (v: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(1, v));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-slate-200">{label}</span>
        <button type="button" role="switch" aria-checked={on} onClick={() => setOn(!on)}
          className={`relative h-6 w-11 rounded-full transition ${on ? "bg-[#16a085]" : "bg-[#3a414d]"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <div className={`mt-2 flex items-center rounded-xl bg-[#0f1319] px-1 ring-1 ring-white/[0.06] transition ${on ? "" : "opacity-40"}`}>
        <button type="button" disabled={!on} onClick={() => setValue(clamp((value || 1) - 1))} className="grid h-11 w-11 place-items-center text-slate-300">
          <Icon name="remove" className="text-[18px]" />
        </button>
        <input type="number" inputMode="decimal" disabled={!on} value={value}
          onChange={(e) => setValue(Number(e.target.value) || 0)}
          className="w-full min-w-0 bg-transparent text-center text-[16px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
        <span className="px-1 text-[12px] font-black text-slate-500">{currency}</span>
        <button type="button" disabled={!on} onClick={() => setValue(clamp((value || 0) + 1))} className="grid h-11 w-11 place-items-center text-slate-300">
          <Icon name="add" className="text-[18px]" />
        </button>
      </div>
    </div>
  );
}

// Deriv-style Stop out info sheet.
function StopOutInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/65 lg:hidden" role="dialog" aria-modal="true" aria-label="About stop out">
      <div className="rounded-t-3xl bg-[#1b202a] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-2xl">
        <div className="mx-auto h-1 w-9 rounded-full bg-white/25" />
        <h2 className="mt-5 text-[20px] font-black text-white">Stop out</h2>
        <p className="mt-3 text-[14px] font-medium leading-6 text-slate-300">Your contract will be closed automatically when your loss reaches 100% of your stake.</p>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-white py-3.5 text-[14px] font-black text-[#16181d]">Got it</button>
      </div>
    </div>
  );
}

function Toggle({
  label, on, setOn, value, setValue, min, max,
}: {
  label: string; on: boolean; setOn: (v: boolean) => void;
  value: number; setValue: (v: number) => void; min: number; max?: number;
}) {
  const clamp = (v: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, v));
  return (
    <div className="min-w-0 rounded-md bg-[#0f1319]/50 p-1 sm:bg-transparent sm:p-0">
      <label className="flex min-w-0 cursor-pointer items-center gap-1 text-[10px] font-bold text-slate-200 sm:gap-2 sm:text-[13px]">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)}
          className="h-3 w-3 shrink-0 cursor-pointer rounded accent-[#16a085] sm:h-4 sm:w-4" />
        <span className="min-w-0 truncate">{label}</span>
      </label>
      {on && (
        <div className={`mt-1 sm:mt-2 ${FIELD}`}>
          <button type="button" onClick={() => setValue(clamp(value - 1))}
            className="grid h-6 w-6 shrink-0 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
            <Icon name="remove" className="text-[13px] sm:text-[18px]" />
          </button>
          <input type="number" value={value}
            onChange={(e) => setValue(clamp(Number(e.target.value) || 0))}
            className="w-full min-w-0 bg-transparent text-center text-[13px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <button type="button" onClick={() => setValue(clamp(value + 1))}
            className="grid h-6 w-6 shrink-0 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
            <Icon name="add" className="text-[13px] sm:text-[18px]" />
          </button>
        </div>
      )}
    </div>
  );
}

// Live view of the running contract — value moves with the spot; one tap cashes
// out at the current value (server-authoritative). Replaces the config UI.
function RunningContract({
  position, onCashOut, closing, format, formatSpot,
}: {
  position: RunningLeveraged;
  onCashOut: () => void; closing: boolean;
  format: (v: number) => string;
  formatSpot: (v: number) => string;
}) {
  const profit = position.netPayout - position.stake;
  const isTurbo = position.kind === "TURBO";
  const dirUp = position.direction === "UP";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:space-y-2">
        <div className={`${CARD} text-center`}>
          <div className={`flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider sm:gap-2 sm:text-[12px] ${dirUp ? "text-emerald-300" : "text-red-300"}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dirUp ? "bg-emerald-400/70" : "bg-red-400/70"}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${dirUp ? "bg-emerald-400" : "bg-red-400"}`} />
            </span>
            {isTurbo ? "Turbo" : `Multiplier ×${position.multiplier}`} · {position.direction}
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
          {position.dangerSpot != null && (
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400">{isTurbo ? "Knockout" : "Stop-out"}</span>
              <span className="font-mono font-black text-amber-300">{formatSpot(position.dangerSpot)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cash out */}
      <div className="shrink-0 p-2 pt-1.5 sm:pt-2">
        <button type="button" onClick={onCashOut} disabled={closing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a085] px-3 py-2 text-[12px] font-black text-white transition hover:bg-[#1bb198] active:scale-[0.99] disabled:opacity-50 sm:px-4 sm:py-3.5 sm:text-[15px]">
          <Icon name="payments" className="text-[16px] sm:text-[18px]" />
          {closing ? <LoadingDots /> : <>Cash out {format(position.netPayout)}</>}
        </button>
      </div>
    </div>
  );
}
