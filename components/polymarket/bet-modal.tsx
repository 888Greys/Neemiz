"use client";

import { useState } from "react";
import type { PolymarketMarket } from "@/lib/polymarket";

interface Props {
  market:  PolymarketMarket;
  initialOutcome?: string;
  initialAmount?: number;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK = [50, 100, 250, 500, 1000];

export function BetModal({ market, initialOutcome, initialAmount, balance, onClose, onSuccess }: Props) {
  const [outcome,  setOutcome]  = useState<string>(initialOutcome && market.outcomes.includes(initialOutcome) ? initialOutcome : market.outcomes[0]);
  const [amount,   setAmount]   = useState(String(initialAmount ?? 100));
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const outcomeIdx = market.outcomes.findIndex((o) => o === outcome);
  const price      = market.outcomePrices[outcomeIdx] ?? 0.5;
  const stake      = parseFloat(amount) || 0;
  const potentialWin = stake > 0 ? parseFloat((stake / price).toFixed(2)) : 0;
  const profit       = potentialWin - stake;

  async function handleBet() {
    if (stake < 10)     { setError("Minimum bet is $10"); return; }
    if (stake > balance){ setError("Insufficient balance");  return; }
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/polymarket/bet", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ conditionId: market.conditionId, outcome, stake }),
        signal:  controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to place bet");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).name === "AbortError" ? "Bet request timed out. Please try again." : (e as Error).message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d0d] p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug text-white line-clamp-3">
            {market.question}
          </p>
          <button onClick={onClose} className="shrink-0 text-white/40 hover:text-white">✕</button>
        </div>

        {/* YES / NO toggle */}
        <div className="mb-4 flex gap-2">
          {market.outcomes.map((o, i) => {
            const isYes    = o.toLowerCase() === "yes";
            const selected = outcome === o;
            const p        = market.outcomePrices[i] ?? 0.5;
            return (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-3 transition ${
                  selected
                    ? isYes
                      ? "border-[#31c45d] bg-[#31c45d]/20"
                      : "border-red-500 bg-red-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <span className={`text-sm font-black ${selected ? (isYes ? "text-[#31c45d]" : "text-red-400") : "text-white/60"}`}>{o}</span>
                <span className="font-mono text-xs text-white/50">{(p * 100).toFixed(0)}% · {(1/p).toFixed(2)}x</span>
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
            Stake ($)
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              min={10}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              className="w-full rounded-lg border border-white/10 bg-black/30 py-2.5 pl-3 pr-16 font-mono text-sm text-white outline-none focus:border-white/30"
            />
            <button
              onClick={() => setAmount(String(Math.floor(balance)))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/40 hover:text-white/70"
            >
              MAX
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60 hover:border-white/20 hover:text-white"
              >
                {q >= 1000 ? `${q/1000}K` : q}
              </button>
            ))}
          </div>
        </div>

        {/* Payout preview */}
        {stake > 0 && (
          <div className="mb-4 rounded-lg border border-white/5 bg-white/5 p-3 text-xs">
            <div className="flex justify-between text-white/50">
              <span>Stake</span>
              <span className="font-mono text-white">$ {stake.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex justify-between text-white/50">
              <span>Odds</span>
              <span className="font-mono text-white">{(1/price).toFixed(2)}x</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold">
              <span className="text-white/60">Potential win</span>
              <span className="font-mono text-[#31c45d]">$ {potentialWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Profit</span>
              <span className="font-mono text-[#31c45d]/70">+$ {profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {error && <p className="mb-3 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</p>}

        <button
          onClick={handleBet}
          disabled={loading || stake < 10}
          className="w-full rounded-lg bg-[#087cff] py-3 text-sm font-black text-white transition hover:bg-[#0068d9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Placing…" : `Bet ${outcome} · $${stake > 0 ? stake.toLocaleString() : "—"}`}
        </button>

        <p className="mt-2 text-center text-xs text-white/30">
          Balance: $ {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
