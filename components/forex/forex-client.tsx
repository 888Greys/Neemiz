"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Icon } from "@/components/icon";

type Direction = "buy" | "sell";
type StreamStatus = "connecting" | "live" | "fallback";

type ForexMarket = {
  symbol: string;
  derivSymbol: string;
  name: string;
  base: string;
  quote: string;
  fallbackPrice: number;
  precision: number;
};

type Trade = {
  id: string;
  symbol: string;
  direction: Direction;
  size: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  openedAt: number;
  precision: number;
  margin?: number;
};

type ClosedTrade = {
  id: string;
  symbol: string;
  direction: Direction;
  size: number;
  entry: number;
  closePrice: number | null;
  precision: number;
  margin: number;
  profitLoss: number | null;
  openedAt: number;
  closedAt: number | null;
};

type Candle = CandlestickData<Time> & {
  time: UTCTimestamp;
};

const DEFAULT_SYMBOL = "EUR/USD";
const DERIV_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const CANDLE_SECONDS = 60;
const SIZES = [1000, 5000, 10000, 25000, 50000];

const MARKETS: ForexMarket[] = [
  { symbol: "EUR/USD", derivSymbol: "frxEURUSD", name: "Euro / US Dollar", base: "EUR", quote: "USD", fallbackPrice: 1.16, precision: 5 },
  { symbol: "GBP/USD", derivSymbol: "frxGBPUSD", name: "British Pound / US Dollar", base: "GBP", quote: "USD", fallbackPrice: 1.34, precision: 5 },
  { symbol: "USD/JPY", derivSymbol: "frxUSDJPY", name: "US Dollar / Japanese Yen", base: "USD", quote: "JPY", fallbackPrice: 159.2, precision: 3 },
  { symbol: "USD/CHF", derivSymbol: "frxUSDCHF", name: "US Dollar / Swiss Franc", base: "USD", quote: "CHF", fallbackPrice: 0.79, precision: 5 },
  { symbol: "AUD/USD", derivSymbol: "frxAUDUSD", name: "Australian Dollar / US Dollar", base: "AUD", quote: "USD", fallbackPrice: 0.71, precision: 5 },
  { symbol: "USD/CAD", derivSymbol: "frxUSDCAD", name: "US Dollar / Canadian Dollar", base: "USD", quote: "CAD", fallbackPrice: 1.38, precision: 5 },
  { symbol: "NZD/USD", derivSymbol: "frxNZDUSD", name: "New Zealand Dollar / US Dollar", base: "NZD", quote: "USD", fallbackPrice: 0.65, precision: 5 },
  { symbol: "EUR/GBP", derivSymbol: "frxEURGBP", name: "Euro / British Pound", base: "EUR", quote: "GBP", fallbackPrice: 0.86, precision: 5 },
];

function formatPrice(market: Pick<ForexMarket, "precision">, value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: market.precision,
    maximumFractionDigits: market.precision,
  });
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("en-KE", {
    timeStyle: "medium",
  }).format(new Date(value * 1000));
}

function pipSize(market: Pick<ForexMarket, "precision">) {
  return market.precision === 3 ? 0.01 : 0.0001;
}

function getPips(entry: number, price: number, market: Pick<ForexMarket, "precision">) {
  return (price - entry) / pipSize(market);
}

function bucketTime(epoch: number) {
  return (Math.floor(epoch / CANDLE_SECONDS) * CANDLE_SECONDS) as UTCTimestamp;
}

function upsertCandle(candles: Candle[], epoch: number, price: number) {
  const time = bucketTime(epoch);
  const last = candles[candles.length - 1];

  if (last?.time === time) {
    return [
      ...candles.slice(0, -1),
      {
        ...last,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
      },
    ].slice(-180);
  }

  const open = last?.close ?? price;
  return [
    ...candles,
    { time, open, high: Math.max(open, price), low: Math.min(open, price), close: price },
  ].slice(-180);
}

function buildFallbackCandles(market: ForexMarket): Candle[] {
  const now = bucketTime(Math.floor(Date.now() / 1000));
  const pip = pipSize(market);
  let previous = market.fallbackPrice;

  return Array.from({ length: 90 }, (_, index) => {
    const time = (now - (90 - index) * CANDLE_SECONDS) as UTCTimestamp;
    const drift = Math.sin(index / 8) * pip * 7 + Math.cos(index / 5) * pip * 4;
    const open = previous;
    const close = market.fallbackPrice + drift;
    const high = Math.max(open, close) + pip * (2 + (index % 4));
    const low = Math.min(open, close) - pip * (1.5 + (index % 3));
    previous = close;
    return { time, open, high, low, close };
  });
}

function TradingViewCandles({ candles, market }: { candles: Candle[]; market: ForexMarket }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f18" },
        textColor: "#7f8ca7",
        fontFamily: "var(--font-jakarta), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(8,124,255,0.65)", labelBackgroundColor: "#087cff" },
        horzLine: { color: "rgba(8,124,255,0.65)", labelBackgroundColor: "#087cff" },
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(market, price),
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceFormat: {
        type: "price",
        precision: market.precision,
        minMove: pipSize(market),
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [market]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(candles);
    if (candles.length > 0) chartRef.current.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="h-full min-h-[180px] w-full sm:min-h-[260px]" />;
}

export function ForexClient() {
  const [mounted, setMounted] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [direction, setDirection] = useState<Direction>("buy");
  const [size, setSize] = useState(10000);
  const [riskPips, setRiskPips] = useState(25);
  const [targetPips, setTargetPips] = useState(45);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastTickAt, setLastTickAt] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [openingTrade, setOpeningTrade] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [forexHistory, setForexHistory] = useState<ClosedTrade[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const autoClosingRef = useRef<Set<string>>(new Set());
  const orderPanelRef = useRef<HTMLDivElement | null>(null);
  const positionsSectionRef = useRef<HTMLDivElement | null>(null);

  const selectedMarket = MARKETS.find((item) => item.symbol === selectedSymbol) ?? MARKETS[0];

  useEffect(() => {
    setMounted(true);
    setLastTickAt(Math.floor(Date.now() / 1000));
  }, []);

  useEffect(() => {
    let active = true;
    let retryCount = 0;
    let retryTimer: number | undefined;
    let socket: WebSocket | undefined;

    setCandles([]);
    setStreamStatus("connecting");
    setStreamError(null);

    function connect() {
      if (!active) return;
      socket = new WebSocket(DERIV_WS_URL);

      socket.onopen = () => {
        if (!active || !socket) return;
        retryCount = 0;
        socket.send(JSON.stringify({
          ticks_history: selectedMarket.derivSymbol,
          adjust_start_time: 1,
          count: 5000,
          end: "latest",
          style: "ticks",
          subscribe: 1,
        }));
      };

      socket.onmessage = (event) => {
        if (!active) return;

        let response: {
          error?: { message?: string };
          history?: { prices?: number[]; times?: number[] };
          tick?: { epoch: number; quote: number };
        };

        try {
          response = JSON.parse(event.data);
        } catch {
          setStreamStatus("fallback");
          setStreamError("Deriv sent an unreadable market message");
          return;
        }

        if (response.error) {
          setStreamStatus("fallback");
          setStreamError(response.error.message ?? "Deriv stream error");
          return;
        }

        if (response.history?.prices?.length && response.history.times?.length) {
          const historyCandles = response.history.prices.reduce<Candle[]>((result, price, index) => {
            const epoch = response.history?.times?.[index] ?? Math.floor(Date.now() / 1000);
            return upsertCandle(result, epoch, price);
          }, []);
          setCandles(historyCandles);
          setLastTickAt(historyCandles[historyCandles.length - 1]?.time ?? Math.floor(Date.now() / 1000));
          setStreamStatus("live");
          setStreamError(null);
        }

        if (response.tick) {
          setCandles((current) => upsertCandle(current, response.tick!.epoch, response.tick!.quote));
          setLastTickAt(response.tick.epoch);
          setStreamStatus("live");
          setStreamError(null);
        }
      };

      socket.onerror = () => {
        if (!active) return;
        setStreamStatus("fallback");
        setStreamError("Deriv stream unavailable");
        setCandles((current) => current.length ? current : buildFallbackCandles(selectedMarket));
      };

      socket.onclose = () => {
        if (!active) return;
        retryCount += 1;
        setStreamStatus("fallback");
        setStreamError("Deriv stream disconnected. Reconnecting...");
        setCandles((current) => current.length ? current : buildFallbackCandles(selectedMarket));
        retryTimer = window.setTimeout(connect, Math.min(8000, 1000 * retryCount));
      };
    }

    connect();

    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN) socket.close();
      }
    };
  }, [selectedMarket]);

  const chartCandles = candles;
  const latest = chartCandles[chartCandles.length - 1];
  const first = chartCandles[0];
  const price = latest?.close ?? selectedMarket.fallbackPrice;
  const change = price - (first?.open ?? selectedMarket.fallbackPrice);
  const changePct = first?.open ? (change / first.open) * 100 : 0;
  const spread = price * 0.00018;
  const bid = price - spread / 2;
  const ask = price + spread / 2;
  const unit = pipSize(selectedMarket);
  const stopLoss = direction === "buy" ? price - riskPips * unit : price + riskPips * unit;
  const takeProfit = direction === "buy" ? price + targetPips * unit : price - targetPips * unit;
  const openTrades = trades;
  const exposure = openTrades.reduce((total, trade) => total + trade.size, 0);
  const estimatedPnl = openTrades.reduce((total, trade) => {
    const pips = getPips(trade.entry, price, trade);
    return total + (trade.direction === "buy" ? pips : -pips) * (trade.size / 10000);
  }, 0);
  const levels = useMemo(() => {
    if (chartCandles.length === 0) {
      const pip = pipSize(selectedMarket);
      return {
        high: selectedMarket.fallbackPrice + pip * 20,
        low: selectedMarket.fallbackPrice - pip * 20,
        average: selectedMarket.fallbackPrice,
      };
    }
    const highs = chartCandles.map((item) => item.high);
    const lows = chartCandles.map((item) => item.low);
    const closes = chartCandles.map((item) => item.close);
    return {
      high: Math.max(...highs),
      low: Math.min(...lows),
      average: closes.reduce((total, item) => total + item, 0) / closes.length,
    };
  }, [chartCandles, selectedMarket]);

  // Load open positions on mount
  useEffect(() => {
    fetch("/api/forex/positions")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Trade[]) => setTrades(data))
      .catch(() => {});
  }, []);

  // Load closed trade history on mount
  useEffect(() => {
    fetch("/api/forex/history")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ClosedTrade[]) => setForexHistory(data))
      .catch(() => {});
  }, []);

  async function openTrade(nextDirection: Direction = direction) {
    setTradeError(null);
    setOpeningTrade(true);
    const sl = nextDirection === "buy" ? price - riskPips * unit : price + riskPips * unit;
    const tp = nextDirection === "buy" ? price + targetPips * unit : price - targetPips * unit;
    try {
      const res = await fetch("/api/forex/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedMarket.symbol,
          direction: nextDirection,
          size,
          entryPrice: price,
          stopLoss: sl,
          takeProfit: tp,
          precision: selectedMarket.precision,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTradeError(data.error ?? "Failed to open trade");
        return;
      }
      setTrades((current) => [data as Trade, ...current]);
      window.dispatchEvent(new Event("wallet-refresh"));
      // Scroll the order panel down so the user sees their new open position
      setTimeout(() => {
        if (orderPanelRef.current) {
          orderPanelRef.current.scrollTo({ top: orderPanelRef.current.scrollHeight, behavior: "smooth" });
        }
      }, 80);
    } catch {
      setTradeError("Network error — please try again");
    } finally {
      setOpeningTrade(false);
    }
  }

  async function closeTrade(id: string) {
    setClosingId(id);
    const trade = trades.find((t) => t.id === id);
    if (!trade) { setClosingId(null); return; }
    try {
      const res = await fetch("/api/forex/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: id, closePrice: price }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTradeError(data.error ?? "Failed to close trade");
        return;
      }
      setTrades((current) => current.filter((t) => t.id !== id));
      window.dispatchEvent(new Event("wallet-refresh"));
      // Prepend to local history so user sees it immediately without a refresh
      if (trade) {
        const closed: ClosedTrade = {
          id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          size: trade.size,
          entry: trade.entry,
          closePrice: price,
          precision: trade.precision,
          margin: trade.margin ?? 0,
          profitLoss: data.profitLoss ?? null,
          openedAt: trade.openedAt,
          closedAt: Date.now(),
        };
        setForexHistory((h) => [closed, ...h].slice(0, 30));
        setShowHistory(true);
      }
    } catch {
      setTradeError("Network error — please try again");
    } finally {
      setClosingId(null);
    }
  }

  // Auto-close trades when SL or TP is hit
  useEffect(() => {
    if (trades.length === 0 || price === 0) return;
    for (const trade of trades) {
      if (autoClosingRef.current.has(trade.id)) continue;
      const tpHit = trade.direction === "buy" ? price >= trade.takeProfit : price <= trade.takeProfit;
      const slHit = trade.direction === "buy" ? price <= trade.stopLoss : price >= trade.stopLoss;
      if (tpHit || slHit) {
        autoClosingRef.current.add(trade.id);
        const reason = tpHit ? "Take profit reached" : "Stop loss triggered";
        fetch("/api/forex/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tradeId: trade.id, closePrice: price }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.error) {
              autoClosingRef.current.delete(trade.id);
              return;
            }
            setTrades((current) => current.filter((t) => t.id !== trade.id));
            setTradeError(`${reason} — ${trade.symbol} ${trade.direction.toUpperCase()} closed`);
            window.dispatchEvent(new Event("wallet-refresh"));
            const closed: ClosedTrade = {
              id: trade.id, symbol: trade.symbol, direction: trade.direction,
              size: trade.size, entry: trade.entry, closePrice: price,
              precision: trade.precision, margin: trade.margin ?? 0,
              profitLoss: data.profitLoss ?? null,
              openedAt: trade.openedAt, closedAt: Date.now(),
            };
            setForexHistory((h) => [closed, ...h].slice(0, 30));
            setShowHistory(true);
          })
          .catch(() => autoClosingRef.current.delete(trade.id));
      }
    }
  }, [price, trades]);

  return (
    <div className="min-h-full max-w-full overflow-x-hidden bg-[#050506] pb-16 text-white xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:pb-0">
      <div className="grid min-w-0 shrink-0 grid-cols-1 overflow-hidden border-b border-white/[0.08] bg-[#08090d]/95 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#087cff]/15 text-[#8bc3ff] sm:h-10 sm:w-10">
            <Icon name="candlestick_chart" className="text-[18px] sm:text-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white sm:text-2xl">Forex</h1>
              <StatusPill status={streamStatus} />
            </div>
            <p className="hidden truncate text-xs font-bold text-slate-500 sm:block">
              TradingView Lightweight Charts candlesticks with Deriv live forex ticks.
            </p>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <Metric label="Last tick" value={mounted && lastTickAt ? formatTime(lastTickAt) : "--"} />
            <Metric label="Deriv ID" value={selectedMarket.derivSymbol} />
            <Metric label="Open" value={String(openTrades.length)} />
          </div>
        </section>

        <section className="hidden min-w-0 grid-cols-3 border-l border-white/[0.08] xl:grid">
          <MetricCard label="Exposure" value={`${exposure.toLocaleString("en-US")} units`} />
          <MetricCard label="Open P/L" value={`${estimatedPnl >= 0 ? "+" : ""}${estimatedPnl.toFixed(2)} pips`} positive={estimatedPnl >= 0} negative={estimatedPnl < 0} />
          <MetricCard label="Feed" value={streamStatus === "live" ? "Deriv WS" : streamStatus === "connecting" ? "Connecting" : "Retrying"} negative={streamStatus === "fallback"} />
        </section>
      </div>

      {streamStatus === "fallback" && (
        <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300">
          ⚠ Live feed unavailable — trading disabled.{streamError ? ` ${streamError}` : ""} Reconnecting automatically.
        </div>
      )}

      <div data-forex-grid="true" className="grid max-w-full min-w-0 gap-1 overflow-visible px-0 py-0 sm:px-2 sm:py-2 xl:min-h-0 xl:flex-1 xl:gap-0 xl:overflow-hidden xl:p-0 xl:grid-cols-[200px_minmax(0,1fr)_340px]">
        <aside className="order-2 hidden min-w-0 overflow-hidden rounded border border-white/[0.08] bg-[#101216] xl:order-none xl:block xl:rounded-none xl:border-y-0 xl:border-l-0 xl:border-r">
          <div className="flex h-12 items-center gap-2 border-b border-white/[0.07] bg-black/20 px-3">
            <Icon name="search" className="text-[16px] text-slate-500" />
            <span className="text-xs font-bold text-slate-500">Major forex pairs</span>
          </div>
          <div className="grid max-h-[360px] gap-0 overflow-y-auto [scrollbar-width:none] sm:grid-cols-2 xl:max-h-[calc(100%-3rem)] xl:grid-cols-1 [&::-webkit-scrollbar]:hidden">
            {MARKETS.map((market) => (
              <button
                key={market.symbol}
                type="button"
                onClick={() => setSelectedSymbol(market.symbol)}
                className={`border-b border-white/[0.07] p-2 text-left transition ${
                  market.symbol === selectedSymbol
                    ? "bg-[#087cff]/10"
                    : "bg-white/[0.025] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-white">{market.symbol}</div>
                    <div className="text-[11px] font-bold text-slate-500">{market.name}</div>
                  </div>
                  <span className="rounded bg-white/[0.05] px-2 py-1 text-[10px] font-black text-slate-400">FX</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-black text-slate-500">
                  <span>{formatPrice(market, market.symbol === selectedSymbol ? price : market.fallbackPrice)}</span>
                  <span>{market.symbol === selectedSymbol && streamStatus === "live" ? "live" : "Deriv"}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="order-1 flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-none border-y border-white/[0.08] sm:min-h-[520px] sm:rounded sm:border xl:order-none xl:min-h-0 xl:rounded-none xl:border-0">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#101216]">
            <div className="shrink-0 flex flex-col gap-2 border-b border-white/[0.07] px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMarket.symbol}
                    onChange={(event) => setSelectedSymbol(event.target.value)}
                    className="h-9 rounded border border-white/[0.08] bg-[#151a22] px-2 text-xs font-black text-white outline-none sm:hidden"
                  >
                    {MARKETS.map((market) => (
                      <option key={market.symbol} value={market.symbol}>{market.symbol}</option>
                    ))}
                  </select>
                  <h2 className="hidden text-xl font-black text-white sm:block">{selectedMarket.symbol}</h2>
                  <span className={`rounded px-2 py-1 text-[10px] font-black ${changePct >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                    {changePct >= 0 ? "+" : ""}{changePct.toFixed(3)}%
                  </span>
                </div>
                <div className="hidden text-xs font-bold text-slate-500 sm:block">{selectedMarket.name}</div>
              </div>
              <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-right sm:w-auto">
                <QuoteBox label="Bid" value={formatPrice(selectedMarket, bid)} tone="sell" />
                <QuoteBox label="Ask" value={formatPrice(selectedMarket, ask)} tone="buy" />
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <TradingViewCandles candles={chartCandles} market={selectedMarket} />
              {chartCandles.length === 0 && (
                <div className="absolute inset-0 grid place-items-center bg-[#0b0f18]/80">
                  <div className="rounded-lg border border-white/[0.08] bg-[#101216]/90 px-4 py-3 text-center shadow-2xl shadow-black/30">
                    <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />
                    <p className="text-xs font-black text-white">Loading live candles</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Waiting for Deriv history for {selectedMarket.symbol}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="hidden shrink-0 border-t border-white/[0.08] md:grid-cols-3 sm:grid">
            <LevelCard label="Session high" value={formatPrice(selectedMarket, levels.high)} />
            <LevelCard label="Session average" value={formatPrice(selectedMarket, levels.average)} />
            <LevelCard label="Session low" value={formatPrice(selectedMarket, levels.low)} />
          </section>
        </main>

        <aside className="order-2 min-w-0 overflow-hidden rounded-none border-y border-white/[0.08] bg-[#101216] sm:rounded sm:border xl:order-none xl:block xl:min-h-0 xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l">
          <section className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-white/[0.07] px-3 py-2 sm:px-4 sm:py-3">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Order ticket</div>
              <div className="mt-1 text-base font-black text-white sm:text-lg">{selectedMarket.symbol} {direction.toUpperCase()}</div>
            </div>
            <div ref={orderPanelRef} className="min-h-0 space-y-2 overflow-y-auto p-2 sm:space-y-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2">
                <TradeButton active={direction === "buy"} label="Buy" onClick={() => setDirection("buy")} tone="buy" />
                <TradeButton active={direction === "sell"} label="Sell" onClick={() => setDirection("sell")} tone="sell" />
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
                  className="h-12 w-full rounded border border-white/[0.08] bg-black/25 px-4 font-mono text-lg font-black text-white outline-none transition focus:border-[#087cff]/70"
                />
                <div className="mt-2 grid grid-cols-5 gap-1 sm:gap-2">
                  {SIZES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSize(item)}
                      className={`rounded px-1 py-2 text-[10px] font-black transition sm:px-2 sm:text-[11px] ${size === item ? "bg-[#087cff] text-white" : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-white"}`}
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

              <div className="rounded border border-white/[0.07] bg-black/20 p-3">
                <Row label="Entry" value={formatPrice(selectedMarket, price)} />
                <Row label="Stop loss" value={formatPrice(selectedMarket, stopLoss)} negative />
                <Row label="Take profit" value={formatPrice(selectedMarket, takeProfit)} positive />
              </div>

              {tradeError && (
                <div className={`rounded border px-3 py-2 text-xs font-bold ${tradeError.includes("reached") || tradeError.includes("triggered") ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                  {tradeError}
                  <button type="button" onClick={() => setTradeError(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
                </div>
              )}

              <button
                type="button"
                onClick={() => openTrade()}
                disabled={streamStatus !== "live" || openingTrade}
                className={`hidden w-full rounded py-4 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 xl:block ${
                  direction === "buy" ? "bg-[#0f9f68] hover:bg-[#13ae73]" : "bg-[#d33d4b] hover:bg-[#e24755]"
                }`}
              >
                {openingTrade ? "Opening…" : streamStatus !== "live" ? "Awaiting live feed…" : `Open ${direction.toUpperCase()} ${selectedMarket.symbol}`}
              </button>

              <p className="hidden text-center text-[10px] font-bold leading-relaxed text-slate-600 xl:block">
                Watch the pips — green means profit.<br />
                Your trade closes automatically at Stop Loss / Take Profit.<br />
                Or tap <span className="text-slate-500">Close position</span> below to exit early.
              </p>

              {/* ── Open positions ── */}
              <div ref={positionsSectionRef} className="pt-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Open positions</span>
                  <span className="rounded bg-[#087cff]/10 px-2 py-0.5 text-[10px] font-black text-[#8bc3ff]">{openTrades.length}</span>
                </div>
                <div className="space-y-2">
                  {openTrades.length === 0 ? (
                    <div className="rounded border border-dashed border-white/[0.08] py-6 text-center text-xs font-bold text-slate-600">
                      No open positions
                    </div>
                  ) : (
                    openTrades.map((trade) => (
                      <PositionRow key={trade.id} currentPrice={price} onClose={() => closeTrade(trade.id)} trade={trade} closing={closingId === trade.id} />
                    ))
                  )}
                </div>
              </div>

              {/* ── Trade history ── */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="mb-2 flex w-full items-center justify-between"
                >
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Trade history</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-black text-slate-400">{forexHistory.length}</span>
                    <Icon name={showHistory ? "expand_less" : "expand_more"} className="text-[14px] text-slate-500" />
                  </div>
                </button>
                {showHistory && (
                  <div className="space-y-2">
                    {forexHistory.length === 0 ? (
                      <div className="rounded border border-dashed border-white/[0.08] py-6 text-center text-xs font-bold text-slate-600">
                        No closed trades yet
                      </div>
                    ) : (
                      forexHistory.map((trade) => (
                        <HistoryRow key={trade.id} trade={trade} />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] left-0 right-0 z-40 grid grid-cols-2 gap-2 border-t border-white/[0.08] bg-[#0f1218]/95 p-2 shadow-[0_-12px_24px_rgba(0,0,0,.45)] backdrop-blur lg:bottom-0 xl:hidden">
        <button
          type="button"
          onClick={() => openTrade("buy")}
          disabled={streamStatus !== "live" || openingTrade}
          className="min-h-14 rounded bg-[#0f9f68] px-3 py-2 text-left text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="block">{openingTrade ? "Opening…" : `BUY ${selectedMarket.symbol}`}</span>
          <span className="mt-0.5 block font-mono text-xs text-emerald-100">{formatPrice(selectedMarket, price)}</span>
        </button>
        <button
          type="button"
          onClick={() => openTrade("sell")}
          disabled={streamStatus !== "live" || openingTrade}
          className="min-h-14 rounded bg-[#d33d4b] px-3 py-2 text-left text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="block">{openingTrade ? "Opening…" : `SELL ${selectedMarket.symbol}`}</span>
          <span className="mt-0.5 block font-mono text-xs text-red-100">{formatPrice(selectedMarket, price)}</span>
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: StreamStatus }) {
  return (
    <span className={`rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
      status === "live" ? "bg-sky-400/10 text-sky-300" : status === "connecting" ? "bg-amber-400/10 text-amber-300" : "bg-red-400/10 text-red-300"
    }`}>
      {status === "live" ? "Deriv live" : status === "connecting" ? "Connecting" : "Fallback"}
    </span>
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
    <div className="min-w-0 rounded border border-white/[0.08] bg-[#101216] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-black ${positive ? "text-[#33d49b]" : negative ? "text-[#ff6171]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function QuoteBox({ label, tone, value }: { label: string; tone: "buy" | "sell"; value: string }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded border px-2 py-2 sm:min-w-[112px] sm:px-3 ${tone === "buy" ? "border-[#33d49b]/30 bg-[#33d49b]/8" : "border-[#ff6171]/30 bg-[#ff6171]/8"}`}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="truncate font-mono text-sm font-black text-white sm:text-lg">{value}</div>
    </div>
  );
}

function LevelCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/[0.08] bg-[#101216] p-4">
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
      className={`rounded px-4 py-3 text-sm font-black transition ${
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
      <div className="flex h-11 items-center rounded border border-white/[0.08] bg-black/25 focus-within:border-[#087cff]/70">
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

function PositionRow({ closing, currentPrice, onClose, trade }: { closing?: boolean; currentPrice: number; onClose: () => void; trade: Trade }) {
  const rawPips = getPips(trade.entry, currentPrice, trade);
  const pips = trade.direction === "buy" ? rawPips : -rawPips;
  const plKes = parseFloat((pips * (trade.size / 10000)).toFixed(2));

  return (
    <div className="rounded border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{trade.symbol}</div>
          <div className="text-[11px] font-bold text-slate-500">
            {trade.direction.toUpperCase()} {trade.size.toLocaleString("en-US")} @ {formatPrice(trade, trade.entry)}
          </div>
          {trade.margin && (
            <div className="text-[10px] text-slate-600">Margin: KSh {trade.margin}</div>
          )}
        </div>
        <div className="text-right">
          <div className={`font-mono text-sm font-black ${pips >= 0 ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
            {pips >= 0 ? "+" : ""}{pips.toFixed(1)} pips
          </div>
          <div className={`font-mono text-[11px] font-bold ${plKes >= 0 ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
            {plKes >= 0 ? "+" : ""}KSh {plKes.toFixed(2)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={closing}
        className="mt-3 w-full rounded bg-white/[0.06] py-2 text-xs font-black text-slate-300 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
      >
        {closing ? "Closing…" : "Close position"}
      </button>
    </div>
  );
}

function HistoryRow({ trade }: { trade: ClosedTrade }) {
  const pl = trade.profitLoss ?? 0;
  const won = pl >= 0;
  const closedDate = trade.closedAt ? new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeStyle: "short" }).format(new Date(trade.closedAt)) : "—";

  return (
    <div className="rounded border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-white">{trade.symbol}</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${trade.direction === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
              {trade.direction.toUpperCase()}
            </span>
          </div>
          <div className="text-[10px] font-bold text-slate-600">{closedDate}</div>
          <div className="mt-0.5 text-[11px] font-bold text-slate-500">
            {trade.size.toLocaleString("en-US")} units @ {trade.entry.toLocaleString("en-US", { minimumFractionDigits: trade.precision, maximumFractionDigits: trade.precision })}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-sm font-black ${won ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
            {won ? "+" : ""}KSh {pl.toFixed(2)}
          </div>
          <div className={`rounded px-2 py-0.5 text-[9px] font-black ${won ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
            {won ? "WIN" : "LOSS"}
          </div>
        </div>
      </div>
    </div>
  );
}
