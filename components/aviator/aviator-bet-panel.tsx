"use client";

import { useState, useCallback } from "react";
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

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

export function AviatorBetPanel({
  panelIndex,
  round,
  myBet,
  currentMultiplier,
  balance,
  onBet,
  onCashout,
}: Props) {
  const [amount,      setAmount]      = useState<string>("100");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const state      = round?.state ?? "WAITING";
  const bettingOpen = state === "BETTING";
  const isFlying    = state === "FLYING";
  const isCrashed   = state === "CRASHED";

  const potentialWin = myBet
    ? parseFloat((myBet.betAmount * currentMultiplier).toFixed(2))
    : 0;

  const handleBet = useCallback(async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 10) { setError("Minimum bet is KSh 10"); return; }
    if (amt > balance)           { setError("Insufficient balance"); return; }
    setError(null);
    setLoading(true);
    try {
      const ac = autoEnabled ? parseFloat(autoCashout) : undefined;
      await onBet(amt, panelIndex, ac && ac >= 1.01 ? ac : undefined);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to place bet");
    } finally {
      setLoading(false);
    }
  }, [amount, autoCashout, autoEnabled, balance, onBet, panelIndex]);

  const handleCashout = useCallback(async () => {
    setLoading(true);
    try   { await onCashout(panelIndex); }
    catch (e: unknown) { setError((e as Error).message ?? "Cashout failed"); }
    finally { setLoading(false); }
  }, [onCashout, panelIndex]);

  // ── FLYING + active bet → CASH OUT button ───────────────────────────────
  if (isFlying && myBet?.status === "ACTIVE") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-green-500/30 bg-gradient-to-b from-green-950/30 to-black/40 p-4">
        {myBet.autoCashout && (
          <div className="flex items-center justify-between text-xs text-green-400/70">
            <span>Auto cashout</span>
            <span className="font-mono font-bold">{myBet.autoCashout.toFixed(2)}x</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Your bet</span>
          <span className="font-mono font-semibold text-white">KSh {myBet.betAmount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">Potential win</span>
          <span className="font-mono font-bold text-green-400">
            KSh {potentialWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button
          onClick={handleCashout}
          disabled={loading}
          className="relative mt-1 w-full overflow-hidden rounded-lg bg-green-500 px-4 py-3 text-sm font-black text-black transition-all hover:bg-green-400 disabled:opacity-60"
          style={{ animation: "pulse 1.5s ease-in-out infinite" }}
        >
          <span className="relative z-10">
            {loading ? "Processing…" : `CASH OUT  ${currentMultiplier.toFixed(2)}x`}
          </span>
          <span className="absolute inset-0 animate-ping rounded-lg bg-green-400 opacity-20" />
        </button>
        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ── FLYING + already cashed out ─────────────────────────────────────────
  if (isFlying && myBet?.status === "CASHEDOUT") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-green-500/20 bg-green-950/20 p-4 text-center">
        <span className="text-2xl">✅</span>
        <p className="text-sm font-semibold text-green-400">Cashed out!</p>
        <p className="font-mono text-lg font-black text-white">
          KSh {myBet.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
        </p>
        <p className="text-xs text-white/40">at {myBet.cashoutAt?.toFixed(2)}x</p>
      </div>
    );
  }

  // ── CRASHED outcomes ─────────────────────────────────────────────────────
  if (isCrashed && myBet) {
    const won  = myBet.status === "CASHEDOUT";
    return (
      <div className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center ${
        won
          ? "border-green-500/20 bg-green-950/20"
          : "border-red-500/20 bg-red-950/20"
      }`}>
        <span className="text-2xl">{won ? "🏆" : "💥"}</span>
        <p className={`text-sm font-semibold ${won ? "text-green-400" : "text-red-400"}`}>
          {won ? "You won!" : "Flew away!"}
        </p>
        <p className="font-mono text-lg font-black text-white">
          {won
            ? `KSh ${myBet.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}`
            : `-KSh ${myBet.betAmount.toLocaleString()}`}
        </p>
        {won && <p className="text-xs text-white/40">at {myBet.cashoutAt?.toFixed(2)}x</p>}
      </div>
    );
  }

  // ── BETTING + bet already placed ────────────────────────────────────────
  if (bettingOpen && myBet?.status === "ACTIVE") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-950/20 p-4 text-center">
        <span className="text-2xl">✈️</span>
        <p className="text-sm font-semibold text-yellow-400">Bet confirmed</p>
        <p className="font-mono text-lg font-black text-white">
          KSh {myBet.betAmount.toLocaleString()}
        </p>
        {myBet.autoCashout && (
          <p className="text-xs text-white/50">Auto cashout at {myBet.autoCashout.toFixed(2)}x</p>
        )}
        <p className="mt-1 text-xs text-white/30">Waiting for round to start…</p>
      </div>
    );
  }

  // ── WAITING (no bet yet, between rounds) ────────────────────────────────
  if (state === "WAITING") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
        <p className="text-sm text-white/50">Next round loading…</p>
      </div>
    );
  }

  // ── FLYING + no bet ──────────────────────────────────────────────────────
  if (isFlying && !myBet) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
        <span className="text-2xl">🛫</span>
        <p className="text-sm text-white/40">Round in progress</p>
        <p className="text-xs text-white/25">Place your bet in the next round</p>
      </div>
    );
  }

  // ── BETTING — show bet form ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
      {error && (
        <p className="rounded-md bg-red-900/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      {/* Amount input */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
          Bet Amount (KSh)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            min={10}
            max={50000}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2.5 pl-3 pr-16 font-mono text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
            placeholder="100"
          />
          <button
            onClick={() => setAmount(String(balance))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/40 hover:text-white/70"
          >
            MAX
          </button>
        </div>
        {/* Quick amounts */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/60 transition hover:border-white/30 hover:text-white"
            >
              {q >= 1000 ? `${q / 1000}K` : q}
            </button>
          ))}
        </div>
      </div>

      {/* Auto cashout toggle */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Auto Cashout
          </label>
          <button
            onClick={() => setAutoEnabled((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              autoEnabled ? "bg-green-500" : "bg-white/15"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                autoEnabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {autoEnabled && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={autoCashout}
              min="1.01"
              step="0.01"
              onChange={(e) => setAutoCashout(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 py-2 px-3 font-mono text-sm text-white outline-none focus:border-white/30"
            />
            <span className="shrink-0 text-sm text-white/50">x</span>
          </div>
        )}
      </div>

      {/* BET button */}
      <button
        onClick={handleBet}
        disabled={loading || !bettingOpen}
        className="w-full rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 py-3 text-sm font-black text-black shadow-lg shadow-green-900/30 transition-all hover:from-green-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Placing…" : bettingOpen ? "PLACE BET" : "BETTING CLOSED"}
      </button>

      <p className="text-center text-xs text-white/30">
        Balance: KSh {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
