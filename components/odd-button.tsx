"use client";

import { useBetslip, type BetSelection } from "@/lib/betslip-context";

type Props = {
  bet: BetSelection;
};

export function OddButton({ bet }: Props) {
  const { toggleBet, hasBet } = useBetslip();
  const active = hasBet(bet.id);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleBet(bet); }}
      className={`group flex flex-1 items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 transition ${
        active
          ? "bg-[#087cff] ring-1 ring-[#087cff]/50"
          : "bg-white/[0.06] hover:bg-[#087cff]/15"
      }`}
    >
      <span className={`text-[11px] font-bold ${active ? "text-white" : "text-slate-400 group-hover:text-[#087cff]"}`}>
        {bet.label}
      </span>
      <span className={`text-[13px] font-black ${active ? "text-white" : "text-emerald-400 group-hover:text-[#087cff]"}`}>
        {bet.value}
      </span>
    </button>
  );
}
