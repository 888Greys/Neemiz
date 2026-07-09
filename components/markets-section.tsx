"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { BettingMarket } from "@/lib/theoddsapi";
import { useBetslip } from "@/lib/betslip-context";

type TabKey = "main" | "totals" | "handicap" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "main", label: "Main" },
  { key: "totals", label: "Over/Under" },
  { key: "handicap", label: "Handicap" },
  { key: "all", label: "All" },
];

/** Odds API market ids from buildMarketsFromEvent: 1=FTR, 2=Handicap, 3=O/U, 4=BTTS */
function filterMarkets(markets: BettingMarket[], tab: TabKey): BettingMarket[] {
  switch (tab) {
    case "main":
      return markets.filter(
        (m) =>
          m.id === 1 ||
          m.id === 4 ||
          m.id === 101 ||
          /full time|result|double chance|btts|both teams/i.test(m.name),
      );
    case "totals":
      return markets.filter((m) => m.id === 3 || /over\/under|total/i.test(m.name));
    case "handicap":
      return markets.filter((m) => m.id === 2 || /handicap|spread/i.test(m.name));
    case "all":
      return markets;
  }
}

/** Fair double-chance from 1X2 when book only gave h2h. */
function deriveDoubleChance(market: BettingMarket): BettingMarket | null {
  if (market.id !== 1 && !/full time|result/i.test(market.name)) return null;
  const o1 = parseFloat(market.odds.find((o) => o.label === "1")?.value ?? "");
  const ox = parseFloat(market.odds.find((o) => o.label === "X")?.value ?? "");
  const o2 = parseFloat(market.odds.find((o) => o.label === "2")?.value ?? "");
  if (!(o1 > 1 && ox > 1 && o2 > 1)) return null;
  const p1 = 1 / o1;
  const px = 1 / ox;
  const p2 = 1 / o2;
  const sum = p1 + px + p2;
  const n1 = p1 / sum;
  const nx = px / sum;
  const n2 = p2 / sum;
  const price = (p: number) => Math.max(1.01, 1 / p).toFixed(2);
  return {
    id: 101,
    name: "Double Chance",
    odds: [
      { label: "1 OR X", value: price(n1 + nx) },
      { label: "X OR 2", value: price(nx + n2) },
      { label: "1 OR 2", value: price(n1 + n2) },
    ],
  };
}

type MarketsSectionProps = {
  markets: BettingMarket[];
  fixtureId: number;
  matchName: string;
  homeName?: string;
  awayName?: string;
};

export function MarketsSection({
  markets,
  fixtureId,
  matchName,
  homeName,
  awayName,
}: MarketsSectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("main");

  const enriched = useMemo(() => {
    const out = [...markets];
    const ftr = markets.find((m) => m.id === 1) ?? markets.find((m) => /full time|result/i.test(m.name));
    if (ftr && !markets.some((m) => /double chance/i.test(m.name))) {
      const dc = deriveDoubleChance(ftr);
      if (dc) out.splice(1, 0, dc);
    }
    return out;
  }, [markets]);

  const visible = filterMarkets(enriched, activeTab);

  return (
    <div className="bg-[#151518]">
      {/* Market tabs — flat, sticky under scoreboard */}
      <div className="sticky top-[120px] z-10 flex gap-1 overflow-x-auto no-scrollbar border-b border-white/[0.06] bg-[#151518]/95 px-3 py-2 backdrop-blur-md sm:top-[128px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-[12px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 ${
              activeTab === t.key
                ? "bg-[#087cff] text-white"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {visible.length === 0 && (
          <p className="py-12 text-center text-[13px] font-medium text-slate-500">No markets in this tab</p>
        )}
        {visible.map((market) => (
          <MarketBlock
            key={`${market.id}-${market.name}`}
            market={market}
            fixtureId={fixtureId}
            matchName={matchName}
            homeName={homeName}
            awayName={awayName}
          />
        ))}
      </div>
    </div>
  );
}

function MarketBlock({
  market,
  fixtureId,
  matchName,
  homeName,
  awayName,
}: {
  market: BettingMarket;
  fixtureId: number;
  matchName: string;
  homeName?: string;
  awayName?: string;
}) {
  const [open, setOpen] = useState(true);
  const isOU =
    market.id === 3 ||
    market.odds.some((o) => /over|under/i.test(o.label) && o.extra);
  const isHandicap =
    market.id === 2 ||
    (!isOU && market.odds.some((o) => o.extra && /^-?\d/.test(o.extra)));

  return (
    <section className="border-b border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/50 focus-visible:ring-inset sm:px-4"
      >
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
          {market.name}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-slate-600" />
        ) : (
          <ChevronDown size={16} className="text-slate-600" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3.5 sm:px-4">
          {isOU ? (
            <OUMarket odds={market.odds} marketName={market.name} fixtureId={fixtureId} matchName={matchName} />
          ) : isHandicap ? (
            <HandicapMarket
              odds={market.odds}
              marketName={market.name}
              fixtureId={fixtureId}
              matchName={matchName}
              homeName={homeName}
              awayName={awayName}
            />
          ) : (
            <SimpleMarket
              odds={market.odds}
              marketName={market.name}
              fixtureId={fixtureId}
              matchName={matchName}
              homeName={homeName}
              awayName={awayName}
            />
          )}
        </div>
      )}
    </section>
  );
}

function OddBtn({
  label,
  value,
  marketName,
  fixtureId,
  matchName,
  oddKey,
}: {
  label: string;
  value: string;
  marketName: string;
  fixtureId: number;
  matchName: string;
  oddKey: string;
}) {
  const { toggleBet, hasBet } = useBetslip();
  const id = `${fixtureId}-${marketName}-${oddKey}`.replace(/\s+/g, "_");
  const active = hasBet(id);

  return (
    <button
      type="button"
      onClick={() =>
        toggleBet({ id, matchName, market: marketName, label, value })
      }
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2.5 transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/50 ${
        active
          ? "bg-[#087cff] text-white shadow-md shadow-[#087cff]/25"
          : "bg-white/[0.04] text-white hover:bg-white/[0.07]"
      }`}
    >
      <span
        className={`max-w-full truncate text-[9px] font-bold uppercase tracking-wide ${
          active ? "text-white/80" : "text-slate-400"
        }`}
      >
        {label}
      </span>
      <span className="text-[15px] font-black tabular-nums leading-none">{value}</span>
    </button>
  );
}

function labelForOutcome(
  label: string,
  homeName?: string,
  awayName?: string,
): string {
  if (label === "1" && homeName) return homeName;
  if (label === "2" && awayName) return awayName;
  if (label === "X") return "DRAW";
  return label;
}

function SimpleMarket({
  odds,
  marketName,
  fixtureId,
  matchName,
  homeName,
  awayName,
}: {
  odds: BettingMarket["odds"];
  marketName: string;
  fixtureId: number;
  matchName: string;
  homeName?: string;
  awayName?: string;
}) {
  const cols = odds.length === 2 ? "grid-cols-2" : odds.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3";
  return (
    <div className={`grid gap-1 ${cols}`}>
      {odds.slice(0, 12).map((o, i) => {
        const display = labelForOutcome(o.label, homeName, awayName);
        return (
          <OddBtn
            key={`${o.label}-${o.extra ?? i}`}
            label={display}
            value={o.value}
            marketName={marketName}
            fixtureId={fixtureId}
            matchName={matchName}
            oddKey={`${o.label}-${o.extra ?? ""}`}
          />
        );
      })}
    </div>
  );
}

function OUMarket({
  odds,
  marketName,
  fixtureId,
  matchName,
}: {
  odds: BettingMarket["odds"];
  marketName: string;
  fixtureId: number;
  matchName: string;
}) {
  const lines = new Map<string, { over?: string; under?: string }>();
  for (const o of odds) {
    const line = o.extra ?? "";
    const entry = lines.get(line) ?? {};
    if (/^over$/i.test(o.label)) entry.over = o.value;
    if (/^under$/i.test(o.label)) entry.under = o.value;
    lines.set(line, entry);
  }

  const entries = Array.from(lines.entries()).slice(0, 10);
  if (entries.length === 0) {
    return (
      <SimpleMarket odds={odds} marketName={marketName} fixtureId={fixtureId} matchName={matchName} />
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([line, { over, under }]) => (
        <div key={line} className="grid grid-cols-2 gap-1">
          {over && (
            <OddBtn
              label={`OVER ${line}`}
              value={over}
              marketName={marketName}
              fixtureId={fixtureId}
              matchName={matchName}
              oddKey={`Over-${line}`}
            />
          )}
          {under && (
            <OddBtn
              label={`UNDER ${line}`}
              value={under}
              marketName={marketName}
              fixtureId={fixtureId}
              matchName={matchName}
              oddKey={`Under-${line}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function HandicapMarket({
  odds,
  marketName,
  fixtureId,
  matchName,
  homeName,
  awayName,
}: {
  odds: BettingMarket["odds"];
  marketName: string;
  fixtureId: number;
  matchName: string;
  homeName?: string;
  awayName?: string;
}) {
  // Group by absolute line so home/away sit on one row
  const byLine = new Map<string, { home?: { label: string; value: string; extra?: string }; away?: { label: string; value: string; extra?: string } }>();
  for (const o of odds) {
    const line = o.extra ?? "";
    const abs = line.replace(/^\+/, "");
    const entry = byLine.get(abs) ?? {};
    if (o.label === "1") entry.home = o;
    else if (o.label === "2") entry.away = o;
    else {
      // fallback bucket
      if (!entry.home) entry.home = o;
      else entry.away = o;
    }
    byLine.set(abs, entry);
  }

  const rows = Array.from(byLine.entries()).slice(0, 8);
  if (rows.length === 0) {
    return (
      <SimpleMarket
        odds={odds}
        marketName={marketName}
        fixtureId={fixtureId}
        matchName={matchName}
        homeName={homeName}
        awayName={awayName}
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(([line, { home, away }]) => (
        <div key={line} className="grid grid-cols-2 gap-1">
          {home && (
            <OddBtn
              label={`${homeName ?? "1"} ${home.extra ?? line}`}
              value={home.value}
              marketName={marketName}
              fixtureId={fixtureId}
              matchName={matchName}
              oddKey={`1-${home.extra ?? line}`}
            />
          )}
          {away && (
            <OddBtn
              label={`${awayName ?? "2"} ${away.extra ?? line}`}
              value={away.value}
              marketName={marketName}
              fixtureId={fixtureId}
              matchName={matchName}
              oddKey={`2-${away.extra ?? line}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
