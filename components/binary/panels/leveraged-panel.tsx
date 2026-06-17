"use client";

import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { MULTIPLIERS, type LeveragedKindT, type LeveragedDirection } from "@/lib/leveraged";

const CARD = "rounded-lg bg-[#181b22] p-3";
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
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {/* Multiplier (MULTIPLIER) or barrier distance (TURBO) */}
        {!isTurbo ? (
          <div className={CARD}>
            <div className="mb-2.5 flex items-center justify-center gap-1 text-[13px] font-bold text-slate-200">Multiplier</div>
            <div className="grid grid-cols-5 gap-1.5">
              {MULTIPLIERS.map((m) => (
                <button key={m} type="button" onClick={() => setMultiplier(m)}
                  className={`rounded-md py-2 text-[12px] font-black transition ${
                    multiplier === m ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                  }`}>×{m}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className={CARD}>
            <div className="mb-2.5 flex items-center justify-center gap-1 text-[13px] font-bold text-slate-200">Barrier distance</div>
            <div className={FIELD}>
              <button type="button" onClick={() => setBarrierOffset(Math.round((barrierOffset - offsetStep) * 100) / 100)}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="remove" className="text-[18px]" />
              </button>
              <input type="number" value={barrierOffset}
                onChange={(e) => setBarrierOffset(Number(e.target.value) || 0)}
                className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setBarrierOffset(Math.round((barrierOffset + offsetStep) * 100) / 100)}
                className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
                <Icon name="add" className="text-[18px]" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="font-bold text-slate-400">Payout / point</span>
              <span className="font-black text-white">{format(payoutPerPoint)}</span>
            </div>
          </div>
        )}

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

        {/* Take profit / Stop loss */}
        <div className={`${CARD} space-y-2.5`}>
          <Toggle label="Take profit" on={takeProfitOn} setOn={setTakeProfitOn} value={takeProfit} setValue={setTakeProfit} min={0} />
          <Toggle label="Stop loss" on={stopLossOn} setOn={setStopLossOn} value={stopLoss} setValue={setStopLoss} min={0} max={stake} />
        </div>

        {/* Risk preview */}
        <div className={`${CARD} space-y-2.5 text-[13px]`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">{isTurbo ? "Knockout barrier" : "Stop-out"}</span>
            <span className="font-mono font-black text-amber-300">{formatSpot(dangerSpot)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">Max. payout</span>
            <span className="font-black text-white">{format(maxPayout)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
            <span className="font-bold text-slate-400">Spot</span>
            <span className="font-mono font-black text-sky-300">{formatSpot(latestSpot)}</span>
          </div>
        </div>
      </div>

      {/* Direction buttons */}
      <div className="grid shrink-0 grid-cols-2 gap-2 p-2">
        <button type="button" onClick={() => onTrade("UP")} disabled={placing}
          className="flex flex-col items-center gap-0.5 rounded-lg bg-[#16a085] px-3 py-3 text-center font-black text-white transition hover:bg-[#1bb198] active:scale-[0.98] disabled:opacity-50">
          <span className="flex items-center gap-1 text-[14px]">
            <Icon name="trending_up" className="text-[16px]" />
            {placing ? <LoadingDots /> : "UP"}
          </span>
          <span className="font-mono text-[12px] text-white/85">{isTurbo ? "Long" : `×${multiplier}`}</span>
        </button>
        <button type="button" onClick={() => onTrade("DOWN")} disabled={placing}
          className="flex flex-col items-center gap-0.5 rounded-lg bg-[#e2474b] px-3 py-3 text-center font-black text-white transition hover:bg-[#ec5a5e] active:scale-[0.98] disabled:opacity-50">
          <span className="flex items-center gap-1 text-[14px]">
            <Icon name="trending_down" className="text-[16px]" />
            {placing ? <LoadingDots /> : "DOWN"}
          </span>
          <span className="font-mono text-[12px] text-white/85">{isTurbo ? "Short" : `×${multiplier}`}</span>
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
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-slate-200">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded accent-[#16a085]" />
        {label}
      </label>
      {on && (
        <div className={`mt-2 ${FIELD}`}>
          <button type="button" onClick={() => setValue(clamp(value - 1))}
            className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
            <Icon name="remove" className="text-[18px]" />
          </button>
          <input type="number" value={value}
            onChange={(e) => setValue(clamp(Number(e.target.value) || 0))}
            className="w-full min-w-0 bg-transparent text-center text-[15px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
          <button type="button" onClick={() => setValue(clamp(value + 1))}
            className="grid h-9 w-10 place-items-center text-slate-300 hover:text-white">
            <Icon name="add" className="text-[18px]" />
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
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div className={`${CARD} text-center`}>
          <div className={`flex items-center justify-center gap-2 text-[12px] font-black uppercase tracking-wider ${dirUp ? "text-emerald-300" : "text-red-300"}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dirUp ? "bg-emerald-400/70" : "bg-red-400/70"}`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${dirUp ? "bg-emerald-400" : "bg-red-400"}`} />
            </span>
            {isTurbo ? "Turbo" : `Multiplier ×${position.multiplier}`} · {position.direction}
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
          {position.dangerSpot != null && (
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400">{isTurbo ? "Knockout" : "Stop-out"}</span>
              <span className="font-mono font-black text-amber-300">{formatSpot(position.dangerSpot)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cash out */}
      <div className="shrink-0 p-2">
        <button type="button" onClick={onCashOut} disabled={closing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a085] px-4 py-3.5 text-[15px] font-black text-white transition hover:bg-[#1bb198] active:scale-[0.99] disabled:opacity-50">
          <Icon name="payments" className="text-[18px]" />
          {closing ? <LoadingDots /> : <>Cash out {format(position.netPayout)}</>}
        </button>
      </div>
    </div>
  );
}
