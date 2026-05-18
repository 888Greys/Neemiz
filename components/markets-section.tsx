"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { BettingMarket, MarketOdd } from "@/lib/sportmonks";
import { useBetslip } from "@/lib/betslip-context";

const MAIN_IDS = new Set([1, 2, 80, 14, 6, 31, 56, 7, 10, 28]);
const TOTAL_IDS = new Set([80, 28, 53, 20, 21, 7, 27, 81, 105, 107]);
const HANDICAP_IDS = new Set([6, 56, 26, 32, 94, 96, 104, 106]);
const GOALS_IDS = new Set([14, 15, 16, 57, 93, 11, 247, 13, 82, 83, 84, 85, 86, 87, 88, 98, 99]);

const TABS = [
  { key: "main",     label: "Main" },
  { key: "quick",    label: "Quick ⚡" },
  { key: "total",    label: "Total" },
  { key: "handicap", label: "Handicap" },
  { key: "goals",    label: "Goals/Score" },
  { key: "all",      label: "All" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function filterMarkets(markets: BettingMarket[], tab: TabKey): BettingMarket[] {
  switch (tab) {
    case "main":     return markets.filter((m) => MAIN_IDS.has(m.id));
    case "quick":    return markets.slice(0, 5);
    case "total":    return markets.filter((m) => TOTAL_IDS.has(m.id));
    case "handicap": return markets.filter((m) => HANDICAP_IDS.has(m.id));
    case "goals":    return markets.filter((m) => GOALS_IDS.has(m.id));
    case "all":      return markets;
  }
}

type MarketsSectionProps = {
  markets: BettingMarket[];
  fixtureId: number;
  matchName: string;
};

export function MarketsSection({ markets, fixtureId, matchName }: MarketsSectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const visible = filterMarkets(markets, activeTab);

  return (
    <div className="overflow-hidden rounded-2xl bg-[#16171d] ring-1 ring-white/[0.07]">
      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.07] px-3 py-2.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-[12px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#16171d] ${
              activeTab === t.key
                ? "bg-[#087cff] text-white"
                : "bg-white/[0.07] text-slate-400 hover:bg-white/[0.12] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Markets */}
      <div className="divide-y divide-white/[0.06]">
        {visible.length === 0 && (
          <p className="py-10 text-center text-[13px] text-slate-500">No markets available</p>
        )}
        {visible.map((market) => (
          <MarketBlock key={market.id} market={market} fixtureId={fixtureId} matchName={matchName} />
        ))}
      </div>
    </div>
  );
}

type MarketBlockProps = {
  market: BettingMarket;
  fixtureId: number;
  matchName: string;
};

function MarketBlock({ market, fixtureId, matchName }: MarketBlockProps) {
  const [open, setOpen] = useState(true);
  const isOUMarket = market.odds.some((o) => o.extra && (o.label === "Over" || o.label === "Under"));
  const isHandicapMarket = market.odds.some((o) => o.extra && o.extra.match(/^-?\d/));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset"
      >
        <span className="text-[13px] font-black text-white">{market.name}</span>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      <div className={`overflow-hidden transition-all duration-200 ease-out ${open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-3 pb-3">
          {isOUMarket ? (
            <OUMarket odds={market.odds} marketName={market.name} fixtureId={fixtureId} matchName={matchName} />
          ) : isHandicapMarket ? (
            <HandicapMarket odds={market.odds} marketName={market.name} fixtureId={fixtureId} matchName={matchName} />
          ) : (
            <SimpleMarket odds={market.odds} marketName={market.name} fixtureId={fixtureId} matchName={matchName} />
          )}
        </div>
      </div>
    </div>
  );
}

type OddPillProps = {
  label: string;
  value: string;
  extra?: string;
  marketName: string;
  fixtureId: number;
  matchName: string;
};

function OddPill({ label, value, extra, marketName, fixtureId, matchName }: OddPillProps) {
  const { toggleBet, hasBet } = useBetslip();
  const id = `${fixtureId}-${marketName}-${label}-${extra ?? ""}`.replace(/\s+/g, "_");
  const active = hasBet(id);
  const displayLabel = extra ? `${label} ${extra}` : label;

  return (
    <button
      type="button"
      onClick={() => toggleBet({ id, matchName, market: marketName, label: displayLabel, value })}
      className={`group flex items-center justify-between gap-1 rounded-xl px-2.5 py-2 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/50 ${
        active
          ? "bg-[#087cff] ring-1 ring-[#087cff]/50"
          : "bg-white/[0.07] hover:bg-[#087cff]/15"
      }`}
    >
      <span className={`truncate text-[11px] font-bold ${active ? "text-white" : "text-slate-400 group-hover:text-[#087cff]"}`}>
        {displayLabel}
      </span>
      <span className={`shrink-0 text-[13px] font-black ${active ? "text-white" : "text-emerald-400 group-hover:text-[#087cff]"}`}>
        {value}
      </span>
    </button>
  );
}

type MarketInnerProps = {
  odds: BettingMarket["odds"];
  marketName: string;
  fixtureId: number;
  matchName: string;
};

function SimpleMarket({ odds, marketName, fixtureId, matchName }: MarketInnerProps) {
  return (
    <div className={`grid gap-1.5 ${odds.length === 2 ? "grid-cols-2" : odds.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
      {odds.slice(0, 9).map((o, i) => (
        <OddPill key={i} label={o.label} value={o.value} marketName={marketName} fixtureId={fixtureId} matchName={matchName} />
      ))}
    </div>
  );
}

function OUMarket({ odds, marketName, fixtureId, matchName }: MarketInnerProps) {
  const lines = new Map<string, { over?: string; under?: string }>();
  for (const o of odds) {
    const line = o.extra ?? "";
    const entry = lines.get(line) ?? {};
    if (o.label === "Over") entry.over = o.value;
    if (o.label === "Under") entry.under = o.value;
    lines.set(line, entry);
  }

  return (
    <div className="space-y-1.5">
      {Array.from(lines.entries()).slice(0, 8).map(([line, { over, under }]) => (
        <div key={line} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          {under ? <OddPill label="Under" value={under} extra={line} marketName={marketName} fixtureId={fixtureId} matchName={matchName} /> : <div />}
          <span className="text-center text-[11px] font-black text-slate-500 tabular-nums">{line}</span>
          {over ? <OddPill label="Over" value={over} extra={line} marketName={marketName} fixtureId={fixtureId} matchName={matchName} /> : <div />}
        </div>
      ))}
    </div>
  );
}

function HandicapMarket({ odds, marketName, fixtureId, matchName }: MarketInnerProps) {
  const groups = new Map<string, BettingMarket["odds"]>();
  for (const o of odds) {
    const key = o.extra ?? "";
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }

  return (
    <div className="space-y-1.5">
      {Array.from(groups.entries()).slice(0, 8).map(([line, group]) => (
        <div key={line} className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 text-center text-[11px] font-black text-slate-500">{line}</span>
          <div className={`grid flex-1 gap-1.5 ${group.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {group.map((o: MarketOdd, i: number) => (
              <OddPill key={i} label={o.label} value={o.value} extra={o.extra} marketName={marketName} fixtureId={fixtureId} matchName={matchName} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
