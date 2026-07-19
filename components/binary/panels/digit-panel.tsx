"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StakeAmountField } from "@/components/binary/stake-amount-field";
import { DraftNumberField } from "@/components/binary/draft-number-field";
import { useCurrency } from "@/lib/currency-context";

type ContractFamily = "evenOdd" | "matchDiffer" | "overUnder";
type ContractSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";

const CARD = "rounded-lg bg-[#181b22] p-1.5 sm:p-3";
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
  rejectReasonFor,
  lessAvailableDigits,
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
  /** When set, that side is not buyable — show the reason instead of a payout. */
  rejectReasonFor?: (side: ContractSide) => string | null;
  /** Client hint only: digits outside ~8–12% empirical freq look less available. */
  lessAvailableDigits?: Set<number>;
  format: (v: number) => string;
  onTrade: (side: ContractSide) => void;
  placing: boolean;
  openPositions: { id: string; side: ContractSide; settlesAt: number }[];
}) {
  // Stake is canonical KES; show/enter it in the active display currency.
  const { convert, toKes, currency: cc } = useCurrency();
  // Even/Odd is decided purely by the exit digit's parity — no barrier digit.
  const needsTarget = family !== "evenOdd";
  const targetVerb = family === "matchDiffer" ? "Target digit" : "Barrier digit";
  const compactStakeDuration = family === "overUnder";
  const targetDigits = family === "overUnder" ? DIGITS.slice(1, 9) : DIGITS;

  // Mobile uses Deriv's single-CTA model: a side toggle + one Buy button. We
  // track which side is armed locally; if the family (and thus `sides`) changes
  // we fall back to the first side so the toggle never points at a stale value.
  const [armedSide, setArmedSide] = useState<ContractSide>(sides[0]);
  const selectedSide = sides.includes(armedSide) ? armedSide : sides[0];
  const reasonFor = rejectReasonFor ?? (() => null);
  const matchesReason = reasonFor("Matches");
  const payoutLabel = (side: ContractSide) => {
    const reason = reasonFor(side);
    if (reason) return reason;
    const payout = payoutFor(side);
    if (!(payout > 0) && side === "Matches") return "Pricing…";
    return format(payout);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Mobile: Deriv-style single-CTA surface (hidden on sm+, where the
          desktop dual-button layout below takes over) ── */}
      <MobileDerivDigits
        currency={currency}
        sides={sides}
        selectedSide={selectedSide}
        onArmSide={setArmedSide}
        stake={stake} setStake={setStake}
        duration={duration} setDuration={setDuration}
        targetDigit={targetDigit} setTargetDigit={setTargetDigit}
        lastDigit={lastDigit}
        stakePresets={stakePresets}
        minStake={minStake}
        needsTarget={needsTarget}
        targetVerb={targetVerb}
        targetDigits={targetDigits}
        payoutLabel={payoutLabel}
        rejectReasonFor={reasonFor}
        lessAvailableDigits={lessAvailableDigits}
        format={format}
        onTrade={onTrade}
        placing={placing}
        openPositions={openPositions}
      />

      {/* ── Desktop (sm+): existing dual-button layout, untouched ── */}
      <div className="hidden sm:flex sm:h-full sm:min-h-0 sm:flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        <div className={compactStakeDuration ? "grid grid-cols-2 gap-1.5 sm:block sm:space-y-1.5" : "flex flex-col gap-1.5"}>
          {/* Duration */}
          <div className={`${CARD} ${compactStakeDuration ? "sm:flex" : "order-2 flex"} items-center gap-2 sm:block`}>
            <div className={`${compactStakeDuration ? "mb-1 w-auto justify-center text-[10px]" : "w-[58px]"} flex shrink-0 items-center text-[11px] font-bold text-slate-200 sm:mb-2.5 sm:w-auto sm:justify-center sm:text-[13px]`}>
              Duration
            </div>
            <DraftNumberField
              value={duration}
              onCommit={setDuration}
              integer
              step={1}
              emptyValue={3}
              clamp={(n) => Math.min(30, Math.max(3, Math.round(n)))}
              decreaseLabel="Decrease duration"
              increaseLabel="Increase duration"
              inputClassName="text-[13px] sm:text-[15px]"
              trailing={
                !compactStakeDuration ? (
                  <span className="px-2 text-[11px] font-black text-slate-500 sm:px-3 sm:text-[12px]">ticks</span>
                ) : undefined
              }
            />
          </div>

          {/* Stake */}
          <div className={`${CARD} ${compactStakeDuration ? "" : "order-1"}`}>
            <div className={`${compactStakeDuration ? "mb-1 text-[10px]" : "mb-1.5 text-[11px]"} text-center font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]`}>Stake</div>
            <StakeAmountField
              stakeKes={stake}
              setStakeKes={setStake}
              minStakeKes={minStake}
              unit={currency}
              toDisplay={convert}
              toKes={toKes}
            />
            {!compactStakeDuration && (
              <div className="mt-1.5 grid grid-cols-6 gap-1">
                {stakePresets.map((amount) => (
                  <button key={amount} type="button" onClick={() => setStake(amount)}
                    className={`rounded-md py-0.5 text-[10px] font-black transition sm:py-1.5 sm:text-[11px] ${
                      stake === amount ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400 hover:text-white"
                    }`}>
                    {convert(amount).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Target / barrier digit — Matches/Differs & Over/Under only */}
        {needsTarget && (
          <div className={CARD}>
            <div className="mb-2 text-center text-[12px] font-bold text-slate-200 sm:mb-2.5 sm:text-[13px]">{targetVerb}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {targetDigits.map((d) => {
                const active = targetDigit === d;
                const isLast = lastDigit === d;
                const lessAvail = !!lessAvailableDigits?.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTargetDigit(d)}
                    title={lessAvail ? "Less available for Matches" : undefined}
                    className={`relative rounded-md py-1.5 font-mono text-[14px] font-black transition sm:py-2 sm:text-[15px] ${
                      active ? "bg-[#3a414d] text-white ring-1 ring-sky-400/60"
                             : isLast ? "bg-[#2a2410] text-amber-200 ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(245,185,66,0.45)]"
                             : lessAvail ? "bg-[#0f1319] text-slate-600 hover:text-slate-400"
                             : "bg-[#0f1319] text-slate-400 hover:text-white"
                    }`}>
                    {/* Live last digit: the highlight pops onto the current digit each
                        tick (key changes → animation re-fires), so it visibly "moves". */}
                    <span key={isLast ? `l${lastDigit}` : "s"} className={isLast ? "inline-block animate-digit-pop" : undefined}>{d}</span>
                    {isLast && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400" />}
                    {lessAvail && !active && (
                      <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-slate-500/80" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Payout preview */}
        <div className={`${CARD} grid grid-cols-3 gap-1 text-[10px] sm:block sm:space-y-2.5 sm:text-[13px]`}>
          {sides.map((side) => {
            const reason = reasonFor(side);
            return (
              <div key={side} className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:bg-transparent sm:p-0">
                <span className="block truncate font-bold text-slate-400 sm:inline">{actionLabel(side)}</span>
                <span className={`block truncate font-black sm:inline ${reason ? "text-slate-500" : "text-white"}`}>
                  {payoutLabel(side)}
                </span>
              </div>
            );
          })}
          <div className="min-w-0 rounded-md bg-[#0f1319]/60 px-1.5 py-1 sm:flex sm:items-center sm:justify-between sm:border-t sm:border-white/[0.06] sm:bg-transparent sm:p-0 sm:pt-2">
            <span className="block truncate font-bold text-slate-400 sm:inline">Last digit</span>
            <span className="block font-mono font-black text-amber-300 sm:inline">{lastDigit}</span>
          </div>
        </div>

        {/* Calm Matches availability note — never a red Trade-failed toast. */}
        {matchesReason && matchesReason !== "Pricing…" && (
          <p className="px-0.5 text-center text-[11px] font-medium leading-snug text-slate-400">
            {matchesReason}
          </p>
        )}
      </div>

      {/* Live position banner — keeps the in-flight trade visible right where
          the user clicked, so placing a trade has immediate, felt feedback. */}
      {openPositions.length > 0 && <ActivePositions positions={openPositions} format={format} />}

      {/* Action buttons */}
      <div className="grid shrink-0 grid-cols-2 gap-1.5 p-2 pt-1.5 sm:gap-2 sm:pt-2">
        {sides.map((side) => {
          const isRed = RED_SIDES.has(side);
          const reason = reasonFor(side);
          const disabled = !!reason || placing;
          return (
            <button
              key={side}
              type="button"
              onClick={() => onTrade(side)}
              disabled={disabled}
              title={reason ?? undefined}
              aria-busy={placing}
              className={`flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-center font-black text-white transition-transform active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 sm:flex-col sm:gap-0.5 sm:px-3 sm:py-3 ${
                isRed ? "bg-[#e2474b] hover:bg-[#ec5a5e] disabled:hover:bg-[#e2474b]" : "bg-[#16a085] hover:bg-[#1bb198] disabled:hover:bg-[#16a085]"
              }`}
            >
              <span className="flex items-center gap-1 text-[11px] sm:text-[14px]">
                <Icon name={isRed ? "trending_down" : "trending_up"} className="text-[13px] sm:text-[16px]" />
                {actionLabel(side)}
              </span>
              <span className={`font-mono text-[9px] leading-none sm:text-[12px] ${reason ? "text-white/70" : "text-white/85"}`}>
                {payoutLabel(side)}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// Deriv-style mobile trade surface: a side toggle (Even | Odd) over big,
// thumb-friendly Duration / Stake steppers, and one full-width Buy button with
// the live payout on it — mirroring Deriv's mobile app. Shown only below sm;
// the desktop dual-button layout lives in DigitPanel's main return.
function MobileDerivDigits({
  currency, sides, selectedSide, onArmSide,
  stake, setStake, duration, setDuration,
  targetDigit, setTargetDigit, lastDigit,
  stakePresets, minStake, needsTarget, targetVerb, targetDigits,
  payoutLabel, rejectReasonFor, lessAvailableDigits, format, onTrade, placing, openPositions,
}: {
  currency: string;
  sides: ContractSide[];
  selectedSide: ContractSide;
  onArmSide: (s: ContractSide) => void;
  stake: number; setStake: (v: number) => void;
  duration: number; setDuration: (v: number) => void;
  targetDigit: number; setTargetDigit: (v: number) => void;
  lastDigit: number;
  stakePresets: number[];
  minStake: number;
  needsTarget: boolean;
  targetVerb: string;
  targetDigits: number[];
  payoutLabel: (side: ContractSide) => string;
  rejectReasonFor: (side: ContractSide) => string | null;
  lessAvailableDigits?: Set<number>;
  format: (v: number) => string;
  onTrade: (side: ContractSide) => void;
  placing: boolean;
  openPositions: { id: string; side: ContractSide; settlesAt: number }[];
}) {
  const armedRed = RED_SIDES.has(selectedSide);
  const selectedReason = rejectReasonFor(selectedSide);
  const matchesReason = rejectReasonFor("Matches");
  const buyDisabled = !!selectedReason || placing;
  const { convert, currency: cc } = useCurrency();
  const stakeShown = convert(stake).toLocaleString(cc.locale, { maximumFractionDigits: cc.decimals });
  // Which value the bottom-sheet picker is editing (Deriv-style); null = closed.
  const [picker, setPicker] = useState<null | "duration" | "stake">(null);
  // The barrier/target digit grid is collapsed by default to keep the chart big;
  // the header shows the current pick and a chevron to expand it.
  const [gridOpen, setGridOpen] = useState(false);
  // Even/Odd has no target grid, so its grab handle instead expands the
  // Duration/Stake cards from a 2-up row to a full-width stack (Deriv-style).
  const [expanded, setExpanded] = useState(false);
  const handleOpen = needsTarget ? gridOpen : expanded;

  const fieldCard =
    "flex flex-col items-start rounded-xl bg-[#181b22] px-3.5 py-2.5 text-left transition active:scale-[0.99]";

  return (
    <div className="flex h-full min-h-0 flex-col sm:hidden">
      {/* Spacer pushes the control cluster to the bottom, over the chart bg (Deriv) */}
      <div className="min-h-0 flex-1" />

      {/* Centered grab handle (Deriv-style) — for target types it toggles the
          digit grid; for Even/Odd it expands the Duration/Stake cards. */}
      <button
        type="button"
        onClick={() => (needsTarget ? setGridOpen((v) => !v) : setExpanded((v) => !v))}
        aria-label={handleOpen ? "Collapse" : "Expand"}
        className="flex w-full shrink-0 justify-center py-1.5 text-slate-400 active:text-white"
      >
        <Icon name={handleOpen ? "expand_more" : "expand_less"} className="text-[22px]" />
      </button>

      <div className="space-y-2.5 px-3 pb-1">
        {/* Side toggle — text only (no icon), slim pills (Deriv-style) */}
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
                  active
                    ? red
                      ? "bg-[#e2474b] text-white"
                      : "bg-[#16a085] text-white"
                    : "text-slate-400"
                }`}
              >
                {actionLabel(side)}
              </button>
            );
          })}
        </div>

        {/* Expanded barrier/target grid — full-width above the fields (Deriv).
            Collapsed by default; tap the compact field below to expand. */}
        {needsTarget && gridOpen && (
          <div className="rounded-2xl bg-[#181b22] p-3">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[12px] font-bold text-slate-200">{targetVerb}</span>
              <span className="font-mono text-[14px] font-black text-white">{targetDigit}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-5 gap-2">
              {targetDigits.map((d) => {
                const active = targetDigit === d;
                const isLast = lastDigit === d;
                const lessAvail = !!lessAvailableDigits?.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTargetDigit(d)}
                    title={lessAvail ? "Less available for Matches" : undefined}
                    className={`relative rounded-2xl py-2.5 font-mono text-[16px] font-black transition active:scale-95 ${
                      active ? "bg-[#3a414d] text-white ring-1 ring-sky-400/60"
                             : isLast ? "bg-[#2a2410] text-amber-200 ring-2 ring-amber-400/80 shadow-[0_0_16px_rgba(245,185,66,0.5)]"
                             : lessAvail ? "bg-[#0f1319] text-slate-600"
                             : "bg-[#0f1319] text-slate-400"
                    }`}>
                    <span key={isLast ? `l${lastDigit}` : "s"} className={isLast ? "inline-block animate-digit-pop" : undefined}>{d}</span>
                    {isLast && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400" />}
                    {lessAvail && !active && (
                      <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-slate-500/80" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fields row (Deriv): when a barrier digit applies and the grid is
            collapsed, it sits inline as a 3rd card; otherwise just Duration|Stake. */}
        <div className={`grid gap-2.5 ${
          needsTarget ? (gridOpen ? "grid-cols-2" : "grid-cols-3") : (expanded ? "grid-cols-1" : "grid-cols-2")
        }`}>
          {needsTarget && !gridOpen && (
            <button type="button" onClick={() => setGridOpen(true)} className={fieldCard}>
              <span className="truncate text-[11px] font-bold text-slate-400">{targetVerb}</span>
              <span className="mt-0.5 text-[16px] font-black text-white">{targetDigit}</span>
            </button>
          )}
          <button type="button" onClick={() => setPicker("duration")} className={fieldCard}>
            <span className="text-[11px] font-bold text-slate-400">Duration</span>
            <span className="mt-0.5 text-[16px] font-black text-white">{duration} ticks</span>
          </button>
          <button type="button" onClick={() => setPicker("stake")} className={fieldCard}>
            <span className="text-[11px] font-bold text-slate-400">Stake</span>
            <span className="mt-0.5 text-[16px] font-black text-white">{stakeShown} {currency}</span>
          </button>
        </div>

        {matchesReason && matchesReason !== "Pricing…" && selectedSide === "Matches" && (
          <p className="px-1 text-center text-[11px] font-medium leading-snug text-slate-400">
            {matchesReason}
          </p>
        )}
      </div>

      {picker === "duration" && (
        <ValuePickerSheet
          title="Duration" unit="ticks" value={duration}
          presets={[3, 5, 7, 10, 15, 30]} min={3} max={30} integer
          onChange={setDuration} onClose={() => setPicker(null)}
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

      {openPositions.length > 0 && <ActivePositions positions={openPositions} format={format} />}

      {/* One slim, pill-shaped Buy button (Deriv-style), flush above safe area */}
      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={() => onTrade(selectedSide)}
          disabled={buyDisabled}
          title={selectedReason ?? undefined}
          aria-busy={placing}
          className={`flex w-full flex-col items-center justify-center gap-0 rounded-full py-2.5 text-center font-black text-white transition-transform active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${
            armedRed ? "bg-[#e2474b] active:bg-[#ec5a5e]" : "bg-[#16a085] active:bg-[#1bb198]"
          }`}
        >
          <span className="text-[15px] leading-tight">
            {selectedReason ? actionLabel(selectedSide) : `Buy ${actionLabel(selectedSide)}`}
          </span>
          <span className="font-mono text-[11px] leading-tight text-white/85">
            {selectedReason ? selectedReason : `Payout ${payoutLabel(selectedSide)}`}
          </span>
        </button>
      </div>
    </div>
  );
}

// Deriv-style bottom-sheet value picker for Duration / Stake. Two modes: quick
// preset chips (lightning) or a number keypad (keyboard) for a custom value.
// Exported so other panels (Accumulators) reuse the same picker.
export function ValuePickerSheet({
  title, unit, value, presets, min, max, integer, onChange, onClose, footer, money,
}: {
  title: string;
  unit: string;
  value: number;
  presets: number[];
  min: number;
  max: number;
  integer?: boolean;
  onChange: (v: number) => void;
  onClose: () => void;
  footer?: React.ReactNode;
  // When true, `value`/`presets`/`min`/`max`/`onChange` are all canonical KES,
  // but the sheet DISPLAYS them in the active currency and converts the user's
  // typed/picked amount back to KES before calling onChange.
  money?: boolean;
}) {
  const { convert, toKes, currency } = useCurrency();
  const [mode, setMode] = useState<"presets" | "keypad">("presets");
  // Draft holds the displayed (possibly converted) value the user is editing.
  const disp = (kes: number) => (money ? Number(convert(kes).toFixed(currency.decimals)) : kes);
  const [draft, setDraft] = useState(String(disp(value)));

  const clamp = (v: number) => {
    const c = Math.min(max, Math.max(min, v || min));
    return integer ? Math.round(c) : c;
  };
  // Preset values stay KES; keypad drafts are in display units → back to KES.
  const commit = (vKes: number) => { onChange(clamp(vKes)); onClose(); };
  const commitDraft = (shown: number) => commit(money ? toKes(shown) : shown);
  const fmtPreset = (kes: number) => (money ? convert(kes).toLocaleString(currency.locale, { maximumFractionDigits: currency.decimals }) : String(kes));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </div>
        <div className="px-4 pb-1 pt-2 text-center text-[13px] font-black text-white">{title}</div>

        {/* Mode toggle: presets (lightning) vs keypad (keyboard) */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-3 pt-1">
          {([["presets", "bolt"], ["keypad", "keyboard"]] as const).map(([m, icon]) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`grid place-items-center rounded-xl py-2.5 transition ${mode === m ? "bg-[#3a414d] text-white" : "bg-[#0f1319] text-slate-400"}`}>
              <Icon name={icon} className="text-[18px]" />
            </button>
          ))}
        </div>

        {mode === "presets" ? (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {presets.map((p) => {
              const active = p === value;
              return (
                <button key={p} type="button" onClick={() => commit(p)}
                  className={`rounded-xl py-3.5 text-[14px] font-black transition active:scale-95 ${
                    active ? "bg-white text-[#16181d]" : "bg-[#0f1319] text-slate-200"
                  }`}>
                  {fmtPreset(p)} {unit}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="flex items-center rounded-xl bg-[#0f1319] px-3 ring-1 ring-white/[0.06]">
              <input
                autoFocus
                type="number"
                inputMode={integer ? "numeric" : "decimal"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full bg-transparent py-3.5 text-center text-[18px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pl-2 text-[13px] font-black text-slate-500">{unit}</span>
            </div>
            <button type="button" onClick={() => commitDraft(Number(draft))}
              className="mt-3 w-full rounded-full bg-[#16a085] py-3 text-[15px] font-black text-white transition active:scale-[0.98]">
              Confirm
            </button>
          </div>
        )}

        {footer && <div className="border-t border-white/[0.06] px-4 pb-1 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

// Deriv-style duration picker for the options contracts: Ticks and/or Seconds
// tabs. Duration is canonical in ticks; seconds map to ticks via the market's
// tick speed and stay within the server's 1–30 tick cap. `allowTicks={false}`
// hides the Ticks tab (Call/Put, which Deriv offers in time units only).
export function DurationPickerSheet({
  ticks, secPerTick, unit, allowTicks = true, onChange, onClose,
}: {
  ticks: number;
  secPerTick: number;
  unit: "ticks" | "seconds";
  allowTicks?: boolean;
  onChange: (ticks: number, unit: "ticks" | "seconds") => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"ticks" | "seconds">(allowTicks ? unit : "seconds");
  const TICK_PRESETS = [1, 3, 5, 7, 10, 15];
  // Seconds presets that resolve to a valid 1–30 tick duration for this market.
  const secToTicks = (s: number) => Math.min(30, Math.max(1, Math.round(s / secPerTick)));
  const SEC_PRESETS = [5, 10, 15, 20, 30, 60, 120].filter((s) => Math.round(s / secPerTick) <= 30);
  const curSeconds = ticks * secPerTick;

  const tabs: ["ticks" | "seconds", string][] = allowTicks
    ? [["ticks", "Ticks"], ["seconds", "Seconds"]]
    : [["seconds", "Seconds"]];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#16181d] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>

        {/* Unit tabs (Deriv-style) */}
        <div className="flex items-center gap-5 px-4 pt-2 text-[14px] font-black">
          {tabs.map(([t, label]) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`-mb-px border-b-2 pb-2 pt-1 transition ${tab === t ? "border-[#e2474b] text-white" : "border-transparent text-slate-500"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="border-b border-white/[0.06]" />

        {tab === "ticks" ? (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-3">
            {TICK_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => { onChange(p, "ticks"); onClose(); }}
                className={`rounded-xl py-3.5 text-[14px] font-black transition active:scale-95 ${p === ticks ? "bg-white text-[#16181d]" : "bg-[#0f1319] text-slate-200"}`}>
                {p} {p === 1 ? "tick" : "ticks"}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-3">
            {SEC_PRESETS.map((s) => {
              const active = unit === "seconds" && s === curSeconds;
              return (
                <button key={s} type="button" onClick={() => { onChange(secToTicks(s), "seconds"); onClose(); }}
                  className={`rounded-xl py-3.5 text-[14px] font-black transition active:scale-95 ${active ? "bg-white text-[#16181d]" : "bg-[#0f1319] text-slate-200"}`}>
                  {s} sec
                </button>
              );
            })}
          </div>
        )}
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
