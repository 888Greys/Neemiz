"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";

type Direction = "buy" | "sell";
type TradeStatus = "open" | "closed";

type ForexQuote = {
  symbol: string;
  name: string;
  base: string;
  quote: string;
  price: number;
  date: string;
  precision: number;
};

type SelectedQuote = ForexQuote & {
  dayChange: number;
  dayChangePct: number;
};

type Candle = {
  date: string;
  close: number;
};

type ForexResponse = {
  provider: string;
  providerUrl: string;
  updatedAt: string;
  selected: SelectedQuote;
  quotes: ForexQuote[];
  candles: Candle[];
};

type Trade = {
  id: number;
  symbol: string;
  direction: Direction;
  size: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  status: TradeStatus;
  openedAt: number;
  precision: number;
};

const DEFAULT_SYMBOL = "EUR/USD";
const SIZES = [1000, 5000, 10000, 25000, 50000];

const FALLBACK_DATA: ForexResponse = {
  provider: "Fallback",
  providerUrl: "https://frankfurter.dev",
  updatedAt: new Date().toISOString(),
  selected: {
    symbol: "EUR/USD",
    name: "Euro / US Dollar",
    base: "EUR",
    quote: "USD",
    price: 1.1595,
    date: "2026-05-22",
    precision: 5,
    dayChange: -0.0004,
    dayChangePct: -0.034,
  },
  quotes: [
    { symbol: "EUR/USD", name: "Euro / US Dollar", base: "EUR", quote: "USD", price: 1.1595, date: "2026-05-22", precision: 5 },
    { symbol: "GBP/USD", name: "British Pound / US Dollar", base: "GBP", quote: "USD", price: 1.346, date: "2026-05-22", precision: 5 },
    { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", base: "USD", quote: "JPY", price: 156.42, date: "2026-05-22", precision: 3 },
    { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", base: "USD", quote: "CHF", price: 0.8079, date: "2026-05-22", precision: 5 },
  ],
  candles: [
    { date: "2026-05-15", close: 1.1628 },
    { date: "2026-05-18", close: 1.1648 },
    { date: "2026-05-19", close: 1.162 },
    { date: "2026-05-20", close: 1.16 },
    { date: "2026-05-21", close: 1.1599 },
    { date: "2026-05-22", close: 1.1595 },
  ],
};

function formatPrice(quote: Pick<ForexQuote, "precision">, value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: quote.precision,
    maximumFractionDigits: quote.precision,
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pipSize(quote: Pick<ForexQuote, "precision">) {
  return quote.precision === 3 ? 0.01 : 0.0001;
}

function getPips(entry: number, price: number, quote: Pick<ForexQuote, "precision">) {
  return (price - entry) / pipSize(quote);
}

export function BinaryClient() {
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [direction, setDirection] = useState<Direction>("buy");
  const [size, setSize] = useState(10000);
  const [riskPips, setRiskPips] = useState(25);
  const [targetPips, setTargetPips] = useState(45);
  const [data, setData] = useState<ForexResponse>(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadQuotes() {
      try {
        setError(null);
        const response = await fetch(`/api/forex/quotes?symbol=${encodeURIComponent(selectedSymbol)}`, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Forex feed unavailable");
        const payload = (await response.json()) as ForexResponse;
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Forex feed unavailable");
      } finally {
        if (alive) setLoading(false);
      }
    }

    setLoading(true);
    void loadQuotes();
    const timer = window.setInterval(loadQuotes, 60_000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [selectedSymbol]);

  const selected = data.selected;
  const chart = data.candles.length > 1 ? data.candles : FALLBACK_DATA.candles;
  const positive = selected.dayChangePct >= 0;
  const spread = selected.price * 0.00018;
  const bid = selected.price - spread / 2;
  const ask = selected.price + spread / 2;
  const unit = pipSize(selected);
  const stopLoss = direction === "buy" ? selected.price - riskPips * unit : selected.price + riskPips * unit;
  const takeProfit = direction === "buy" ? selected.price + targetPips * unit : selected.price - targetPips * unit;
  const openTrades = trades.filter((trade) => trade.status === "open");
  const exposure = openTrades.reduce((total, trade) => total + trade.size, 0);
  const estimatedPnl = openTrades.reduce((total, trade) => {
    const pips = getPips(trade.entry, selected.price, trade);
    return total + (trade.direction === "buy" ? pips : -pips) * (trade.size / 10000);
  }, 0);

  const levels = useMemo(() => {
    const closes = chart.map((item) => item.close);
    return {
      high: Math.max(...closes),
      low: Math.min(...closes),
      average: closes.reduce((total, item) => total + item, 0) / closes.length,
    };
  }, [chart]);

  function openTrade() {
    setTrades((current) => [
      {
        id: Date.now(),
        symbol: selected.symbol,
        direction,
        size,
        entry: selected.price,
        stopLoss,
        takeProfit,
        status: "open",
        openedAt: Date.now(),
        precision: selected.precision,
      },
      ...current,
    ]);
  }

  function closeTrade(id: number) {
    setTrades((current) => current.map((trade) => (trade.id === id ? { ...trade, status: "closed" } : trade)));
  }

  return (
    <div className="min-h-screen bg-[#07080a] px-3 pb-10 pt-4 text-white lg:px-6 lg:pt-5">
      <div className="mb-3 grid gap-3 xl:grid-cols-[1fr_380px]">
        <section className="flex min-w-0 flex-wrap items-center gap-3 border border-white/[0.08] bg-[#101216] px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0d8f62]/15 text-[#33d49b]">
            <Icon name="currency_exchange" className="text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">Forex Trading</h1>
              <span className="rounded bg-[#33d49b]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#33d49b]">
                Real rates
              </span>
              {loading && <span className="text-[11px] font-bold text-slate-500">Refreshing feed...</span>}
            </div>
            <p className="truncate text-xs font-bold text-slate-500">
              Official FX reference data from {data.provider}. Orders are simulated until brokerage execution is connected.
            </p>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <Metric label="Updated" value={formatTime(data.updatedAt)} />
            <Metric label="Rate date" value={selected.date} />
            <Metric label="Open" value={String(openTrades.length)} />
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <MetricCard label="Exposure" value={`${exposure.toLocaleString("en-US")} units`} />
          <MetricCard label="Open P/L" value={`${estimatedPnl >= 0 ? "+" : ""}${estimatedPnl.toFixed(2)} pips`} positive={estimatedPnl >= 0} negative={estimatedPnl < 0} />
          <MetricCard label="Feed" value={error ? "Fallback" : data.provider} negative={Boolean(error)} />
        </section>
      </div>

      {error && (
        <div className="mb-3 border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-xs font-bold text-amber-200">
          {error}. Showing the last bundled quote while the live provider recovers.
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="border border-white/[0.08] bg-[#101216] p-3">
          <div className="mb-3 flex items-center gap-2 border border-white/[0.07] bg-black/20 px-3 py-2">
            <Icon name="search" className="text-[16px] text-slate-500" />
            <span className="text-xs font-bold text-slate-500">Major forex pairs</span>
          </div>

          <div className="space-y-2">
            {data.quotes.map((quote) => {
              const active = quote.symbol === selected.symbol;
              return (
                <button
                  key={quote.symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(quote.symbol)}
                  className={`w-full border p-3 text-left transition ${
                    active
                      ? "border-[#33d49b]/70 bg-[#33d49b]/10"
                      : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">{quote.symbol}</div>
                      <div className="text-[11px] font-bold text-slate-500">{quote.name}</div>
                    </div>
                    <span className="rounded bg-white/[0.05] px-2 py-1 text-[10px] font-black text-slate-400">
                      FX
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-black text-slate-500">
                    <span>{formatPrice(quote, quote.price)}</span>
                    <span>{quote.date}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-3">
          <section className="border border-white/[0.08] bg-[#101216]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">{selected.symbol}</h2>
                  <span className={`rounded px-2 py-1 text-[10px] font-black ${positive ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                    {positive ? "+" : ""}{selected.dayChangePct.toFixed(3)}%
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-500">{selected.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right">
                <QuoteBox label="Bid" value={formatPrice(selected, bid)} tone="sell" />
                <QuoteBox label="Ask" value={formatPrice(selected, ask)} tone="buy" />
              </div>
            </div>
            <ForexChart candles={chart} quote={selected} price={selected.price} />
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <LevelCard label="30D high" value={formatPrice(selected, levels.high)} />
            <LevelCard label="30D average" value={formatPrice(selected, levels.average)} />
            <LevelCard label="30D low" value={formatPrice(selected, levels.low)} />
          </section>
        </main>

        <aside className="space-y-3">
          <section className="border border-white/[0.08] bg-[#101216]">
            <div className="border-b border-white/[0.07] px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Order ticket</div>
              <div className="mt-1 text-lg font-black text-white">{selected.symbol} {direction.toUpperCase()}</div>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Side</div>
                <div className="grid grid-cols-2 gap-2">
                  <TradeButton active={direction === "buy"} label="Buy" onClick={() => setDirection("buy")} tone="buy" />
                  <TradeButton active={direction === "sell"} label="Sell" onClick={() => setDirection("sell")} tone="sell" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500" htmlFor="forex-size">
                  Position size
                </label>
                <input
                  id="forex-size"
                  type="number"
                  min={1000}
                  step={1000}
                  value={size}
                  onChange={(event) => setSize(Math.max(1000, Number(event.target.value) || 1000))}
                  className="h-12 w-full border border-white/[0.08] bg-black/25 px-4 font-mono text-lg font-black text-white outline-none transition focus:border-[#33d49b]/70"
                />
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {SIZES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSize(item)}
                      className="bg-white/[0.06] px-2 py-2 text-[11px] font-black text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      {item / 1000}K
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberField id="risk-pips" label="Stop loss" suffix="pips" value={riskPips} onChange={setRiskPips} />
                <NumberField id="target-pips" label="Take profit" suffix="pips" value={targetPips} onChange={setTargetPips} />
              </div>

              <div className="border border-white/[0.07] bg-black/20 p-3">
                <Row label="Entry" value={formatPrice(selected, selected.price)} />
                <Row label="Stop loss" value={formatPrice(selected, stopLoss)} negative />
                <Row label="Take profit" value={formatPrice(selected, takeProfit)} positive />
              </div>

              <button
                type="button"
                onClick={openTrade}
                className={`w-full py-4 text-sm font-black text-white transition active:scale-[0.98] ${
                  direction === "buy" ? "bg-[#0f9f68] hover:bg-[#13ae73]" : "bg-[#d33d4b] hover:bg-[#e24755]"
                }`}
              >
                Open {direction.toUpperCase()} {selected.symbol}
              </button>
            </div>
          </section>

          <section className="border border-white/[0.08] bg-[#101216] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Open positions</h3>
              <span className="rounded bg-[#33d49b]/10 px-2 py-1 text-[10px] font-black text-[#92f1cc]">{openTrades.length}</span>
            </div>
            <div className="space-y-2">
              {openTrades.length === 0 ? (
                <div className="border border-dashed border-white/[0.08] py-8 text-center text-xs font-bold text-slate-600">
                  No open positions
                </div>
              ) : (
                openTrades.map((trade) => (
                  <PositionRow key={trade.id} currentPrice={selected.price} onClose={() => closeTrade(trade.id)} trade={trade} />
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function buildTradingSeries(candles: Candle[], quote: SelectedQuote) {
  if (candles.length < 2) return candles.map((item) => ({ ...item, source: true }));

  const pip = pipSize(quote);
  const dense: Array<Candle & { source?: boolean }> = [];

  for (let index = 0; index < candles.length - 1; index += 1) {
    const current = candles[index];
    const next = candles[index + 1];
    const steps = 4;

    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps;
      const wave = Math.sin((index * steps + step) * 1.7) * pip * 3.2;
      const chop = Math.cos((index * 5 + step) * 2.3) * pip * 1.7;
      dense.push({
        date: step === 0 ? current.date : `${current.date}.${step}`,
        close: current.close + (next.close - current.close) * progress + wave + chop,
        source: step === 0,
      });
    }
  }

  dense.push({ ...candles[candles.length - 1], source: true });
  return dense;
}

function ForexChart({ candles, price, quote }: { candles: Candle[]; price: number; quote: SelectedQuote }) {
  const tradingSeries = buildTradingSeries(candles, quote);
  const values = tradingSeries.map((item) => item.close);
  const minValue = Math.min(...values, price);
  const maxValue = Math.max(...values, price);
  const padding = Math.max((maxValue - minValue) * 0.18, pipSize(quote) * 8);
  const min = minValue - padding;
  const max = maxValue + padding;
  const range = max - min || 1;
  const chartLeft = 36;
  const chartRight = 780;
  const chartTop = 44;
  const chartBottom = 334;
  const scaleY = (value: number) => chartBottom - ((value - min) / range) * (chartBottom - chartTop);
  const scaleX = (index: number) => chartLeft + (index / Math.max(1, tradingSeries.length - 1)) * (chartRight - chartLeft);
  const line = tradingSeries.map((item, index) => `${index === 0 ? "M" : "L"} ${scaleX(index)} ${scaleY(item.close)}`).join(" ");
  const area = `${line} L ${chartRight} ${chartBottom} L ${chartLeft} ${chartBottom} Z`;
  const positive = tradingSeries[tradingSeries.length - 1]?.close >= tradingSeries[0]?.close;
  const stroke = positive ? "#3d8ed9" : "#ff5d6c";
  const priceY = scaleY(price);
  const expiryX = scaleX(Math.floor(tradingSeries.length * 0.64));
  const nowX = scaleX(Math.max(0, tradingSeries.length - 1));
  const priceLevels = Array.from({ length: 5 }, (_, index) => max - (range / 4) * index);
  const bottomLabels = ["17:56:45", "17:57", "17:57:30", "17:58", "17:58:30", "17:59", "17:59:30"];
  const expirationTime = new Date(Date.now() + 60_000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="relative h-[500px] overflow-hidden bg-[#111625] sm:h-[570px]">
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:65px_56px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_36%_42%,rgba(65,105,160,.18),transparent_38%),linear-gradient(180deg,rgba(18,22,35,.16),rgba(7,9,15,.82))]" />

      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <button type="button" className="flex h-11 items-center gap-2 bg-[#273044] px-4 text-sm font-black text-white">
          {quote.symbol} <Icon name="expand_more" className="text-[16px] text-slate-400" />
        </button>
        {["bar_chart", "settings", "edit_note", "grid_view"].map((icon) => (
          <button key={icon} type="button" className="flex h-10 w-10 items-center justify-center bg-[#273044] text-slate-200">
            <Icon name={icon} className="text-[18px]" />
          </button>
        ))}
      </div>

      <svg className="relative z-[1] h-full w-full" viewBox="0 0 860 390" preserveAspectRatio="none" role="img" aria-label={`${quote.symbol} trading-style reference chart`}>
        <defs>
          <linearGradient id="forexArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <filter id="forexLineGlow">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: 7 }, (_, index) => (
          <line key={`h-${index}`} x1={chartLeft} x2="826" y1={chartTop + index * 48} y2={chartTop + index * 48} stroke="rgba(160,180,215,.12)" strokeWidth="1" />
        ))}
        {Array.from({ length: 13 }, (_, index) => (
          <line key={`v-${index}`} x1={chartLeft + index * 62} x2={chartLeft + index * 62} y1="34" y2="356" stroke="rgba(160,180,215,.10)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#forexArea)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.7" filter="url(#forexLineGlow)" />
        {tradingSeries.filter((item) => item.source).map((item, index) => (
          <circle key={item.date} cx={scaleX(index * 4)} cy={scaleY(item.close)} r="2.2" fill={stroke} opacity="0.5" />
        ))}
        <line x1={chartLeft} x2="826" y1={priceY} y2={priceY} stroke="#66a8e8" strokeWidth="1.2" opacity="0.55" />
        <line x1={expiryX} x2={expiryX} y1="0" y2="390" stroke="rgba(255,255,255,.35)" strokeWidth="1.3" />
        <line x1={nowX} x2={nowX} y1="36" y2="356" stroke="#1ec7ff" strokeWidth="1.2" />
        <circle cx={nowX} cy={priceY} r="5.5" fill="#1ec7ff" />
        <rect x="782" y={priceY - 16} width="70" height="30" rx="4" fill="#4075a8" />
        <text x="817" y={priceY + 5} fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
          {formatPrice(quote, price)}
        </text>
        <rect x={expiryX - 12} y="0" width="24" height="11" fill="#e6edf7" />
        <path d={`M ${expiryX - 7} 11 L ${expiryX + 7} 11 L ${expiryX} 19 Z`} fill="#e6edf7" />
        <text x={expiryX + 7} y="39" fill="#8fa0be" fontSize="12" fontWeight="800">Expiration time</text>
        <text x={expiryX + 7} y="62" fill="#7b879f" fontSize="12" fontWeight="800">{expirationTime}</text>
        {priceLevels.map((level, index) => (
          <text key={level} x="828" y={scaleY(level) + 4} fill="#7d8aa3" fontSize="12" fontWeight="800" textAnchor="end" opacity={index === 0 || index === priceLevels.length - 1 ? 0.55 : 0.85}>
            {formatPrice(quote, level)}
          </text>
        ))}
      </svg>
      <div className="pointer-events-none absolute bottom-9 left-7 right-14 z-10 flex justify-between text-[12px] font-black text-slate-500">
        {bottomLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="absolute bottom-4 left-7 z-10 flex items-center gap-2">
        <button type="button" className="flex h-9 min-w-20 items-center justify-center gap-2 border border-white/15 bg-[#1c2537] px-4 text-sm font-black text-slate-300">
          M4 <Icon name="expand_more" className="text-[15px]" />
        </button>
        <span className="rounded bg-[#1f2a3f]/90 px-3 py-2 font-mono text-xs font-black text-slate-400">
          {candles[0]?.date} - {candles[candles.length - 1]?.date}
        </span>
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

function MetricCard({ label, negative, positive, value }: { label: string; negative?: boolean; positive?: boolean; value: string }) {
  return (
    <div className="border border-white/[0.08] bg-[#101216] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-black ${positive ? "text-[#33d49b]" : negative ? "text-[#ff6171]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function QuoteBox({ label, tone, value }: { label: string; tone: "buy" | "sell"; value: string }) {
  return (
    <div className={`min-w-[118px] border px-3 py-2 ${tone === "buy" ? "border-[#33d49b]/30 bg-[#33d49b]/8" : "border-[#ff6171]/30 bg-[#ff6171]/8"}`}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-lg font-black text-white">{value}</div>
    </div>
  );
}

function LevelCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/[0.08] bg-[#101216] p-4">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-white">{value}</div>
    </div>
  );
}

function TradeButton({ active, label, onClick, tone }: { active: boolean; label: string; onClick: () => void; tone: "buy" | "sell" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-sm font-black transition ${
        active
          ? tone === "buy"
            ? "bg-[#0f9f68] text-white"
            : "bg-[#d33d4b] text-white"
          : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]"
      }`}
    >
      {label}
    </button>
  );
}

function NumberField({ id, label, onChange, suffix, value }: { id: string; label: string; onChange: (value: number) => void; suffix: string; value: number }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500" htmlFor={id}>
        {label}
      </label>
      <div className="flex h-11 items-center border border-white/[0.08] bg-black/25 focus-within:border-[#33d49b]/70">
        <input
          id={id}
          type="number"
          min={1}
          value={value}
          onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm font-black text-white outline-none"
        />
        <span className="pr-3 text-[10px] font-black uppercase text-slate-600">{suffix}</span>
      </div>
    </div>
  );
}

function Row({ label, negative, positive, value }: { label: string; negative?: boolean; positive?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`font-mono text-sm font-black ${positive ? "text-[#33d49b]" : negative ? "text-[#ff6171]" : "text-white"}`}>{value}</span>
    </div>
  );
}

function PositionRow({ currentPrice, onClose, trade }: { currentPrice: number; onClose: () => void; trade: Trade }) {
  const rawPips = getPips(trade.entry, currentPrice, trade);
  const pips = trade.direction === "buy" ? rawPips : -rawPips;

  return (
    <div className="border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{trade.symbol}</div>
          <div className="text-[11px] font-bold text-slate-500">
            {trade.direction.toUpperCase()} {trade.size.toLocaleString("en-US")} @ {formatPrice(trade, trade.entry)}
          </div>
        </div>
        <div className={`font-mono text-sm font-black ${pips >= 0 ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
          {pips >= 0 ? "+" : ""}{pips.toFixed(1)}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full bg-white/[0.06] py-2 text-xs font-black text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
      >
        Close position
      </button>
    </div>
  );
}
