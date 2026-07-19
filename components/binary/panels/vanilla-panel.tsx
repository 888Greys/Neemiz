"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StakeAmountField } from "@/components/binary/stake-amount-field";
import { DraftNumberField } from "@/components/binary/draft-number-field";
import { ValuePickerSheet, DurationPickerSheet } from "./digit-panel";
import { BarrierSheet } from "./directional-panel";
import { useCurrency } from "@/lib/currency-context";
import type { DirectionalSide } from "@/lib/directional";

type DirSide = DirectionalSide;

const CARD = "rounded-lg bg-[#181b22] p-1.5 sm:p-3";

function clampStrikeOffset(v: number): number {
  return Math.round((v || 0) * 100) / 100;
}

// Vanilla options (Call/Put). Unlike the fixed-payout directional contracts, the
// payout is proportional: the stake buys a number of contracts, each paying out
// per in-the-money point at expiry (capped). Settlement is server-authoritative.
export function VanillaPanel({
  currency, sides,
  stake, setStake,
  duration, setDuration, secPerTick,
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
  secPerTick: number;
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
  const { convert, toKes, currency: cc } = useCurrency();
  const offsetStep = Math.max(0.01, Math.round(latestSpot * 0.0003 * 100) / 100);
  const strike = latestSpot + strikeOffset;

  // Mobile uses Deriv's single-CTA model: a Call/Put toggle + one Buy button.
  const [armedSide, setArmedSide] = useState<DirSide>(sides[0]);
  const selectedSide = sides.includes(armedSide) ? armedSide : sides[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Mobile: Deriv-style single-CTA surface (hidden on sm+) ── */}
      <MobileVanilla
        currency={currency}
        sides={sides}
        selectedSide={selectedSide}
        onArmSide={setArmedSide}
        stake={stake} setStake={setStake}
        duration={duration} setDuration={setDuration} secPerTick={secPerTick}
        strikeOffset={strikeOffset} setStrikeOffset={setStrikeOffset}
        strike={strike}
        latestSpot={latestSpot}
        offsetStep={offsetStep}
        stakePresets={stakePresets} minStake={minStake}
        payoutPerPointFor={payoutPerPointFor} maxPayout={maxPayout}
        format={format} formatSpot={formatSpot}
        onTrade={onTrade} placing={placing} openPositions={openPositions}
      />

      {/* ── Desktop (sm+): existing dual-button layout, untouched ── */}
      <div className="hidden sm:flex sm:h-full sm:min-h-0 sm:flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {/* Stake */}
        <div className={CARD}>
          <div className="mb-1 text-center text-[10px] font-bold text-slate-300 sm:mb-2.5 sm:text-[13px] sm:text-slate-200">Stake</div>
          <StakeAmountField
            stakeKes={stake}
            setStakeKes={setStake}
            minStakeKes={minStake}
            unit={currency}
            toDisplay={convert}
            toKes={toKes}
          />
          <div className="mt-1 grid grid-cols-6 gap-1">
            {stakePresets.map((amount) => (
              <button key={amount} type="button" onClick={() => setStake(amount)}
                className={`rounded-md py-0.5 text-[10px] font-black transition sm:py-1.5 sm:text-[11px] ${
                  stake === amount ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                }`}>{convert(amount).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals })}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:block sm:space-y-1.5">
          {/* Duration */}
          <div className={`${CARD} sm:block`}>
            <div className="mb-1 text-center text-[10px] font-bold text-slate-400 sm:mb-2.5 sm:text-[13px] sm:text-slate-200">Duration</div>
            <DraftNumberField
              value={duration}
              onCommit={setDuration}
              integer
              step={1}
              emptyValue={1}
              clamp={(n) => Math.min(30, Math.max(1, Math.round(n)))}
              decreaseLabel="Decrease duration"
              increaseLabel="Increase duration"
              inputClassName="text-[13px] sm:text-[15px]"
            />
          </div>

          {/* Strike (offset from spot; 0 = at-the-money) */}
          <div className={`${CARD} sm:block`}>
            <div className="mb-1 text-center text-[10px] font-bold text-slate-400 sm:mb-2.5 sm:text-[13px] sm:text-slate-200">Strike offset</div>
            <DraftNumberField
              value={strikeOffset}
              onCommit={setStrikeOffset}
              signed
              step={offsetStep}
              emptyValue={0}
              clamp={clampStrikeOffset}
              decreaseLabel="Decrease strike offset"
              increaseLabel="Increase strike offset"
              inputClassName="text-[13px] sm:text-[15px]"
            />
            <div className="hidden items-center justify-between text-[12px] sm:mt-2 sm:flex">
              <span className="font-bold text-slate-400">Strike</span>
              <span className="font-mono font-black text-amber-300">{formatSpot(strike)}</span>
            </div>
          </div>
        </div>

        {/* Payout preview — max first; /pt is secondary detail */}
        <div className={`${CARD} grid grid-cols-2 gap-1 text-[10px] sm:block sm:space-y-2 sm:text-[13px]`}>
          <div className="col-span-2 min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-300 sm:inline">Max payout</span>
            <span className="block truncate font-black text-emerald-300 sm:text-[15px] sm:inline">{format(maxPayout)}</span>
          </div>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-400 sm:inline">Strike</span>
            <span className="block truncate font-mono font-black text-amber-300 sm:inline">{formatSpot(strike)}</span>
          </div>
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
            <span className="block truncate font-bold text-slate-400 sm:inline">Spot</span>
            <span className="block truncate font-mono font-black text-sky-300 sm:inline">{formatSpot(latestSpot)}</span>
          </div>
          {sides.map((side) => (
            <div key={side} className="min-w-0 rounded-md bg-[#0f1319]/40 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:border-t sm:border-white/[0.04] sm:bg-transparent sm:p-0 sm:pt-1.5">
              <span className="block truncate font-bold text-slate-500 sm:inline sm:text-[12px]">{side}/pt</span>
              <span className="block truncate font-mono font-bold text-slate-400 sm:inline sm:text-[12px]">{format(payoutPerPointFor(side))}</span>
            </div>
          ))}
        </div>
      </div>

      {openPositions.length > 0 && <ActivePositions positions={openPositions} />}

      {/* Action buttons — max payout is the hero money figure; /pt is detail */}
      <div className="shrink-0 space-y-1 p-2 pt-1.5 sm:pt-2">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {sides.map((side) => {
            const isPut = side === "PUT";
            return (
              <button key={side} type="button" onClick={() => onTrade(side)} aria-busy={placing}
                className={`flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-center font-black leading-none text-white transition active:scale-[0.98] disabled:opacity-50 sm:flex-col sm:gap-0.5 sm:px-3 sm:py-3 ${
                  isPut ? "bg-[#e2474b] hover:bg-[#ec5a5e]" : "bg-[#16a085] hover:bg-[#1bb198]"
                }`}>
                <span className="flex items-center gap-1 text-[11px] leading-none sm:text-[14px]">
                  <Icon name={isPut ? "trending_down" : "trending_up"} className="text-[13px] sm:text-[16px]" />
                  {side}
                </span>
                <span className="font-mono text-[10px] leading-none text-white sm:mt-0.5 sm:text-[13px]">
                  max {format(maxPayout)}
                </span>
                <span className="hidden font-mono text-[10px] font-bold leading-none text-white/55 sm:mt-0.5 sm:block">
                  {format(payoutPerPointFor(side))}/pt
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-0.5 text-center text-[10px] font-medium leading-snug text-slate-500 sm:text-[11px]">
          Payout scales with points ITM, up to max
        </p>
      </div>
      </div>
    </div>
  );
}

// Deriv-style mobile trade surface for vanilla options: a Call/Put toggle over
// tappable Duration / Strike / Stake cards, and one full-width Buy button with
// max payout as the primary figure (/pt as secondary detail). Shown only below sm.
function MobileVanilla({
  currency, sides, selectedSide, onArmSide,
  stake, setStake, duration, setDuration, secPerTick,
  strikeOffset, setStrikeOffset, strike, latestSpot, offsetStep,
  stakePresets, minStake, payoutPerPointFor, maxPayout,
  format, formatSpot, onTrade, placing, openPositions,
}: {
  currency: string;
  sides: DirSide[];
  selectedSide: DirSide;
  onArmSide: (s: DirSide) => void;
  stake: number; setStake: (v: number) => void;
  duration: number; setDuration: (v: number) => void;
  secPerTick: number;
  strikeOffset: number; setStrikeOffset: (v: number) => void;
  strike: number;
  latestSpot: number;
  offsetStep: number;
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
  const armedPut = selectedSide === "PUT";
  const { convert, currency: cc } = useCurrency();
  const stakeShown = convert(stake).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals });
  const [picker, setPicker] = useState<null | "duration" | "stake" | "strike">(null);
  // Collapsed by default: the 3 cards sit in a row where the 3rd peeks off the
  // right edge (Deriv). The grab handle expands to full-width stacked cards.
  const [expanded, setExpanded] = useState(false);
  const fieldCard = "flex flex-col items-start rounded-xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  // Deriv shows the strike as a signed offset from spot (e.g. "+0.00", "-1.28").
  const strikeLabel = `${strikeOffset >= 0 ? "+" : ""}${strikeOffset.toFixed(2)}`;
  // Call/Put is offered in time units only (Deriv has no Ticks tab here).
  const cards = [
    { key: "duration", label: "Duration", value: `${duration * secPerTick} sec`, accent: "text-white", onClick: () => setPicker("duration") },
    { key: "strike", label: "Strike", value: strikeLabel, accent: "text-amber-300", onClick: () => setPicker("strike") },
    { key: "stake", label: "Stake", value: `${stakeShown} ${currency}`, accent: "text-white", onClick: () => setPicker("stake") },
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
        {/* Call/Put toggle — slim pills (Deriv-style) */}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-[#0f1319] p-1 ring-1 ring-white/[0.06]">
          {sides.map((side) => {
            const active = side === selectedSide;
            const put = side === "PUT";
            return (
              <button
                key={side}
                type="button"
                onClick={() => onArmSide(side)}
                className={`flex items-center justify-center rounded-full py-2 text-[13px] font-black transition active:scale-[0.98] ${
                  active ? (put ? "bg-[#e2474b] text-white" : "bg-[#16a085] text-white") : "text-slate-400"
                }`}
              >
                {side}
              </button>
            );
          })}
        </div>

        {/* Fields: Duration | Strike | Stake — peek row collapsed, stack expanded */}
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

        <div className="space-y-1 px-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-bold text-slate-300">Max payout</span>
            <span className="font-black text-emerald-300">{format(maxPayout)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-500">{selectedSide}/pt</span>
            <span className="font-mono font-bold text-slate-400">{format(payoutPerPointFor(selectedSide))}</span>
          </div>
        </div>
      </div>

      {picker === "duration" && (
        <DurationPickerSheet
          ticks={duration} secPerTick={secPerTick} unit="seconds" allowTicks={false}
          onChange={(t) => setDuration(t)} onClose={() => setPicker(null)}
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
      {picker === "strike" && (
        <BarrierSheet
          title="Strike" latestSpot={latestSpot} offset={strikeOffset} setOffset={setStrikeOffset}
          offsetStep={offsetStep} formatSpot={formatSpot} onClose={() => setPicker(null)}
        />
      )}

      {openPositions.length > 0 && <ActivePositions positions={openPositions} />}

      {/* One slim, pill-shaped Buy button — max payout primary, /pt detail */}
      <div className="space-y-1 px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={() => onTrade(selectedSide)}
          aria-busy={placing}
          className={`flex w-full flex-col items-center justify-center gap-0 rounded-full py-2.5 text-center font-black text-white transition active:scale-[0.98] disabled:opacity-50 ${
            armedPut ? "bg-[#e2474b] active:bg-[#ec5a5e]" : "bg-[#16a085] active:bg-[#1bb198]"
          }`}
        >
          <span className="text-[15px] leading-tight">{`Buy ${selectedSide}`}</span>
          <span className="font-mono text-[12px] leading-tight text-white">max {format(maxPayout)}</span>
          <span className="font-mono text-[10px] font-bold leading-tight text-white/55">
            {format(payoutPerPointFor(selectedSide))}/pt
          </span>
        </button>
        <p className="text-center text-[10px] font-medium leading-snug text-slate-500">
          Payout scales with points ITM, up to max
        </p>
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
