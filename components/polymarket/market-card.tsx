"use client";

import Image from "next/image";
import type { PolymarketMarket } from "@/lib/polymarket";

interface Props {
  market:   PolymarketMarket;
  onBet:    (market: PolymarketMarket, outcome?: string) => void;
  onSelect?: (market: PolymarketMarket) => void;
  active?:  boolean;
}

export function formatMarketMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)         return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const USD_KES_RATE = Number(process.env.NEXT_PUBLIC_USD_KES_RATE ?? 129.5);

export function formatMarketMoneyKes(value: number) {
  const kes = value * USD_KES_RATE;
  if (!Number.isFinite(kes) || kes <= 0) return "KSh 0";
  if (kes >= 1_000_000_000) return `KSh ${(kes / 1_000_000_000).toFixed(1)}B`;
  if (kes >= 1_000_000) return `KSh ${(kes / 1_000_000).toFixed(1)}M`;
  if (kes >= 1_000) return `KSh ${(kes / 1_000).toFixed(0)}K`;
  return `KSh ${kes.toFixed(0)}`;
}

export function formatEndDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getBinaryPrices(outcomes: string[], prices: number[]) {
  const yesIdx  = outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx   = outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesP    = yesIdx >= 0 ? prices[yesIdx] : prices[0];
  const noP     = noIdx  >= 0 ? prices[noIdx]  : prices[1] ?? (1 - yesP);
  const yesLabel = yesIdx >= 0 ? outcomes[yesIdx] : outcomes[0] ?? "Yes";
  const noLabel  = noIdx  >= 0 ? outcomes[noIdx]  : outcomes[1] ?? "No";
  return {
    yes: { label: yesLabel, price: Math.max(0.01, yesP || 0.5) },
    no:  { label: noLabel,  price: Math.max(0.01, noP  || 0.5) },
  };
}

export function MarketCard({ market, onBet, onSelect, active }: Props) {
  const binary     = getBinaryPrices(market.outcomes, market.outcomePrices);
  const volumeStr  = `${formatMarketMoney(market.volume)} / ${formatMarketMoneyKes(market.volume)}`;

  return (
    <div
      onClick={() => onSelect?.(market)}
      className={`group flex flex-col overflow-hidden rounded-2xl border transition cursor-pointer ${
        active
          ? "border-[#087cff]/40 bg-[#16171c]"
          : "border-white/[0.07] bg-[#16171c] hover:border-white/[0.14] hover:bg-[#1c1d24]"
      }`}
    >
      {/* Image strip */}
      {market.image && (
        <div className="relative h-32 w-full overflow-hidden">
          <Image
            src={market.image}
            alt=""
            fill
            unoptimized
            className="object-cover transition group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16171c] via-transparent to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Tags */}
        {market.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {market.tags.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-white/35">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Question */}
        <p className="mb-3 flex-1 text-[14px] font-semibold leading-snug text-white/85 line-clamp-2 group-hover:text-white">
          {market.question}
        </p>

        {/* Probability bar */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#31c45d]">{binary.yes.label} {(binary.yes.price * 100).toFixed(0)}%</span>
            <span className="text-red-400">{binary.no.label} {(binary.no.price * 100).toFixed(0)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="rounded-full bg-[#31c45d]" style={{ width: `${Math.min(100, binary.yes.price * 100)}%` }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onBet(market, binary.yes.label); }}
            className="h-9 rounded-xl bg-[#31c45d]/12 text-[13px] font-black text-[#31c45d] transition hover:bg-[#31c45d]/22"
          >
            Buy Yes
            <span className="ml-1 font-mono text-white/70">{(binary.yes.price * 100).toFixed(0)}¢</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onBet(market, binary.no.label); }}
            className="h-9 rounded-xl bg-red-500/12 text-[13px] font-black text-red-400 transition hover:bg-red-500/22"
          >
            Buy No
            <span className="ml-1 font-mono text-white/70">{(binary.no.price * 100).toFixed(0)}¢</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-white/25">
          <span>{volumeStr} vol.</span>
          <span>Ends {formatEndDate(market.endDate)}</span>
        </div>
      </div>
    </div>
  );
}
