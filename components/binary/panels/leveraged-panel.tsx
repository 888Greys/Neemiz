"use client";

import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
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
    <div className="flex h-full min-h-0 flex-col">
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
