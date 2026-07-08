"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { LoadingDots } from "@/components/loading-dots";
import { ValuePickerSheet, DurationPickerSheet } from "./digit-panel";
import { useCurrency } from "@/lib/currency-context";
import type { DirectionalSide, DirectionalKind } from "@/lib/directional";

type DirKind = DirectionalKind;
type DirSide = DirectionalSide;

const CARD = "rounded-lg bg-[#181b22] p-1.5 sm:p-3";
const FIELD = "flex items-center rounded-md bg-[#0f1319] ring-1 ring-white/[0.06]";
const RED_SIDES = new Set<DirSide>(["FALL", "LOWER", "NO_TOUCH", "PUT"]);

function sideLabel(side: DirSide): string {
  return side === "NO_TOUCH" ? "NO TOUCH" : side;
}

// Rise/Fall (exit vs entry) and Higher/Lower (exit vs a chosen barrier).
// Fixed-duration; settlement is server-authoritative off the live feed.
export function DirectionalPanel({
  currency, kind, sides,
  stake, setStake,
  duration, setDuration,
  durationUnit, setDurationUnit, secPerTick,
  barrierOffset, setBarrierOffset, maxBarrierOffset,
  latestSpot,
  stakePresets, minStake,
  payoutFor, format, formatSpot,
  onTrade, placing, openPositions,
}: {
  currency: string;
  kind: DirKind;
  sides: DirSide[];
  stake: number; setStake: (v: number) => void;
  duration: number; setDuration: (v: number) => void;
  durationUnit: "ticks" | "seconds"; setDurationUnit: (v: "ticks" | "seconds") => void;
  secPerTick: number;
  barrierOffset: number; setBarrierOffset: (v: number) => void;
  maxBarrierOffset: number;
  latestSpot: number;
  stakePresets: number[];
  minStake: number;
  payoutFor: (side: DirSide) => number;
  format: (v: number) => string;
  formatSpot: (v: number) => string;
  onTrade: (side: DirSide) => void;
  placing: boolean;
  openPositions: { id: string; side: DirSide; settlesAt: number }[];
}) {
  const { convert, toKes, currency: cc } = useCurrency();
  const stakeDisplay = Number(convert(stake).toFixed(cc.decimals));
  const setStakeDisplay = (shown: number) => setStake(Math.max(minStake, Math.round(toKes(shown))));
  const needsBarrier = kind !== "RISE_FALL";
  const offsetStep = Math.max(0.01, Math.round(latestSpot * 0.0003 * 100) / 100);
  // Keep the barrier inside the fair band (see maxBarrierOffset). Anything past
  // it prices out of range and the server rejects it, so we never let the UI go there.
  const clampOffset = (v: number) =>
    Math.max(-maxBarrierOffset, Math.min(maxBarrierOffset, Math.round((v || 0) * 100) / 100));
  const barrier = latestSpot + barrierOffset;

  // Mobile uses Deriv's single-CTA model: a side toggle + one Buy button.
  const [armedSide, setArmedSide] = useState<DirSide>(sides[0]);
  const selectedSide = sides.includes(armedSide) ? armedSide : sides[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Mobile: Deriv-style single-CTA surface (hidden on sm+) ── */}
      <MobileDirectional
        currency={currency}
        sides={sides}
        selectedSide={selectedSide}
        onArmSide={setArmedSide}
        stake={stake} setStake={setStake}
        duration={duration} setDuration={setDuration}
        durationUnit={durationUnit} setDurationUnit={setDurationUnit} secPerTick={secPerTick}
        barrierOffset={barrierOffset} setBarrierOffset={setBarrierOffset}
        maxBarrierOffset={maxBarrierOffset}
        needsBarrier={needsBarrier}
        barrier={barrier}
        latestSpot={latestSpot}
        offsetStep={offsetStep}
        stakePresets={stakePresets} minStake={minStake}
        payoutFor={payoutFor} format={format} formatSpot={formatSpot}
        onTrade={onTrade} placing={placing} openPositions={openPositions}
      />

      {/* ── Desktop (sm+): existing dual-button layout, untouched ── */}
      <div className="hidden sm:flex sm:h-full sm:min-h-0 sm:flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {/* Stake */}
        <div className={CARD}>
          <div className="mb-1.5 text-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">Stake</div>
          <div className="flex gap-1.5">
            <div className={`flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setStakeDisplay(stakeDisplay - 1)}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input type="number" value={stakeDisplay}
                onChange={(e) => setStakeDisplay(Number(e.target.value) || 0)}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setStakeDisplay(stakeDisplay + 1)}
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
                }`}>{convert(amount).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals })}</button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className={`${CARD} flex items-center gap-2 sm:block`}>
          <div className="flex w-[58px] shrink-0 items-center justify-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:w-auto sm:text-[13px]">Duration</div>
          <div className={`min-w-0 flex-1 ${FIELD}`}>
            <button type="button" onClick={() => setDuration(Math.max(1, duration - 1))}
              className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
              <Icon name="remove" className="text-[14px] sm:text-[18px]" />
            </button>
            <input type="number" value={duration}
              onChange={(e) => setDuration(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="button" onClick={() => setDuration(Math.min(30, duration + 1))}
              className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
              <Icon name="add" className="text-[14px] sm:text-[18px]" />
            </button>
            <span className="px-2 text-[11px] font-black text-slate-500 sm:px-3 sm:text-[12px]">ticks</span>
          </div>
        </div>

        {/* Barrier — Higher/Lower only */}
        {needsBarrier && (
          <div className={`${CARD} flex items-center gap-2 sm:block`}>
            <div className="flex w-[72px] shrink-0 items-center justify-center text-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:w-auto sm:text-[13px]">
              Barrier offset
            </div>
            <div className={`min-w-0 flex-1 ${FIELD}`}>
              <button type="button" onClick={() => setBarrierOffset(clampOffset(barrierOffset - offsetStep))}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="remove" className="text-[14px] sm:text-[18px]" />
              </button>
              <input type="number" value={barrierOffset}
                onChange={(e) => setBarrierOffset(clampOffset(Number(e.target.value)))}
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-black text-white outline-none [appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" onClick={() => setBarrierOffset(clampOffset(barrierOffset + offsetStep))}
                className="grid h-6 w-7 place-items-center text-slate-300 hover:text-white sm:h-9 sm:w-10">
                <Icon name="add" className="text-[14px] sm:text-[18px]" />
            </button>
            </div>
            <div className="hidden items-center justify-between text-[12px] sm:mt-2 sm:flex">
              <span className="font-bold text-slate-400">Barrier</span>
              <span className="font-mono font-black text-amber-300">{formatSpot(barrier)}</span>
            </div>
            <div className="hidden items-center justify-between text-[10px] sm:mt-1 sm:flex">
              <span className="font-medium text-slate-500">Range</span>
              <span className="font-mono font-bold text-slate-500">±{maxBarrierOffset.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Payout preview */}
        <div className={`${CARD} grid grid-cols-3 gap-1 text-[10px] sm:block sm:space-y-2.5 sm:text-[13px]`}>
          {sides.map((side) => (
            <div key={side} className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
              <span className="block truncate font-bold text-slate-400 sm:inline">{sideLabel(side)}</span>
              <span className="block truncate font-black text-white sm:inline">{format(payoutFor(side))}</span>
            </div>
          ))}
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:border-t sm:border-white/[0.06] sm:bg-transparent sm:p-0 sm:pt-2">
            <span className="block truncate font-bold text-slate-400 sm:inline">Spot</span>
            <span className="block truncate font-mono font-black text-sky-300 sm:inline">{formatSpot(latestSpot)}</span>
          </div>
        </div>
      </div>

      {openPositions.length > 0 && <ActivePositions positions={openPositions} />}

      {/* Action buttons */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 p-2 pt-1.5 sm:gap-2 sm:pt-2">
        {sides.map((side) => {
          const isRed = RED_SIDES.has(side);
          return (
            <button key={side} type="button" onClick={() => onTrade(side)} disabled={placing}
              className={`flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-center font-black text-white transition active:scale-[0.98] disabled:opacity-50 sm:flex-col sm:gap-0.5 sm:px-3 sm:py-3 ${
                isRed ? "bg-[#e2474b] hover:bg-[#ec5a5e]" : "bg-[#16a085] hover:bg-[#1bb198]"
              }`}>
              <span className="flex items-center gap-1 text-[11px] sm:text-[14px]">
                <Icon name={isRed ? "trending_down" : "trending_up"} className="text-[13px] sm:text-[16px]" />
                {placing ? <LoadingDots /> : sideLabel(side)}
              </span>
              <span className="font-mono text-[9px] leading-none text-white/85 sm:text-[12px]">{format(payoutFor(side))}</span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// Deriv-style mobile trade surface for directional contracts: a side toggle
// (Rise|Fall, Higher|Lower, Touch|No Touch) over tappable Duration / Barrier /
// Stake cards, and one full-width Buy button with the live payout. Shown only
// below sm; the desktop dual-button layout lives in DirectionalPanel.
function MobileDirectional({
  currency, sides, selectedSide, onArmSide,
  stake, setStake, duration, setDuration,
  durationUnit, setDurationUnit, secPerTick,
  barrierOffset, setBarrierOffset, maxBarrierOffset, needsBarrier, barrier, latestSpot, offsetStep,
  stakePresets, minStake, payoutFor, format, formatSpot,
  onTrade, placing, openPositions,
}: {
  currency: string;
  sides: DirSide[];
  selectedSide: DirSide;
  onArmSide: (s: DirSide) => void;
  stake: number; setStake: (v: number) => void;
  duration: number; setDuration: (v: number) => void;
  durationUnit: "ticks" | "seconds"; setDurationUnit: (v: "ticks" | "seconds") => void;
  secPerTick: number;
  barrierOffset: number; setBarrierOffset: (v: number) => void;
  maxBarrierOffset: number;
  needsBarrier: boolean;
  barrier: number;
  latestSpot: number;
  offsetStep: number;
  stakePresets: number[];
  minStake: number;
  payoutFor: (side: DirSide) => number;
  format: (v: number) => string;
  formatSpot: (v: number) => string;
  onTrade: (side: DirSide) => void;
  placing: boolean;
  openPositions: { id: string; side: DirSide; settlesAt: number }[];
}) {
  const armedRed = RED_SIDES.has(selectedSide);
  const { convert, currency: cc } = useCurrency();
  const stakeShown = convert(stake).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals });
  const [picker, setPicker] = useState<null | "duration" | "stake" | "barrier" | "allow">(null);
  // Collapsed by default: the cards sit in a row where the last peeks off the
  // right edge (Deriv); the grab handle expands to full-width stacks.
  const [expanded, setExpanded] = useState(false);
  const fieldCard = "flex flex-col items-start rounded-xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  // Deriv shows the barrier as a signed offset from spot (e.g. "+0.00", "-1.28").
  const barrierLabel = `${barrierOffset >= 0 ? "+" : ""}${barrierOffset.toFixed(2)}`;
  const durationLabel = durationUnit === "seconds" ? `${duration * secPerTick} sec` : `${duration} ${duration === 1 ? "tick" : "ticks"}`;
  const cards = [
    { key: "duration", label: "Duration", value: durationLabel, accent: "text-white", onClick: () => setPicker("duration") },
    ...(needsBarrier ? [{ key: "barrier", label: "Barrier", value: barrierLabel, accent: "text-amber-300", onClick: () => setPicker("barrier") }] : []),
    { key: "stake", label: "Stake", value: `${stakeShown} ${currency}`, accent: "text-white", onClick: () => setPicker("stake") },
    ...(needsBarrier ? [] : [{ key: "allow", label: "Allow equals", value: "Soon", accent: "text-slate-500", onClick: () => setPicker("allow") }]),
  ];

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
        {/* Side toggle — slim pills (Deriv-style) */}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-[#0f1319] p-1 ring-1 ring-white/[0.06]">
          {sides.map((side) => {
            const active = side === selectedSide;
            const red = RED_SIDES.has(side);
            return (
              <button
                key={side}
                type="button"
                onClick={() => onArmSide(side)}
                className={`flex items-center justify-center rounded-full py-2 text-[13px] font-black transition active:scale-[0.98] ${
                  active ? (red ? "bg-[#e2474b] text-white" : "bg-[#16a085] text-white") : "text-slate-400"
                }`}
              >
                {sideLabel(side)}
              </button>
            );
          })}
        </div>

        {/* Fields: Duration | (Barrier) | Stake — peek row collapsed, stack expanded */}
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
      </div>

      {picker === "duration" && (
        <DurationPickerSheet
          ticks={duration} secPerTick={secPerTick} unit={durationUnit}
          onChange={(t, u) => { setDuration(t); setDurationUnit(u); }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === "stake" && (
        <ValuePickerSheet
          money
          title="Stake" unit={currency} value={stake}
          presets={stakePresets} min={minStake} max={1_000_000}
          onChange={setStake} onClose={() => setPicker(null)}
        />
      )}
      {picker === "barrier" && (
        <BarrierSheet
          latestSpot={latestSpot} offset={barrierOffset} setOffset={setBarrierOffset}
          maxOffset={maxBarrierOffset}
          offsetStep={offsetStep} formatSpot={formatSpot} onClose={() => setPicker(null)}
        />
      )}
      {picker === "allow" && <AllowEqualsSheet onClose={() => setPicker(null)} />}

      {openPositions.length > 0 && <ActivePositions positions={openPositions} />}

      {/* One slim, pill-shaped Buy button (Deriv-style) */}
      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={() => onTrade(selectedSide)}
          disabled={placing}
          className={`flex w-full flex-col items-center justify-center gap-0 rounded-full py-2.5 text-center font-black text-white transition active:scale-[0.98] disabled:opacity-50 ${
            armedRed ? "bg-[#e2474b] active:bg-[#ec5a5e]" : "bg-[#16a085] active:bg-[#1bb198]"
          }`}
        >
          <span className="text-[15px] leading-tight">{placing ? <LoadingDots /> : `Buy ${sideLabel(selectedSide)}`}</span>
          <span className="font-mono text-[11px] leading-tight text-white/85">Payout {format(payoutFor(selectedSide))}</span>
        </button>
      </div>
    </div>
  );
}

// Deriv-style Barrier sheet: pick Above spot / Below spot (signed offset from the
// live spot) or Fixed barrier (absolute price). Internally everything resolves to
// a signed offset (target = spot + offset), so callers are unchanged. Exported so
// the Vanilla panel reuses it for its Strike (same signed-offset model).
export function BarrierSheet({
  title = "Barrier", latestSpot, offset, setOffset, maxOffset, offsetStep, formatSpot, onClose,
}: {
  title?: string;
  latestSpot: number;
  offset: number; setOffset: (v: number) => void;
  maxOffset?: number;   // fair-band cap on |offset| (see DirectionalPanel). Omitted = no cap.
  offsetStep: number;
  formatSpot: (v: number) => string;
  onClose: () => void;
}) {
  type Mode = "above" | "below" | "fixed";
  const [mode, setMode] = useState<Mode>(offset < 0 ? "below" : "above");
  // `amount` means: offset magnitude for above/below, absolute price for fixed.
  const [amount, setAmount] = useState(() => Math.abs(offset) || offsetStep);

  const round = (v: number) => Number(v.toFixed(2));
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    if (m === "fixed") {
      const signed = mode === "below" ? -amount : amount;
      setAmount(round(latestSpot + signed));
    } else if (mode === "fixed") {
      setAmount(round(Math.abs(amount - latestSpot)));
    }
    setMode(m);
  };

  const min = 0;
  // Upper bound on the entered magnitude: for above/below it's the fair band;
  // for a fixed absolute price it's spot ± band.
  const amountMax = maxOffset == null ? Infinity : mode === "fixed" ? latestSpot + maxOffset : maxOffset;
  const amountMin = maxOffset != null && mode === "fixed" ? Math.max(min, latestSpot - maxOffset) : min;
  const step = (dir: 1 | -1) => setAmount((a) => round(Math.min(amountMax, Math.max(amountMin, (a || 0) + dir * offsetStep))));

  const save = () => {
    let signed = mode === "fixed" ? amount - latestSpot : mode === "below" ? -Math.abs(amount) : Math.abs(amount);
    if (maxOffset != null) signed = Math.max(-maxOffset, Math.min(maxOffset, signed));
    setOffset(round(signed));
    onClose();
  };

  const tabs: [Mode, string][] = [["above", "Above spot"], ["below", "Below spot"], ["fixed", "Fixed barrier"]];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-1 pt-2 text-center text-[15px] font-black text-white">{title}</div>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          {tabs.map(([m, label]) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              className={`rounded-xl py-2.5 text-[12px] font-black transition ${mode === m ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="px-4 pt-3">
          <div className="flex items-center rounded-xl bg-[#0f1319] px-1 ring-1 ring-white/[0.06]">
            <button type="button" onClick={() => step(-1)} className="grid h-12 w-12 place-items-center text-slate-300">
              <Icon name="remove" className="text-[18px]" />
            </button>
            <input type="number" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(Math.min(amountMax, Math.max(amountMin, Number(e.target.value) || 0)))}
              className="w-full min-w-0 bg-transparent text-center text-[18px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="button" onClick={() => step(1)} className="grid h-12 w-12 place-items-center text-slate-300">
              <Icon name="add" className="text-[18px]" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="font-bold text-slate-400">Current spot</span>
            <span className="font-mono font-black text-white">{formatSpot(latestSpot)}</span>
          </div>

          <button type="button" onClick={save}
            className="mt-4 w-full rounded-2xl bg-white py-3.5 text-[15px] font-black text-[#16181d] transition active:scale-[0.98]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Deriv-style Allow equals sheet. "Allow equals" lets Rise win on exit ≥ entry
// (and Fall on exit ≤ entry) at a slightly lower payout — it changes the win
// condition, so it's shown for parity but not yet offered (disabled / coming soon).
function AllowEqualsSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-1 pt-2 text-center text-[15px] font-black text-white">Allow equals</div>

        <div className="px-4 pt-4">
          <div className="flex items-center justify-between opacity-50">
            <span className="text-[14px] font-bold text-slate-200">Allow equals</span>
            <span className="relative h-6 w-11 rounded-full bg-[#3a414d]">
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white" />
            </span>
          </div>
          <p className="mt-3 text-center text-[12px] font-medium leading-5 text-slate-500">
            Win when the exit spot is equal to the entry spot, at a lower payout. Coming soon.
          </p>
        </div>

        <div className="px-4 pt-5">
          <button type="button" onClick={onClose}
            className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-black text-[#16181d] transition active:scale-[0.98]">
            Got it
          </button>
        </div>
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
      <div className="flex items-center justify-between rounded-lg bg-[#101722] px-3 py-1.5 ring-1 ring-sky-400/25 sm:py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-black text-sky-200 sm:gap-2 sm:text-[12px]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
          </span>
          {positions.length} active {positions.length === 1 ? "trade" : "trades"}
        </span>
        <span className="font-mono text-[11px] font-black text-white sm:text-[12px]">
          {secondsLeft === 0 ? "Settling…" : `${soonest.side} · ${secondsLeft}s`}
        </span>
      </div>
    </div>
  );
}
