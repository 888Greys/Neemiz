"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";

type MarketType = "Forex" | "Crypto" | "Commodities";
type Direction = "up" | "down";
type TradeStatus = "active" | "won" | "lost";

type Market = {
  symbol: string;
  name: string;
  type: MarketType;
  price: number;
  change: number;
  payout: number;
  precision: number;
};

type Trade = {
  id: number;
  symbol: string;
  direction: Direction;
  stake: number;
  entry: number;
  expiresAt: number;
  status: TradeStatus;
  exit?: number;
};

const MARKETS: Market[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", type: "Forex", price: 1.0843, change: 0.18, payout: 86, precision: 5 },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", type: "Forex", price: 1.2718, change: -0.12, payout: 84, precision: 5 },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", type: "Forex", price: 156.74, change: 0.31, payout: 82, precision: 3 },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", type: "Forex", price: 0.6651, change: 0.08, payout: 80, precision: 5 },
  { symbol: "BTC/USD", name: "Bitcoin", type: "Crypto", price: 68420.5, change: 1.42, payout: 78, precision: 1 },
  { symbol: "ETH/USD", name: "Ethereum", type: "Crypto", price: 3764.2, change: -0.64, payout: 79, precision: 1 },
  { symbol: "SOL/USD", name: "Solana", type: "Crypto", price: 164.38, change: 2.21, payout: 76, precision: 2 },
  { symbol: "XAU/USD", name: "Gold Spot", type: "Commodities", price: 2349.8, change: 0.44, payout: 81, precision: 2 },
  { symbol: "USOIL", name: "WTI Crude Oil", type: "Commodities", price: 77.36, change: -0.29, payout: 83, precision: 2 },
];

const DURATIONS = [15, 30, 60, 120];
const STAKES = [50, 100, 250, 500, 1000];

function seededSeries(seed: number, base: number) {
  let value = base;
  return Array.from({ length: 72 }, (_, index) => {
    const wave = Math.sin((index + seed) / 5) * 0.38;
    const chop = Math.cos((index * 3 + seed) / 7) * 0.18;
    value += (wave + chop) * (base * 0.00055);
    return {
      x: index,
      y: value,
      open: value - base * 0.00045,
      high: value + base * 0.0011,
      low: value - base * 0.001,
      close: value + (index % 2 === 0 ? base * 0.00038 : -base * 0.00028),
    };
  });
}

function formatPrice(market: Market, value = market.price) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: market.precision,
    maximumFractionDigits: market.precision,
  });
}

function timeLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function BinaryClient() {
  const [marketType, setMarketType] = useState<MarketType>("Forex");
  const [selectedSymbol, setSelectedSymbol] = useState("EUR/USD");
  const [direction, setDirection] = useState<Direction>("up");
  const [duration, setDuration] = useState(30);
  const [stake, setStake] = useState(100);
  const [tick, setTick] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTrades((current) =>
      current.map((trade) => {
        if (trade.status !== "active" || trade.expiresAt > now) return trade;
        const market = MARKETS.find((item) => item.symbol === trade.symbol) ?? MARKETS[0];
        const exit = market.price * (1 + Math.sin((trade.id + tick) / 2) * 0.0018);
        const won = trade.direction === "up" ? exit >= trade.entry : exit <= trade.entry;
        return { ...trade, status: won ? "won" : "lost", exit };
      }),
    );
  }, [now, tick]);

  const selectedMarket = MARKETS.find((item) => item.symbol === selectedSymbol) ?? MARKETS[0];
  const filteredMarkets = MARKETS.filter((item) => item.type === marketType);
  const displayPrice = selectedMarket.price * (1 + Math.sin(tick / 5) * 0.0012);
  const series = useMemo(
    () => seededSeries(selectedMarket.symbol.length * 13 + tick, displayPrice),
    [displayPrice, selectedMarket.symbol.length, tick],
  );
  const activeTrades = trades.filter((trade) => trade.status === "active");
  const settledTrades = trades.filter((trade) => trade.status !== "active").slice(0, 5);
  const potentialReturn = Math.round(stake * (1 + selectedMarket.payout / 100));

  function placeTrade() {
    const id = Date.now();
    setTrades((current) => [
      {
        id,
        symbol: selectedMarket.symbol,
        direction,
        stake,
        entry: displayPrice,
        expiresAt: Date.now() + duration * 1000,
        status: "active",
      },
      ...current,
    ]);
  }

  return (
    <div className="min-h-screen bg-[#050506] px-3 pb-10 pt-4 text-white lg:px-8 lg:pt-7">
      <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111216] px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#087cff]/15 text-[#087cff]">
            <Icon name="candlestick_chart" className="text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">Binary</h1>
              <span className="rounded-full bg-[#14f195]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#14f195]">
                Live
              </span>
            </div>
            <p className="truncate text-xs font-bold text-slate-500">Fixed payout markets for short direction trades</p>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <Metric label="Volume" value="KSh 4.8M" />
            <Metric label="Active" value={String(activeTrades.length || 12)} />
            <Metric label="Avg payout" value="82%" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Balance" value="KSh 0" />
          <MetricCard label="Demo P/L" value="+KSh 0" positive />
          <MetricCard label="Signals" value="18" />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="rounded-2xl border border-white/[0.08] bg-[#101418] p-3">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1">
            {(["Forex", "Crypto", "Commodities"] as MarketType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setMarketType(type);
                  setSelectedSymbol(MARKETS.find((item) => item.type === type)?.symbol ?? selectedSymbol);
                }}
                className={`rounded-lg px-2 py-2 text-[11px] font-black transition ${
                  marketType === type ? "bg-[#087cff] text-white" : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {type === "Commodities" ? "Metals" : type}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2">
            <Icon name="search" className="text-[16px] text-slate-500" />
            <span className="text-xs font-bold text-slate-500">Search markets...</span>
          </div>

          <div className="space-y-2">
            {filteredMarkets.map((market) => {
              const active = market.symbol === selectedSymbol;
              return (
                <button
                  key={market.symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(market.symbol)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-[#087cff]/70 bg-[#087cff]/10"
                      : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">{market.symbol}</div>
                      <div className="text-[11px] font-bold text-slate-500">{market.name}</div>
                    </div>
                    <span className={`text-xs font-black ${market.change >= 0 ? "text-[#14f195]" : "text-[#ff5d6c]"}`}>
                      {market.change >= 0 ? "+" : ""}{market.change}%
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-black text-slate-500">
                    <span>{formatPrice(market)}</span>
                    <span>{market.payout}% payout</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-3">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111216]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">{selectedMarket.symbol}</h2>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selectedMarket.change >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                    {selectedMarket.change >= 0 ? "+" : ""}{selectedMarket.change}%
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-500">{selectedMarket.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-black text-white">{formatPrice(selectedMarket, displayPrice)}</div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">Spot price</div>
              </div>
            </div>
            <MarketChart market={selectedMarket} series={series} price={displayPrice} />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <BetPanel
              active={direction === "up"}
              direction="up"
              label="Higher"
              price={formatPrice(selectedMarket, displayPrice * 1.0004)}
              onClick={() => setDirection("up")}
            />
            <BetPanel
              active={direction === "down"}
              direction="down"
              label="Lower"
              price={formatPrice(selectedMarket, displayPrice * 0.9996)}
              onClick={() => setDirection("down")}
            />
          </section>
        </main>

        <aside className="space-y-3">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111216]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Trade ticket</div>
              <div className="mt-1 text-lg font-black text-white">{selectedMarket.symbol} · {direction === "up" ? "Higher" : "Lower"}</div>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Direction</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("up")}
                    className={`rounded-xl px-4 py-3 text-sm font-black transition ${direction === "up" ? "bg-[#05b957] text-white" : "bg-white/[0.06] text-slate-400"}`}
                  >
                    Higher
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("down")}
                    className={`rounded-xl px-4 py-3 text-sm font-black transition ${direction === "down" ? "bg-[#ff3448] text-white" : "bg-white/[0.06] text-slate-400"}`}
                  >
                    Lower
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Expiry</div>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDuration(item)}
                      className={`rounded-xl px-2 py-2 text-xs font-black transition ${duration === item ? "bg-[#087cff] text-white" : "bg-white/[0.06] text-slate-400"}`}
                    >
                      {item}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500" htmlFor="binary-stake">
                  Stake (KSh)
                </label>
                <input
                  id="binary-stake"
                  type="number"
                  min={10}
                  value={stake}
                  onChange={(event) => setStake(Math.max(10, Number(event.target.value) || 10))}
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 font-mono text-lg font-black text-white outline-none transition focus:border-[#087cff]/70"
                />
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {STAKES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStake(item)}
                      className="rounded-lg bg-white/[0.06] px-2 py-2 text-[11px] font-black text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      {item >= 1000 ? "1K" : item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                <Row label="Entry" value={formatPrice(selectedMarket, displayPrice)} />
                <Row label="Payout" value={`${selectedMarket.payout}%`} />
                <Row label="Return" value={`KSh ${potentialReturn.toLocaleString("en-KE")}`} positive />
              </div>

              <button
                type="button"
                onClick={placeTrade}
                className={`w-full rounded-xl py-4 text-sm font-black text-white shadow-lg transition active:scale-[0.98] ${
                  direction === "up" ? "bg-[#05b957] shadow-emerald-950/40" : "bg-[#ff3448] shadow-red-950/40"
                }`}
              >
                Place {direction === "up" ? "Higher" : "Lower"} · KSh {stake.toLocaleString("en-KE")}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111216] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Active trades</h3>
              <span className="rounded-full bg-[#087cff]/10 px-2 py-1 text-[10px] font-black text-[#8bc5ff]">{activeTrades.length}</span>
            </div>
            <div className="space-y-2">
              {activeTrades.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center text-xs font-bold text-slate-600">
                  No active trades yet
                </div>
              ) : (
                activeTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} now={now} />
                ))
              )}
            </div>
          </section>

          {settledTrades.length > 0 && (
            <section className="rounded-2xl border border-white/[0.08] bg-[#111216] p-4">
              <h3 className="mb-3 text-sm font-black text-white">Recent results</h3>
              <div className="space-y-2">
                {settledTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} now={now} compact />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function MarketChart({ market, price, series }: { market: Market; price: number; series: ReturnType<typeof seededSeries> }) {
  const values = series.flatMap((item) => [item.high, item.low]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scaleY = (value: number) => 330 - ((value - min) / (max - min || 1)) * 270;
  const scaleX = (index: number) => 40 + (index / (series.length - 1)) * 780;
  const line = series.map((item, index) => `${index === 0 ? "M" : "L"} ${scaleX(index)} ${scaleY(item.close)}`).join(" ");
  const area = `${line} L 820 340 L 40 340 Z`;

  return (
    <div className="relative h-[430px] overflow-hidden rounded-b-2xl bg-[#090a0d] sm:h-[520px]">
      <svg className="h-full w-full" viewBox="0 0 860 380" preserveAspectRatio="none" role="img" aria-label={`${market.symbol} live price chart`}>
        <defs>
          <linearGradient id="binaryArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#087cff" stopOpacity="0.28" />
            <stop offset="1" stopColor="#087cff" stopOpacity="0" />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: 6 }, (_, index) => (
          <line key={`h-${index}`} x1="40" x2="820" y1={60 + index * 54} y2={60 + index * 54} stroke="rgba(255,255,255,.055)" strokeDasharray="4 8" />
        ))}
        {Array.from({ length: 8 }, (_, index) => (
          <line key={`v-${index}`} x1={40 + index * 111} x2={40 + index * 111} y1="42" y2="342" stroke="rgba(255,255,255,.035)" />
        ))}
        {series.filter((_, index) => index % 3 === 0).map((item, index) => {
          const x = scaleX(index * 3);
          const green = item.close >= item.open;
          return (
            <g key={`${item.x}-${index}`}>
              <line x1={x} x2={x} y1={scaleY(item.high)} y2={scaleY(item.low)} stroke={green ? "#16d477" : "#ff4558"} strokeWidth="1.5" opacity="0.75" />
              <rect x={x - 3} y={Math.min(scaleY(item.open), scaleY(item.close))} width="6" height={Math.max(4, Math.abs(scaleY(item.close) - scaleY(item.open)))} rx="2" fill={green ? "#16d477" : "#ff4558"} opacity="0.85" />
            </g>
          );
        })}
        <path d={area} fill="url(#binaryArea)" />
        <path d={line} fill="none" stroke="#58a6ff" strokeWidth="3" filter="url(#lineGlow)" />
        <line x1="40" x2="820" y1={scaleY(price)} y2={scaleY(price)} stroke="#f6c344" strokeWidth="1.5" strokeDasharray="8 8" opacity="0.7" />
        <circle cx="820" cy={scaleY(price)} r="7" fill="#f6c344" />
        <text x="780" y={scaleY(price) - 14} fill="#f6c344" fontSize="13" fontWeight="800">
          {formatPrice(market, price)}
        </text>
      </svg>
      <div className="pointer-events-none absolute left-4 top-4 flex gap-2">
        <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-slate-300">1s candles</span>
        <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-slate-300">OTC</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</div>
      <div className="font-mono text-sm font-black text-white">{value}</div>
    </div>
  );
}

function MetricCard({ label, positive, value }: { label: string; positive?: boolean; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111216] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-black ${positive ? "text-[#14f195]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function BetPanel({ active, direction, label, onClick, price }: { active: boolean; direction: Direction; label: string; onClick: () => void; price: string }) {
  const up = direction === "up";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
        active
          ? up
            ? "border-[#05b957]/70 bg-[#05b957]/12"
            : "border-[#ff3448]/70 bg-[#ff3448]/12"
          : "border-white/[0.08] bg-[#111216] hover:bg-white/[0.045]"
      }`}
    >
      <div>
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-1 font-mono text-xl font-black text-white">{price}</div>
      </div>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${up ? "bg-[#05b957]" : "bg-[#ff3448]"} text-white`}>
        <Icon name={up ? "arrow_upward" : "arrow_downward"} className="text-[22px]" />
      </span>
    </button>
  );
}

function Row({ label, positive, value }: { label: string; positive?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`font-mono text-sm font-black ${positive ? "text-[#14f195]" : "text-white"}`}>{value}</span>
    </div>
  );
}

function TradeRow({ compact, now, trade }: { compact?: boolean; now: number; trade: Trade }) {
  const active = trade.status === "active";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{trade.symbol}</div>
          <div className="text-[11px] font-bold text-slate-500">
            {trade.direction === "up" ? "Higher" : "Lower"} · KSh {trade.stake}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
            active
              ? "bg-[#087cff]/10 text-[#8bc5ff]"
              : trade.status === "won"
                ? "bg-[#05b957]/10 text-[#14f195]"
                : "bg-[#ff3448]/10 text-[#ff8b96]"
          }`}
        >
          {active ? `${timeLeft(trade.expiresAt, now)}s` : trade.status}
        </span>
      </div>
      {!compact && active && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-[#087cff]" style={{ width: `${Math.max(8, timeLeft(trade.expiresAt, now) * 3)}%` }} />
        </div>
      )}
    </div>
  );
}
