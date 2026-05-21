"use client";

import type { PolymarketMarket } from "@/lib/polymarket";

interface Props {
  market:  PolymarketMarket;
  onBet:   (market: PolymarketMarket) => void;
}

function PriceBar({ outcomes, prices }: { outcomes: string[]; prices: number[] }) {
  const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noIdx  = outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesP   = yesIdx >= 0 ? prices[yesIdx] : prices[0];
  const noP    = noIdx  >= 0 ? prices[noIdx]  : prices[1] ?? (1 - yesP);

  return (
    <div className="flex gap-2">
      <button className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-[#31c45d]/30 bg-[#31c45d]/10 px-3 py-2 transition hover:bg-[#31c45d]/20">
        <span className="text-xs font-semibold text-[#31c45d]">YES</span>
        <span className="font-mono text-sm font-black text-white">{(yesP * 100).toFixed(0)}¢</span>
        <span className="text-[10px] text-white/40">{(1 / yesP).toFixed(2)}x</span>
      </button>
      <button className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 transition hover:bg-red-500/20">
        <span className="text-xs font-semibold text-red-400">NO</span>
        <span className="font-mono text-sm font-black text-white">{(noP * 100).toFixed(0)}¢</span>
        <span className="text-[10px] text-white/40">{(1 / noP).toFixed(2)}x</span>
      </button>
    </div>
  );
}

export function MarketCard({ market, onBet }: Props) {
  const volumeStr = market.volume >= 1_000_000
    ? `$${(market.volume / 1_000_000).toFixed(1)}M`
    : market.volume >= 1_000
    ? `$${(market.volume / 1_000).toFixed(0)}K`
    : `$${market.volume.toFixed(0)}`;

  const endsAt = new Date(market.endDate);
  const daysLeft = Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000);
  const endsStr = daysLeft > 1 ? `${daysLeft}d left` : daysLeft === 1 ? "1d left" : "Ends soon";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20">
      {/* Image + question */}
      <div className="flex items-start gap-3">
        {market.image && (
          <img
            src={market.image}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        )}
        <p className="flex-1 text-sm font-semibold leading-snug text-white line-clamp-2">
          {market.question}
        </p>
      </div>

      {/* Tags */}
      {market.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {market.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Price bar */}
      <PriceBar outcomes={market.outcomes} prices={market.outcomePrices} />

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-white/30">
        <span>Vol {volumeStr}</span>
        <span>{endsStr}</span>
      </div>

      {/* Bet button */}
      <button
        onClick={() => onBet(market)}
        className="w-full rounded-lg bg-[#087cff] py-2.5 text-sm font-black text-white transition hover:bg-[#0068d9]"
      >
        Bet
      </button>
    </div>
  );
}
