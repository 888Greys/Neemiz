"use client";

import Image from "next/image";
import type { PolymarketMarket } from "@/lib/polymarket";

interface Props {
  market:  PolymarketMarket;
  onBet:   (market: PolymarketMarket, outcome?: string) => void;
  onSelect?: (market: PolymarketMarket) => void;
  active?: boolean;
}

export function formatMarketMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatEndDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getBinaryPrices(outcomes: string[], prices: number[]) {
  const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx  = outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesP   = yesIdx >= 0 ? prices[yesIdx] : prices[0];
  const noP    = noIdx  >= 0 ? prices[noIdx]  : prices[1] ?? (1 - yesP);
  const yesLabel = yesIdx >= 0 ? outcomes[yesIdx] : outcomes[0] ?? "Yes";
  const noLabel = noIdx >= 0 ? outcomes[noIdx] : outcomes[1] ?? "No";

  return {
    yes: { label: yesLabel, price: Math.max(0.01, yesP || 0.5) },
    no: { label: noLabel, price: Math.max(0.01, noP || 0.5) },
  };
}

function PriceBar({ outcomes, prices, onPick }: { outcomes: string[]; prices: number[]; onPick: (outcome: string) => void }) {
  const binary = getBinaryPrices(outcomes, prices);

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); onPick(binary.yes.label); }}
        className="h-9 rounded-md bg-emerald-500/15 px-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25"
      >
        Yes <span className="font-mono text-white">{(binary.yes.price * 100).toFixed(0)}%</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onPick(binary.no.label); }}
        className="h-9 rounded-md bg-red-500/15 px-3 text-sm font-bold text-red-300 transition hover:bg-red-500/25"
      >
        No <span className="font-mono text-white">{(binary.no.price * 100).toFixed(0)}%</span>
      </button>
    </div>
  );
}

export function MarketCard({ market, onBet, onSelect, active }: Props) {
  const volumeStr = formatMarketMoney(market.volume);
  const liquidityStr = formatMarketMoney(market.liquidity);
  const leader = market.outcomePrices.reduce(
    (best, price, index) => price > best.price ? { price, label: market.outcomes[index] ?? "Outcome" } : best,
    { price: 0, label: "Outcome" }
  );

  return (
    <button
      onClick={() => onSelect?.(market)}
      className={`group flex min-h-[178px] flex-col rounded-lg border p-4 text-left transition ${
        active
          ? "border-sky-400/40 bg-[#17202a]"
          : "border-white/10 bg-[#171d21] hover:border-white/20 hover:bg-[#1b2328]"
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        {market.image && (
          <Image
            src={market.image}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 shrink-0 rounded-md object-cover"
          />
        )}
        <p className="min-h-10 flex-1 text-[15px] font-bold leading-snug text-white line-clamp-2">
          {market.question}
        </p>
      </div>

      <div className="mb-3 flex min-h-5 flex-wrap gap-1">
        {market.tags.length > 0 ? (
          market.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
              {t}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-500">Market</span>
        )}
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <span className="truncate font-semibold text-slate-200">{leader.label}</span>
        <span className="font-mono font-black text-white">{(leader.price * 100).toFixed(0)}%</span>
      </div>

      <PriceBar outcomes={market.outcomes} prices={market.outcomePrices} onPick={(outcome) => onBet(market, outcome)} />

      <div className="mt-auto flex items-center justify-between pt-3 text-[12px] font-semibold text-slate-500">
        <span>{volumeStr} Vol.</span>
        <span>{liquidityStr} Liq.</span>
        <span>{formatEndDate(market.endDate)}</span>
      </div>
    </button>
  );
}
