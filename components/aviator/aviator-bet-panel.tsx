"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { AviatorRound, AviatorBetPublic } from "@/lib/aviator/types";
import { LoadingDots } from "@/components/loading-dots";
import { useCurrency } from "@/lib/currency-context";

interface Props {
  panelIndex:        0 | 1;
  round:             AviatorRound | null;
  myBet:             AviatorBetPublic | undefined;
  currentMultiplier: number;
  balance:           number;
  onBet:             (amount: number, panelIndex: 0 | 1, autoCashout?: number) => Promise<void>;
  onCashout:         (panelIndex: 0 | 1) => Promise<void>;
}

// Quick-amount chips — matches Betika exactly
const QUICK_AMOUNTS = [10, 50, 100, 1_000];
const MIN_BET = 10;

function snapStep(v: number) {
  if (v < 100)  return 10;
  if (v < 500)  return 25;
  if (v < 2000) return 100;
  return 500;
}

function useBettingCountdown(bettingEndsAt: string | null | undefined): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!bettingEndsAt) { setSecs(0); return; }
    const tick = () => {
      const ms = new Date(bettingEndsAt).getTime() - Date.now();
      setSecs(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [bettingEndsAt]);
  return secs;
}

export function AviatorBetPanel({
  panelIndex, round, myBet, currentMultiplier, balance, onBet, onCashout,
}: Props) {
  // Stakes are stored internally in canonical KES (MIN_BET, balance, onBet are
  // all KES). The display currency only changes how amounts are shown and how a
  // typed amount is interpreted — convert at the edges, never the server path.
  const { convert, toKes, currency } = useCurrency();
  // Format a canonical KES amount in the active display currency.
  const money = (kes: number, opts?: Intl.NumberFormatOptions) =>
    `${currency.symbol} ${convert(kes).toLocaleString(currency.locale, opts ?? { maximumFractionDigits: currency.decimals })}`;
  const [tab,           setTab]          = useState<"bet" | "auto">("bet");
  const [amount,        setAmount]       = useState<number>(MIN_BET);
  const [autoCashout,   setAutoCashout]  = useState<number>(2.00);
  const [acEnabled,     setAcEnabled]    = useState(false);
  const [loading,       setLoading]      = useState(false);
  const [error,         setError]        = useState<string | null>(null);
  const [nextBet,       setNextBet]      = useState<{ amount: number; autoCashout?: number } | null>(null);

  // Auto-bet
  const [autoBetOn,     setAutoBetOn]    = useState(false);
  const [stopOnWin,     setStopOnWin]    = useState(false);
  const [stopOnLoss,    setStopOnLoss]   = useState(false);
  const [autoBetRounds, setAutoBetRounds]= useState(0);

  // Refs for stale-closure-safe effects
  const autoBetRef     = useRef(false);
  const amountRef      = useRef(amount);
  const acEnabledRef   = useRef(false);
  const autoCashoutRef = useRef(autoCashout);
  const stopWinRef     = useRef(false);
  const stopLossRef    = useRef(false);
  const myBetRef       = useRef<AviatorBetPublic | undefined>(undefined);
  const nextBetRef     = useRef<{ amount: number; autoCashout?: number } | null>(null);
  const prevStateRef   = useRef<string | undefined>(undefined);

  useEffect(() => { autoBetRef.current     = autoBetOn;    }, [autoBetOn]);
  useEffect(() => { amountRef.current      = amount;       }, [amount]);
  useEffect(() => { acEnabledRef.current   = acEnabled;    }, [acEnabled]);
  useEffect(() => { autoCashoutRef.current = autoCashout;  }, [autoCashout]);
  useEffect(() => { stopWinRef.current     = stopOnWin;    }, [stopOnWin]);
  useEffect(() => { stopLossRef.current    = stopOnLoss;   }, [stopOnLoss]);
  useEffect(() => { myBetRef.current       = myBet;        }, [myBet]);
  useEffect(() => { nextBetRef.current     = nextBet;      }, [nextBet]);
  useEffect(() => {
    if (round?.state !== "FLYING" || myBet?.status !== "ACTIVE") setLoading(false);
  }, [myBet?.status, round?.state]);

  useEffect(() => {
    if (round?.state === "BETTING") setError(null);
  }, [round?.state]);

  const state         = round?.state ?? "WAITING";
  const bettingOpen   = state === "BETTING";
  const isFlying      = state === "FLYING";
  const isCrashed     = state === "CRASHED";
  const bettingSecsLeft = useBettingCountdown(bettingOpen ? round?.bettingEndsAt : null);
  const potWin      = myBet ? +(myBet.betAmount + ((myBet.betAmount * currentMultiplier) - myBet.betAmount) * 0.70).toFixed(2) : 0;

  const clampAmt = (v: number) => Math.max(MIN_BET, Math.min(50000, Math.round(v)));
  const adj = (delta: number) => setAmount((v) => clampAmt(v + delta));

  const placeBet = useCallback(async (amt: number, ac?: number) => {
    setError(null);
    setLoading(true);
    try {
      await onBet(amt, panelIndex, ac);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }, [onBet, panelIndex]);

  const handleBet = useCallback(async () => {
    if (amount < MIN_BET) { setError(`Minimum ${money(MIN_BET)}`); return; }
    if (amount > balance) { setError("Insufficient balance"); return; }
    await placeBet(amount, acEnabled && autoCashout >= 1.01 ? autoCashout : undefined);
  }, [amount, balance, acEnabled, autoCashout, placeBet]);

  const handleCashout = useCallback(async () => {
    try   { await onCashout(panelIndex); }
    catch (e: unknown) { setError((e as Error).message ?? "Cashout failed"); }
  }, [onCashout, panelIndex]);

  const placeAutoBet = useCallback(async () => {
    const amt = amountRef.current;
    if (amt < MIN_BET) { setAutoBetOn(false); return; }
    const ac = acEnabledRef.current && autoCashoutRef.current >= 1.01 ? autoCashoutRef.current : undefined;
    try { await onBet(amt, panelIndex, ac); }
    catch (e: unknown) { setError((e as Error).message ?? "Auto-bet failed"); setAutoBetOn(false); }
  }, [onBet, panelIndex]);

  useEffect(() => {
    const curr = round?.state;
    const prev = prevStateRef.current;

    if (curr === "BETTING" && prev !== "BETTING" && !myBetRef.current) {
      const queued = nextBetRef.current;
      if (queued) {
        setNextBet(null);
        placeBet(queued.amount, queued.autoCashout);
        prevStateRef.current = curr;
        return;
      }
    }

    if (autoBetRef.current) {
      if (curr === "BETTING" && prev !== "BETTING" && !myBetRef.current) placeAutoBet();
      if (curr === "CRASHED" && (prev === "FLYING" || prev === "BETTING")) {
        const bet = myBetRef.current;
        if (bet) {
          setAutoBetRounds((n) => n + 1);
          const won  = bet.status === "CASHEDOUT";
          const lost = bet.status === "ACTIVE";
          if ((stopWinRef.current && won) || (stopLossRef.current && lost)) setAutoBetOn(false);
        }
      }
    }
    prevStateRef.current = curr;
  }, [round?.state, placeAutoBet, placeBet]);

  useEffect(() => {
    if (autoBetOn && round?.state === "BETTING" && !myBet) placeAutoBet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBetOn]);

  useEffect(() => { if (!autoBetOn) setAutoBetRounds(0); }, [autoBetOn]);

  // ── Betika-style pill tab bar ──────────────────────────────────────────────
  const TabBar = (
    <div className="mx-auto mb-1 flex w-[170px] shrink-0 rounded-full bg-[#18191f] p-[2px]">
      {(["bet", "auto"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[10px] font-black transition-all ${
            tab === t
              ? "bg-[#333435] text-white shadow-sm"
              : "text-white/45 hover:text-white/70"
          }`}
        >
          {t === "bet" ? "Bet" : "Auto"}
          {t === "auto" && autoBetOn && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#087cff]/30 px-1.5 py-px text-[8px] font-black text-[#087cff]">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#087cff]" />
              ON
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FLYING + active bet → CASHOUT button
  // ─────────────────────────────────────────────────────────────────────────
  if (isFlying && myBet?.status === "ACTIVE") {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#f59e0b]/30 bg-gradient-to-b from-[#1a1200] to-[#0d0e12] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col gap-2 p-2 sm:p-3">
          {myBet.autoCashout && (
            <div className="flex items-center justify-between px-1 text-[11px]">
              <span className="text-white/40">Auto cashout at</span>
              <span className="font-black text-[#f59e0b]">{myBet.autoCashout.toFixed(2)}×</span>
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] items-stretch gap-2">
            {/* Left: bet info */}
            <div className="flex flex-col justify-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-white/35">Staked</span>
                <span className="font-black text-white">{money(myBet.betAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-white/35">Win now</span>
                <span className="font-black text-[#31c45d]">
                  {money(potWin, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            {/* Right: cashout button — tap = instant, no spinner */}
            <button
              onClick={handleCashout}
              className="relative w-[120px] overflow-hidden rounded-xl text-black transition-all active:scale-[0.97]"
              style={{ background: "linear-gradient(160deg, #f5b942, #e08200)" }}
            >
              <p className="text-[11px] font-bold leading-none opacity-80">Cashout</p>
              <p className="mt-0.5 text-[15px] font-black leading-tight">
                {money(potWin, { maximumFractionDigits: 0 })}
              </p>
              <span className="absolute inset-0 animate-ping rounded-xl bg-[#f59e0b] opacity-10" />
            </button>
          </div>
          <p className="text-center text-[11px] font-black text-[#f59e0b]">{currentMultiplier.toFixed(2)}×</p>
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRASHED outcomes
  // ─────────────────────────────────────────────────────────────────────────
  if (isCrashed && myBet) {
    const won = myBet.status === "CASHEDOUT";
    return (
      <div className={`flex min-w-0 flex-col overflow-hidden rounded-xl border sm:rounded-2xl ${won ? "border-[#31c45d]/20 bg-[#0a1a0f]" : "border-red-500/20 bg-[#1a0a0a]"}`}>
        {TabBar}
        <div className="flex flex-col items-center gap-1 p-3 text-center">
          <p className={`text-[13px] font-black ${won ? "text-[#31c45d]" : "text-red-400"}`}>
            {won ? "You won!" : "Flew away!"}
          </p>
          <p className="text-lg font-black text-white">
            {won
              ? (myBet.winAmount != null ? money(myBet.winAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—")
              : `-${money(myBet.betAmount)}`}
          </p>
          {won && <p className="text-[11px] text-white/30">at {myBet.cashoutAt?.toFixed(2)}×</p>}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BETTING + bet already confirmed — waiting for launch
  // ─────────────────────────────────────────────────────────────────────────
  if (bettingOpen && myBet?.status === "ACTIVE") {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-yellow-500/20 bg-[#1a1500] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col items-center gap-0.5 p-2 text-center sm:gap-1 sm:p-3">
          <p className="text-[12px] font-black text-yellow-400 sm:text-[13px]">Bet confirmed</p>
          <p className="text-base font-black text-white sm:text-lg">{money(myBet.betAmount)}</p>
          {myBet.autoCashout && <p className="text-[10px] text-white/40 sm:text-[11px]">Auto cashout at {myBet.autoCashout.toFixed(2)}×</p>}
          <p className="text-[10px] text-white/25">Waiting for launch…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLYING (no bet) + next bet queued → confirmation card
  // ─────────────────────────────────────────────────────────────────────────
  if (isFlying && !myBet && nextBet) {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#087cff]/30 bg-[#060d1c] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col items-center gap-0.5 p-2 text-center sm:gap-1.5 sm:p-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#087cff]/15 text-sm sm:h-8 sm:w-8 sm:text-base">⏳</div>
          <p className="text-[12px] font-black text-[#087cff] sm:text-[13px]">Queued for next round</p>
          <p className="text-base font-black text-white sm:text-lg">{money(nextBet.amount)}</p>
          {nextBet.autoCashout && (
            <p className="text-[10px] text-white/40 sm:text-[11px]">Auto cashout at {nextBet.autoCashout.toFixed(2)}×</p>
          )}
          <button
            onClick={() => setNextBet(null)}
            className="mt-0.5 rounded-lg border border-white/10 px-5 py-0.5 text-[11px] font-black text-white/40 transition-colors hover:border-white/25 hover:text-white/70 sm:py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAITING / CRASHED (no bet) — show disabled form
  // ─────────────────────────────────────────────────────────────────────────
  if (state === "WAITING" || (isCrashed && !myBet)) {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0e12] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col items-center gap-1.5 p-2.5 text-center sm:gap-2.5 sm:p-5">
          {state === "WAITING" && <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-white/50 sm:h-8 sm:w-8" />}
          <p className="text-sm text-white/40">
            {state === "WAITING" ? "Next round loading…" : `Ended at ${round?.crashPoint?.toFixed(2)}×`}
          </p>
        </div>
        <AutoBetSection
          autoBetOn={autoBetOn} setAutoBetOn={setAutoBetOn}
          stopOnWin={stopOnWin} setStopOnWin={setStopOnWin}
          stopOnLoss={stopOnLoss} setStopOnLoss={setStopOnLoss}
          autoBetRounds={autoBetRounds}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BETTING / FLYING (no bet) — main Betika-style form
  // ─────────────────────────────────────────────────────────────────────────
  const queueForNext = () => {
    if (amount < MIN_BET) { setError(`Minimum ${money(MIN_BET)}`); return; }
    if (amount > balance) { setError("Insufficient balance"); return; }
    setError(null);
    setNextBet({ amount, autoCashout: acEnabled && autoCashout >= 1.01 ? autoCashout : undefined });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#18191f] p-2">
      {TabBar}

      {/* Betting countdown banner */}
      {bettingOpen && bettingSecsLeft > 0 && (
        <div className={`mb-1.5 flex items-center justify-between rounded-lg px-3 py-1.5 ${bettingSecsLeft <= 2 ? "bg-red-500/20 ring-1 ring-red-500/40" : "bg-[#1dbb08]/15 ring-1 ring-[#1dbb08]/30"}`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Closing bets in</span>
          <span className={`text-[15px] font-black tabular-nums ${bettingSecsLeft <= 2 ? "text-red-400" : "text-[#1dbb08]"}`}>
            {bettingSecsLeft}s
          </span>
        </div>
      )}

      {tab === "bet" ? (
        <div className="flex flex-col gap-2">
          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-1.5 text-[11px] text-red-400">{error}</p>
          )}

          {/* ── Two-column layout: [amount+chips] | [BET button] ── */}
          <div className="grid h-[90px] grid-cols-[1fr_1.1fr] items-stretch gap-2">

            {/* Left column */}
            <div className="flex min-w-0 flex-col gap-1">
              {/* Amount row: ⊖  value  ⊕ */}
              <div className="flex h-[35px] items-center rounded-md bg-[#151518]">
                <button
                  onClick={() => { adj(-snapStep(amount)); setError(null); }}
                  className="flex h-full w-9 shrink-0 items-center justify-center text-xl font-black text-white/55 transition-colors hover:text-white active:scale-90"
                >−</button>

                <input
                  type="number"
                  value={Number(convert(amount).toFixed(currency.decimals))}
                  min={convert(MIN_BET)} max={convert(50000)}
                  onChange={(e) => { setAmount(clampAmt(toKes(Number(e.target.value)))); setError(null); }}
                  className="min-w-0 flex-1 bg-transparent text-center text-[16px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />

                <button
                  onClick={() => { adj(snapStep(amount)); setError(null); }}
                  className="flex h-full w-9 shrink-0 items-center justify-center text-xl font-black text-white/55 transition-colors hover:text-white active:scale-90"
                >+</button>
              </div>

              {/* Quick chips */}
              <div className="grid flex-1 grid-cols-2 gap-1">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    onClick={() => { setAmount(v); setError(null); }}
                    className={`rounded-md py-1 text-[10px] font-bold transition-colors ${
                      amount === v
                        ? "bg-[#171819] text-white"
                        : "bg-[#171819] text-white/45 hover:text-white"
                    }`}
                  >
                    {convert(v).toLocaleString(currency.locale, { maximumFractionDigits: currency.decimals })}
                  </button>
                ))}
              </div>
            </div>

            {/* Right column: BET / NEXT ROUND button */}
            <button
              onClick={isFlying ? queueForNext : handleBet}
              disabled={loading}
              className="flex min-w-0 flex-col items-center justify-center rounded-[10px] px-2 py-3 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.2)] transition-all active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: (bettingOpen || isFlying) ? "#1dbb08" : "#1f2937" }}
            >
              <span className="text-[24px] font-black uppercase leading-none">
                {loading ? <LoadingDots /> : isFlying ? "Next Round" : "BET"}
              </span>
              <span className="mt-0.5 text-[12px] font-semibold leading-tight">
                {bettingOpen && bettingSecsLeft > 0
                  ? `${money(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${bettingSecsLeft}s`
                  : money(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Auto tab ──────────────────────────────────────────────────── */
        <div className="flex flex-col gap-3 p-3">
          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Auto Cashout at (×)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={autoCashout}
                min="1.01" step="0.01"
                onChange={(e) => setAutoCashout(parseFloat(e.target.value) || 1.01)}
                className="flex-1 rounded-xl border border-white/[0.08] bg-black/30 py-2.5 text-center font-mono text-base font-black text-white outline-none focus:border-[#087cff]/50"
              />
              <span className="text-lg text-white/30">×</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1.5, 2, 3, 5, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => { setAutoCashout(v); setAcEnabled(true); }}
                  className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black transition-colors ${
                    autoCashout === v && acEnabled
                      ? "border-[#087cff]/50 bg-[#087cff]/10 text-[#087cff]"
                      : "border-white/[0.07] bg-white/[0.04] text-white/40 hover:text-white"
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
          </div>

          <AutoBetSection
            autoBetOn={autoBetOn} setAutoBetOn={setAutoBetOn}
            stopOnWin={stopOnWin} setStopOnWin={setStopOnWin}
            stopOnLoss={stopOnLoss} setStopOnLoss={setStopOnLoss}
            autoBetRounds={autoBetRounds}
          />

          <p className="text-center text-[10px] leading-relaxed text-white/20">
            Auto-bet places a bet every round using your current amount &amp; cashout settings.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Auto-bet section ─────────────────────────────────────────────────────────

function AutoBetSection({
  autoBetOn, setAutoBetOn, stopOnWin, setStopOnWin, stopOnLoss, setStopOnLoss, autoBetRounds,
}: {
  autoBetOn: boolean; setAutoBetOn: (v: boolean) => void;
  stopOnWin: boolean; setStopOnWin: (v: boolean) => void;
  stopOnLoss: boolean; setStopOnLoss: (v: boolean) => void;
  autoBetRounds: number;
}) {
  return (
    <div className={`mx-3 mb-3 rounded-xl border px-3 py-3 transition-colors ${autoBetOn ? "border-[#087cff]/30 bg-[#087cff]/5" : "border-white/[0.05] bg-white/[0.02]"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className="text-[11px] font-black text-white/60">Auto Bet</span>
          {autoBetOn && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#087cff]/20 px-2 py-px text-[9px] font-black text-[#087cff]">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#087cff]" />
              {autoBetRounds} round{autoBetRounds !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setAutoBetOn(!autoBetOn)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoBetOn ? "bg-[#087cff]" : "bg-white/15"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoBetOn ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
      <div className="mt-2.5 flex gap-4">
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-white/40">
          <input type="checkbox" checked={stopOnWin} onChange={(e) => setStopOnWin(e.target.checked)} className="h-3 w-3 cursor-pointer accent-green-500" />
          Stop on win
        </label>
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-white/40">
          <input type="checkbox" checked={stopOnLoss} onChange={(e) => setStopOnLoss(e.target.checked)} className="h-3 w-3 cursor-pointer accent-red-500" />
          Stop on loss
        </label>
      </div>
    </div>
  );
}
