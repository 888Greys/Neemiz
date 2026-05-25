"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { AviatorRound, AviatorBetPublic } from "@/lib/aviator/types";

interface Props {
  panelIndex:        0 | 1;
  round:             AviatorRound | null;
  myBet:             AviatorBetPublic | undefined;
  currentMultiplier: number;
  balance:           number;
  onBet:             (amount: number, panelIndex: 0 | 1, autoCashout?: number) => Promise<void>;
  onCashout:         (panelIndex: 0 | 1) => Promise<void>;
}

const MULT_CHIPS = [{ label: "½×", fn: (v: number) => v * 0.5 }, { label: "2×", fn: (v: number) => v * 2 }, { label: "5×", fn: (v: number) => v * 5 }];

function snapStep(v: number) {
  if (v < 100)  return 10;
  if (v < 500)  return 25;
  if (v < 2000) return 100;
  return 500;
}

export function AviatorBetPanel({
  panelIndex, round, myBet, currentMultiplier, balance, onBet, onCashout,
}: Props) {
  const [tab,          setTab]          = useState<"bet" | "auto">("bet");
  const [amount,       setAmount]       = useState<number>(100);
  const [autoCashout,  setAutoCashout]  = useState<number>(2.00);
  const [acEnabled,    setAcEnabled]    = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Auto-bet
  const [autoBetOn,    setAutoBetOn]    = useState(false);
  const [stopOnWin,    setStopOnWin]    = useState(false);
  const [stopOnLoss,   setStopOnLoss]   = useState(false);
  const [autoBetRounds,setAutoBetRounds]= useState(0);

  // Refs for stale-closure-safe effects
  const autoBetRef     = useRef(false);
  const amountRef      = useRef(amount);
  const acEnabledRef   = useRef(false);
  const autoCashoutRef = useRef(autoCashout);
  const stopWinRef     = useRef(false);
  const stopLossRef    = useRef(false);
  const myBetRef       = useRef<AviatorBetPublic | undefined>(undefined);
  const prevStateRef   = useRef<string | undefined>(undefined);

  useEffect(() => { autoBetRef.current     = autoBetOn;    }, [autoBetOn]);
  useEffect(() => { amountRef.current      = amount;       }, [amount]);
  useEffect(() => { acEnabledRef.current   = acEnabled;    }, [acEnabled]);
  useEffect(() => { autoCashoutRef.current = autoCashout;  }, [autoCashout]);
  useEffect(() => { stopWinRef.current     = stopOnWin;    }, [stopOnWin]);
  useEffect(() => { stopLossRef.current    = stopOnLoss;   }, [stopOnLoss]);
  useEffect(() => { myBetRef.current       = myBet;        }, [myBet]);
  useEffect(() => {
    if (round?.state !== "FLYING" || myBet?.status !== "ACTIVE") setLoading(false);
  }, [myBet?.status, round?.state]);

  const state       = round?.state ?? "WAITING";
  const bettingOpen = state === "BETTING";
  const isFlying    = state === "FLYING";
  const isCrashed   = state === "CRASHED";
  const potWin      = myBet ? +(myBet.betAmount * currentMultiplier).toFixed(2) : 0;

  // ── Amount helpers ─────────────────────────────────────────────────────────
  const clampAmt = (v: number) => Math.max(10, Math.min(50000, Math.round(v)));
  const adj = (delta: number) => setAmount((v) => clampAmt(v + delta));

  // ── Place bet ──────────────────────────────────────────────────────────────
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
    if (amount < 10)       { setError("Minimum KSh 10"); return; }
    if (amount > balance)  { setError("Insufficient balance"); return; }
    await placeBet(amount, acEnabled && autoCashout >= 1.01 ? autoCashout : undefined);
  }, [amount, balance, acEnabled, autoCashout, placeBet]);

  const handleCashout = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try   { await onCashout(panelIndex); }
    catch (e: unknown) { setError((e as Error).message ?? "Cashout failed"); }
    finally { setLoading(false); }
  }, [loading, onCashout, panelIndex]);

  // ── Auto-bet engine ────────────────────────────────────────────────────────
  const placeAutoBet = useCallback(async () => {
    const amt = amountRef.current;
    if (amt < 10) { setAutoBetOn(false); return; }
    const ac = acEnabledRef.current && autoCashoutRef.current >= 1.01 ? autoCashoutRef.current : undefined;
    try { await onBet(amt, panelIndex, ac); }
    catch (e: unknown) { setError((e as Error).message ?? "Auto-bet failed"); setAutoBetOn(false); }
  }, [onBet, panelIndex]);

  useEffect(() => {
    const curr = round?.state;
    const prev = prevStateRef.current;
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
  }, [round?.state, placeAutoBet]);

  useEffect(() => {
    if (autoBetOn && round?.state === "BETTING" && !myBet) placeAutoBet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBetOn]);

  useEffect(() => { if (!autoBetOn) setAutoBetRounds(0); }, [autoBetOn]);

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const TabBar = (
    <div className="flex shrink-0 border-b border-white/[0.07]">
      {(["bet", "auto"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
            tab === t
              ? "border-b-2 border-[#087cff] text-[#087cff]"
              : "text-white/30 hover:text-white/60"
          }`}
        >
          {t === "bet" ? "Bet" : "Auto"}
          {t === "auto" && autoBetOn && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#087cff]/20 px-1.5 py-px text-[8px] font-black text-[#087cff]">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#087cff]" />
              ON
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FLYING + active bet → CASHOUT
  // ─────────────────────────────────────────────────────────────────────────
  if (isFlying && myBet?.status === "ACTIVE") {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#f59e0b]/30 bg-gradient-to-b from-[#1a1200] to-[#0d0e12] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col gap-2.5 p-3 sm:p-3.5">
          {myBet.autoCashout && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/40">Auto cashout at</span>
              <span className="font-black text-[#f59e0b]">{myBet.autoCashout.toFixed(2)}×</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/30">Bet</p>
              <p className="font-black text-white">KSh {myBet.betAmount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/30">Win now</p>
              <p className="font-black text-[#31c45d]">
                KSh {potWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <button
            onClick={handleCashout}
            disabled={loading}
            className="relative overflow-hidden rounded-xl py-3.5 text-sm font-black text-black transition-all disabled:opacity-80"
            style={{ background: "linear-gradient(135deg, #f59e0b, #ef8c00)" }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? "CASHING OUT..." : (
                <>
                  CASHOUT
                  <span className="rounded-lg bg-black/20 px-2.5 py-1 text-sm font-black">
                    KSh {potWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </>
              )}
            </span>
            {!loading && <span className="absolute inset-0 animate-ping rounded-xl bg-[#f59e0b] opacity-15" />}
          </button>
          <p className="text-center text-[11px] font-black text-[#f59e0b]">{currentMultiplier.toFixed(2)}×</p>
          {error && <p className="text-center text-xs text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLYING + cashed out
  // ─────────────────────────────────────────────────────────────────────────
  if (isFlying && myBet?.status === "CASHEDOUT") {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#31c45d]/20 bg-[#0a1a0f] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col items-center gap-2 p-5 text-center">
          <p className="text-sm font-black text-[#31c45d]">Cashed out!</p>
          <p className="text-xl font-black text-white">KSh {myBet.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}</p>
          <p className="text-xs text-white/30">at {myBet.cashoutAt?.toFixed(2)}×</p>
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
        <div className="flex flex-col items-center gap-2 p-5 text-center">
          <p className={`text-sm font-black ${won ? "text-[#31c45d]" : "text-red-400"}`}>{won ? "You won!" : "Flew away!"}</p>
          <p className="text-xl font-black text-white">
            {won ? `KSh ${myBet.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}` : `-KSh ${myBet.betAmount.toLocaleString()}`}
          </p>
          {won && <p className="text-xs text-white/30">at {myBet.cashoutAt?.toFixed(2)}×</p>}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BETTING + confirmed
  // ─────────────────────────────────────────────────────────────────────────
  if (bettingOpen && myBet?.status === "ACTIVE") {
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-yellow-500/20 bg-[#1a1500] sm:rounded-2xl">
        {TabBar}
        <div className="flex flex-col items-center gap-2 p-5 text-center">
          <p className="text-sm font-black text-yellow-400">Bet confirmed</p>
          <p className="text-xl font-black text-white">KSh {myBet.betAmount.toLocaleString()}</p>
          {myBet.autoCashout && <p className="text-xs text-white/40">Auto cashout at {myBet.autoCashout.toFixed(2)}×</p>}
          <p className="mt-1 text-[10px] text-white/25">Waiting for launch…</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAITING / FLYING (no bet) / CRASHED (no bet)
  // ─────────────────────────────────────────────────────────────────────────
  if (state === "WAITING" || (isFlying && !myBet) || (isCrashed && !myBet)) {
    const label = state === "WAITING" ? "Next round loading…"
      : isFlying  ? "Round in progress"
      : `Ended at ${round?.crashPoint?.toFixed(2)}×`;
    return (
      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0e12]">
        {TabBar}
        <div className="flex flex-col items-center gap-2.5 p-4 text-center sm:p-5">
          {state === "WAITING" && <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/50" />}
          <p className="text-sm text-white/40">{label}</p>
        </div>
        {/* Still show auto-bet controls */}
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
  // BETTING — main form (Bet tab or Auto tab)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d0e12] sm:rounded-2xl">
      {TabBar}

      {tab === "bet" ? (
        <div className="flex flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
          {error && <p className="rounded-lg bg-red-900/30 px-3 py-2 text-[11px] text-red-400">{error}</p>}

          {/* Amount row */}
          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">Bet Amount (KSh)</p>
            <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
              <button
                onClick={() => adj(-snapStep(amount))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-lg font-black text-white/60 hover:bg-white/[0.1] hover:text-white"
              >−</button>
              <input
                type="number"
                value={amount}
                min={10} max={50000}
                onChange={(e) => { setAmount(clampAmt(Number(e.target.value))); setError(null); }}
                className="min-w-0 rounded-xl border border-white/[0.08] bg-black/40 py-2.5 text-center font-mono text-base font-black text-white outline-none focus:border-[#087cff]/50"
              />
              <button
                onClick={() => adj(snapStep(amount))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-lg font-black text-white/60 hover:bg-white/[0.1] hover:text-white"
              >+</button>
            </div>
            {/* Multiplier chips */}
            <div className="mt-2 flex gap-1.5">
              {MULT_CHIPS.map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => setAmount(clampAmt(fn(amount)))}
                  className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.04] py-1.5 text-[10px] font-black text-white/50 hover:border-white/20 hover:text-white"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setAmount(clampAmt(balance))}
                className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.04] py-1.5 text-[10px] font-black text-white/50 hover:border-white/20 hover:text-white"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Auto-cashout */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <label className="flex items-center gap-2 text-[11px] font-black text-white/50">
              Auto Cashout
              {acEnabled && (
                <span className="rounded-full border border-[#31c45d]/30 bg-[#31c45d]/10 px-1.5 py-px text-[9px] text-[#31c45d]">
                  at {autoCashout.toFixed(2)}×
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              {acEnabled && (
                <input
                  type="number"
                  value={autoCashout}
                  min="1.01" step="0.01"
                  onChange={(e) => setAutoCashout(parseFloat(e.target.value) || 1.01)}
                  className="w-20 rounded-lg border border-white/[0.08] bg-black/30 py-1 text-center font-mono text-xs text-white outline-none focus:border-[#087cff]/50"
                />
              )}
              <button
                onClick={() => setAcEnabled((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${acEnabled ? "bg-[#31c45d]" : "bg-white/15"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${acEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          {/* BET button */}
          <button
            onClick={handleBet}
            disabled={loading || !bettingOpen}
            className="w-full rounded-xl py-3.5 text-sm font-black text-black shadow-[0_10px_30px_rgba(34,197,94,.16)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: bettingOpen ? "linear-gradient(135deg, #31c45d, #22a34a)" : "#1f2937" }}
          >
            {loading ? "Placing…" : bettingOpen
              ? `BET  KSh ${amount.toLocaleString()}`
              : "BETTING CLOSED"}
          </button>

          <p className="text-center text-[10px] text-white/25">
            Balance: KSh {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      ) : (
        /* ── Auto tab ─────────────────────────────────────────────────── */
        <div className="flex flex-col gap-3 p-4">
          {/* Auto-cashout config in Auto tab */}
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
                  className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black transition-colors ${autoCashout === v && acEnabled ? "border-[#087cff]/50 bg-[#087cff]/10 text-[#087cff]" : "border-white/[0.07] bg-white/[0.04] text-white/40 hover:text-white"}`}
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
    <div className={`mx-4 mb-4 rounded-xl border px-3 py-3 transition-colors ${autoBetOn ? "border-[#087cff]/30 bg-[#087cff]/5" : "border-white/[0.05] bg-white/[0.02]"}`}>
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
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:flex sm:gap-4">
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
