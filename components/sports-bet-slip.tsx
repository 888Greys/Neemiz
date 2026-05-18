"use client";

import { useState } from "react";
import { useBetslip } from "@/lib/betslip-context";
import { Icon } from "@/components/icon";

export function SportsBetSlip() {
  const { bets, removeBet, clearBets } = useBetslip();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"single" | "multi">("single");

  const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.value || "1"), 1);
  const multiStake = parseFloat(amounts["__multi__"] || "0");
  const multiPayout = multiStake > 0 ? (multiStake * totalOdds).toFixed(2) : null;

  return (
    <div className="flex h-full w-full flex-col bg-[#0d0e11]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-black text-white">Betslip</span>
          {bets.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#087cff] text-[10px] font-black text-white">
              {bets.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/[0.07] px-3 py-1.5">
            <CurrencyIcon />
            <span className="text-[12px] font-black text-slate-400">KSh 0.00</span>
          </div>
          {bets.length > 0 && (
            <button
              type="button"
              onClick={clearBets}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
              aria-label="Clear betslip"
            >
              <Icon name="delete_outline" className="text-[16px]" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs (only when bets exist) ── */}
      {bets.length > 0 && (
        <div className="flex border-b border-white/[0.07]">
          {(["single", "multi"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[12px] font-black transition ${
                tab === t
                  ? "border-b-2 border-[#087cff] text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "single" ? "Single" : `Multi (${bets.length})`}
            </button>
          ))}
        </div>
      )}

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {bets.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05]">
              <Icon name="receipt_long" className="text-[28px] text-slate-600" />
            </span>
            <p className="text-sm font-black text-slate-500">Your betslip is empty</p>
            <p className="mt-1 text-[11px] text-slate-600">Click odds on any match to add a selection</p>
          </div>
        ) : tab === "single" ? (
          /* ── Single bets ── */
          <div className="space-y-2 p-3">
            {bets.map((bet) => {
              const stake = parseFloat(amounts[bet.id] || "0");
              const payout = stake > 0 ? (stake * parseFloat(bet.value)).toFixed(2) : null;
              return (
                <div key={bet.id} className="rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07] p-3">
                  {/* Match + remove */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] text-slate-500">{bet.matchName}</div>
                      <div className="truncate text-[12px] font-black text-white">{bet.market} · {bet.label}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="rounded-lg bg-[#087cff] px-2 py-0.5 text-[13px] font-black text-white">
                        {bet.value}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBet(bet.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-slate-500 transition hover:bg-red-500/15 hover:text-red-400"
                      >
                        <Icon name="close" className="text-[13px]" />
                      </button>
                    </div>
                  </div>

                  {/* Stake input */}
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Stake (KSh)"
                      value={amounts[bet.id] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [bet.id]: e.target.value }))}
                      className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      className="shrink-0 text-[11px] font-black text-[#087cff] transition hover:text-[#4fa8ff]"
                      onClick={() => setAmounts((a) => ({ ...a, [bet.id]: "1000" }))}
                    >
                      All in
                    </button>
                  </div>

                  {payout && (
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Possible win</span>
                      <span className="font-black text-emerald-400">KSh {payout}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Multi bet ── */
          <div className="p-3 space-y-2">
            {bets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between rounded-xl bg-[#16171d] px-3 py-2.5 ring-1 ring-white/[0.06]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] text-slate-500">{bet.matchName}</div>
                  <div className="truncate text-[11px] font-black text-white">{bet.label}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[12px] font-black text-[#087cff]">{bet.value}</span>
                  <button type="button" onClick={() => removeBet(bet.id)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-slate-500 hover:text-red-400"
                  >
                    <Icon name="close" className="text-[11px]" />
                  </button>
                </div>
              </div>
            ))}

            <div className="mt-3 rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07] p-3">
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Total odds</span>
                <span className="font-black text-white">{totalOdds.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Stake (KSh)"
                  value={amounts["__multi__"] ?? ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, __multi__: e.target.value }))}
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-slate-600"
                />
                <button type="button" className="shrink-0 text-[11px] font-black text-[#087cff]"
                  onClick={() => setAmounts((a) => ({ ...a, __multi__: "1000" }))}
                >
                  All in
                </button>
              </div>
              {multiPayout && (
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Possible win</span>
                  <span className="font-black text-emerald-400">KSh {multiPayout}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Place bet button ── */}
      {bets.length > 0 && (
        <div className="border-t border-white/[0.07] p-3">
          <button
            type="button"
            className="w-full rounded-2xl bg-[#06c96e] py-3.5 text-sm font-black text-white shadow-[0_4px_14px_rgba(6,201,110,.3)] transition hover:bg-[#05b85f] active:scale-[.98]"
          >
            Place {bets.length === 1 ? "Bet" : `${bets.length} Bets`}
          </button>
        </div>
      )}
    </div>
  );
}

function CurrencyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#64748b" strokeWidth="1.5" />
      <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="900" fill="#64748b">
        KSh
      </text>
    </svg>
  );
}
