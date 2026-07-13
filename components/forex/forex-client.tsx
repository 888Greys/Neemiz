"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMoney } from "@/lib/currency-context";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { toast } from "@/lib/toast";
import { placed } from "@/lib/game-feel";
import { ValuePickerSheet } from "@/components/binary/panels/digit-panel";
import { useNavBadge } from "@/lib/nav-badge-context";
import { useWalletBalance } from "@/lib/use-wallet-balance";
import { useAuthModal } from "@/lib/auth-modal-context";

type Direction = "buy" | "sell";
type StreamStatus = "connecting" | "live" | "fallback";
type ForexSection = "funding" | "trade" | "discover";

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
const SIZES = [1000, 2000, 5000, 10000, 25000];

// One-tap stop-loss / take-profit shapes. Labels read as risk:reward so the
// trader picks an intent ("1:2") rather than typing raw pips.
const RR_PRESETS: { label: string; sl: number; tp: number }[] = [
  { label: "1:1", sl: 20, tp: 20 },
  { label: "1:2", sl: 25, tp: 50 },
  { label: "1:3", sl: 20, tp: 60 },
  { label: "Scalp", sl: 10, tp: 15 },
];

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

function pipSize(market: Pick<ForexMarket, "precision">) {
  return market.precision === 3 ? 0.01 : 0.0001;
}

// Mirror of calcMargin in app/api/forex/open/route.ts so the ticket can show the
// exact KES the server will reserve before the user commits.
function calcMargin(size: number) {
  return Math.max(10, Math.round(size / 100));
}

function getPips(entry: number, price: number, market: Pick<ForexMarket, "precision">) {
  return (price - entry) / pipSize(market);
}

function bucketTime(epoch: number) {
  return (Math.floor(epoch / CANDLE_SECONDS) * CANDLE_SECONDS) as UTCTimestamp;
}

// lightweight-charts renders the time axis in UTC. Format axis ticks and the
// crosshair in the viewer's local timezone so the clock matches their wall time
// (and other trading sites) instead of running hours behind.
function fmtClock(time: Time, withSeconds: boolean): string {
  const epoch = typeof time === "number" ? time : 0;
  return new Date(epoch * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  });
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

type ChartType = "candles" | "heikin" | "bars" | "area";

const CHART_TYPES: { key: ChartType; label: string; icon: string }[] = [
  { key: "candles", label: "Candlesticks", icon: "candlestick_chart" },
  { key: "heikin",  label: "Heikin Ashi",  icon: "waterfall_chart" },
  { key: "bars",    label: "Bars (OHLC)",  icon: "bar_chart" },
  { key: "area",    label: "Area",         icon: "show_chart" },
];

const CHART_TYPE_KEY = "nz.forex.chartType";
function loadChartType(): ChartType {
  if (typeof window === "undefined") return "candles";
  const v = window.localStorage.getItem(CHART_TYPE_KEY);
  return v === "heikin" || v === "bars" || v === "area" ? v : "candles";
}

// Heikin Ashi smooths OHLC using the running average of the previous HA bar.
function toHeikinAshi(candles: Candle[]): CandlestickData<Time>[] {
  let prevOpen: number | undefined;
  let prevClose: number | undefined;
  return candles.map((c) => {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = prevOpen === undefined ? (c.open + c.close) / 2 : (prevOpen + prevClose!) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    prevOpen = haOpen;
    prevClose = haClose;
    return { time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose };
  });
}

// Map the full candle set to the shape the active series expects.
function seriesDataFor(type: ChartType, candles: Candle[]): unknown[] {
  if (type === "area") return candles.map((c) => ({ time: c.time, value: c.close }));
  if (type === "heikin") return toHeikinAshi(candles);
  return candles; // candles + bars both take OHLC
}

function TradingViewCandles({
  candles,
  market,
  bid,
  ask,
}: {
  candles: Candle[];
  market: ForexMarket;
  bid: number;
  ask: number;
}) {
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => { setChartType(loadChartType()); }, []);
  const chartTypeRef = useRef<ChartType>(chartType);
  useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);
  const candlesRef = useRef<Candle[]>(candles);
  useEffect(() => { candlesRef.current = candles; }, [candles]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Bar" | "Area"> | null>(null);
  const bidLineRef = useRef<IPriceLine | null>(null);
  const askLineRef = useRef<IPriceLine | null>(null);
  const lastBarRef = useRef<{ time: number; close: number } | null>(null);
  // Glide state: the forming bar's close eases toward the latest tick so the
  // line advances in small steps instead of one big jump per tick.
  const animRef = useRef<{ time: Time; open: number; high: number; low: number; target: number; shown: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0c0c0e" },
        // Match the Binary chart's typography for a consistent feel across games.
        textColor: "#8d99ae",
        fontFamily: "var(--font-jakarta), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.035)", style: 0 },
        horzLines: { color: "rgba(255,255,255,0.045)", style: 0 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.1 },
        minimumWidth: 64,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        // Denser default so the chart shows plenty of history at a glance
        // instead of a handful of fat, "zoomed-in" candles on open, and let the
        // line run right up to the price axis (no right-hand gap).
        rightOffset: 0,
        barSpacing: 7,
        minBarSpacing: 2,
        tickMarkFormatter: (time: Time) => fmtClock(time, false),
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(255,255,255,0.18)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#1f2937",
        },
        horzLine: {
          color: "rgba(255,255,255,0.18)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#1f2937",
        },
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(market, price),
        timeFormatter: (time: Time) => fmtClock(time, true),
      },
    });

    // Green bull / red bear, thin lines — consistent with the Binary chart.
    const priceFormat = { type: "price" as const, precision: market.precision, minMove: pipSize(market) };
    const UP = "#22c55e", DOWN = "#ef4444";
    const ohlcOpts = {
      upColor: UP, downColor: DOWN,
      borderUpColor: UP, borderDownColor: DOWN, borderVisible: true,
      wickUpColor: UP, wickDownColor: DOWN,
      priceLineVisible: false, lastValueVisible: false, priceFormat,
    };
    const series: ISeriesApi<"Candlestick" | "Bar" | "Area"> =
      chartType === "area"
        ? chart.addSeries(AreaSeries, {
            lineColor: UP, lineWidth: 1,
            topColor: "rgba(34,197,94,0.22)", bottomColor: "rgba(34,197,94,0.02)",
            priceLineVisible: false, lastValueVisible: false, priceFormat,
          })
        : chartType === "bars"
        ? chart.addSeries(BarSeries, {
            upColor: UP, downColor: DOWN, thinBars: true,
            priceLineVisible: false, lastValueVisible: false, priceFormat,
          })
        : chart.addSeries(CandlestickSeries, ohlcOpts);

    bidLineRef.current = series.createPriceLine({
      price: bid,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "",
    });
    askLineRef.current = series.createPriceLine({
      price: ask,
      color: "#087cff",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    // Seed the freshly-created series with whatever candles we already have (so
    // switching chart type doesn't blank the chart). Don't fitContent() — with a
    // few bars it stretches them wide (the "zoomed-in" look); keep the fixed
    // barSpacing and scroll to real time.
    const seed = candlesRef.current;
    if (seed.length) {
      series.setData(seriesDataFor(chartType, seed) as Parameters<typeof series.setData>[0]);
      const l = seed[seed.length - 1];
      lastBarRef.current = { time: l.time as number, close: l.close };
      animRef.current = { time: l.time, open: l.open, high: l.high, low: l.low, target: l.close, shown: l.close };
      chart.timeScale().scrollToRealTime();
    } else {
      animRef.current = null;
    }

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      bidLineRef.current = null;
      askLineRef.current = null;
    };
    // bid/ask lines are updated in a separate effect; recreate on market OR
    // chart-type change so the right series kind is rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, chartType]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (bidLineRef.current) {
      bidLineRef.current.applyOptions({ price: bid, color: "#ef4444" });
    }
    if (askLineRef.current) {
      askLineRef.current.applyOptions({ price: ask, color: "#087cff" });
    }
  }, [bid, ask]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || candles.length === 0) return;
    const type = chartTypeRef.current;

    const latest = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const last = lastBarRef.current;

    const sameBar = last !== null && latest.time === last.time;
    const appended =
      last !== null &&
      prev !== undefined &&
      prev.time === last.time &&
      prev.close === last.close &&
      latest.time > last.time;

    // Heikin Ashi bars depend on the previous HA bar, so they can't be updated
    // incrementally — recompute the set. Everything else eases via the rAF loop
    // below (set the target here; the loop steps the visible close toward it).
    if (type !== "heikin" && (sameBar || appended)) {
      const a = animRef.current;
      const shown = sameBar && a && a.time === latest.time ? a.shown : latest.open;
      animRef.current = {
        time: latest.time,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        target: latest.close,
        shown,
      };
      lastBarRef.current = { time: latest.time as number, close: latest.close };
      return;
    }

    series.setData(seriesDataFor(type, candles) as Parameters<typeof series.setData>[0]);
    animRef.current = { time: latest.time, open: latest.open, high: latest.high, low: latest.low, target: latest.close, shown: latest.close };
    lastBarRef.current = { time: latest.time as number, close: latest.close };
    chart.timeScale().scrollToRealTime();
  }, [candles]);

  // Glide loop: each frame, step the forming bar's visible close a fraction of
  // the way toward the latest tick, so the line/candle advances in small steps
  // rather than one big jump. Idle (no series.update) once it reaches the tick.
  useEffect(() => {
    const step = () => {
      rafRef.current = requestAnimationFrame(step);
      const a = animRef.current;
      const series = seriesRef.current;
      // Heikin Ashi is recomputed as a set, not eased — skip it here.
      if (!a || !series || chartTypeRef.current === "heikin") return;
      const diff = a.target - a.shown;
      if (Math.abs(diff) < 1e-9) return;
      // Snap when very close; otherwise ease ~28% per frame (~120ms to arrive).
      a.shown = Math.abs(diff) < 1e-7 ? a.target : a.shown + diff * 0.28;
      const shownData =
        chartTypeRef.current === "area"
          ? { time: a.time, value: a.shown }
          : { time: a.time, open: a.open, high: Math.max(a.high, a.shown), low: Math.min(a.low, a.shown), close: a.shown };
      series.update(shownData as Parameters<typeof series.update>[0]);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const current = ts.options().barSpacing ?? 7;
    ts.applyOptions({ barSpacing: Math.min(60, Math.max(2, current * factor)) });
  };

  const recenter = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    ts.applyOptions({ barSpacing: 7 });
    ts.scrollToRealTime();
  };

  const selectType = (t: ChartType) => {
    setChartType(t);
    try { window.localStorage.setItem(CHART_TYPE_KEY, t); } catch { /* ignore */ }
    setPickerOpen(false);
  };
  const activeType = CHART_TYPES.find((t) => t.key === chartType) ?? CHART_TYPES[0];

  return (
    <div className="relative h-full min-h-[240px] overflow-hidden bg-[#0c0c0e] sm:min-h-[280px]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Chart-type picker (top-right) */}
      <div className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          title="Chart type"
          aria-label="Chart type"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1a1b20]/95 px-2.5 text-slate-200 ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-[#22242a] active:scale-[0.97]"
        >
          <Icon name={activeType.icon} className="text-[17px]" />
          <Icon name="expand_more" className="text-[16px] text-slate-500" />
        </button>
        {pickerOpen && (
          <>
            <button type="button" aria-label="Close" onClick={() => setPickerOpen(false)} className="fixed inset-0 z-[-1] cursor-default" />
            <div className="absolute right-0 mt-1.5 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[#151518] py-1 shadow-2xl">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectType(t.key)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold transition hover:bg-white/[0.05] ${chartType === t.key ? "text-[#75b8ff]" : "text-slate-200"}`}
                >
                  <Icon name={t.icon} className="text-[18px]" />
                  <span className="flex-1">{t.label}</span>
                  {chartType === t.key && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-3 left-2 z-10 flex gap-1.5 sm:bottom-4 sm:left-3">
        <button type="button" onClick={() => zoom(1.3)} title="Zoom in" aria-label="Zoom in"
          className="grid h-9 w-9 place-items-center rounded-lg bg-[#1a1b20]/95 text-slate-200 ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-[#22242a] active:scale-[0.97]">
          <Icon name="add" className="text-[16px]" />
        </button>
        <button type="button" onClick={recenter} title="Latest" aria-label="Scroll to latest"
          className="grid h-9 w-9 place-items-center rounded-lg bg-[#1a1b20]/95 text-slate-200 ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-[#22242a] active:scale-[0.97]">
          <Icon name="my_location" className="text-[15px]" />
        </button>
        <button type="button" onClick={() => zoom(1 / 1.3)} title="Zoom out" aria-label="Zoom out"
          className="grid h-9 w-9 place-items-center rounded-lg bg-[#1a1b20]/95 text-slate-200 ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-[#22242a] active:scale-[0.97]">
          <Icon name="remove" className="text-[16px]" />
        </button>
      </div>
    </div>
  );
}

function ForexNativeTabBar({
  panel,
  positionsCount,
}: {
  panel: string | null;
  positionsCount: number;
}) {
  const tabs = [
    { key: "menu", label: "Menu", icon: "menu", href: null as string | null },
    { key: "markets", label: "Markets", icon: "candlestick_chart", href: "/forex?panel=markets" },
    { key: "trade", label: "Trade", icon: "show_chart", href: "/forex" },
    { key: "positions", label: "Positions", icon: "schedule", href: "/forex?panel=positions" },
  ] as const;

  return (
    <nav className="fixed bottom-[max(0.6rem,env(safe-area-inset-bottom))] left-3 right-3 z-50 flex h-14 items-center justify-around gap-1 rounded-2xl border border-white/[0.08] bg-[#1c1c1e]/92 px-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden">
      {tabs.map((tab) => {
        const active =
          tab.key === "trade" ? !panel || panel === "" :
          tab.key === "markets" ? panel === "markets" :
          tab.key === "positions" ? panel === "positions" :
          false;
        if (tab.key === "menu") {
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => window.dispatchEvent(new Event("neemiz:open-menu"))}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset"
            >
              <Icon name={tab.icon} className="text-[20px]" />
              <span className="mt-0.5 font-bold leading-none">{tab.label}</span>
            </button>
          );
        }
        return (
          <Link
            key={tab.key}
            href={tab.href!}
            prefetch={false}
            className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset ${
              active ? "text-[#087cff]" : "text-on-surface-variant"
            }`}
          >
            <span className="relative">
              <Icon name={tab.icon} fill={active} className="text-[20px]" />
              {tab.key === "positions" && positionsCount > 0 && (
                <span className="absolute -right-2 -top-2 grid min-w-4 h-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-[#151518]">
                  {positionsCount > 99 ? "99+" : positionsCount}
                </span>
              )}
            </span>
            <span className="mt-0.5 font-bold leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ForexClient() {
  const { format } = useMoney(); // KES amounts → active display currency
  const wallet = useWalletBalance();
  const { openWallet } = useAuthModal();
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [direction, setDirection] = useState<Direction>("buy");
  const [size, setSize] = useState(10000);
  const [riskPips, setRiskPips] = useState(25);
  const [targetPips, setTargetPips] = useState(45);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [openingTrade, setOpeningTrade] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [forexHistory, setForexHistory] = useState<ClosedTrade[]>([]);
  const [activityTab, setActivityTab] = useState<"open" | "history" | "tx">("open");
  // Desktop activity rail is collapsed by default to give the chart room; it
  // pops open the moment a position is opened (mirrors the Binary rail).
  const [railOpen, setRailOpen] = useState(false);
  const autoClosingRef = useRef<Set<string>>(new Set());

  // Mobile bottom-nav panels (Markets / Positions) are URL-driven via `?panel=`,
  // mirroring binary. Trade is the base view (no param).
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  // Funding moved to the main Wallet — old ?panel=funding links redirect there.
  useEffect(() => {
    if (panel === "funding") router.replace("/wallet");
  }, [panel, router]);
  const section: ForexSection = panel === "discover" ? "discover" : "trade";
  const marketsOpen = panel === "markets";
  const positionsOpen = panel === "positions";
  const closePanel = useCallback(() => { router.replace(pathname, { scroll: false }); }, [router, pathname]);

  const selectedMarket = MARKETS.find((item) => item.symbol === selectedSymbol) ?? MARKETS[0];

  // Badge the Positions bottom-nav tab with the open-trade count (like binary).
  const setNavBadge = useNavBadge()?.setBadge;
  useEffect(() => {
    setNavBadge?.("positions", trades.length);
    return () => setNavBadge?.("positions", 0);
  }, [setNavBadge, trades.length]);

  useEffect(() => {
    let active = true;
    let retryCount = 0;
    let retryTimer: number | undefined;
    let dataTimer: number | undefined;
    let gotData = false;
    let socket: WebSocket | undefined;

    setCandles([]);
    setStreamStatus("connecting");
    setStreamError(null);

    // Watchdog: the socket can open but then stall (slow link / Deriv never
    // sends history). Without this the chart sits on "Loading live candles"
    // forever. After the grace period, drop to fallback candles so the user
    // always sees a chart instead of a permanent spinner.
    const WS_DATA_TIMEOUT = 6000;
    function armWatchdog() {
      if (dataTimer) window.clearTimeout(dataTimer);
      dataTimer = window.setTimeout(() => {
        if (!active || gotData) return;
        setStreamStatus("fallback");
        setStreamError("Live feed is slow to respond. Reconnecting…");
        setCandles((current) => current.length ? current : buildFallbackCandles(selectedMarket));
      }, WS_DATA_TIMEOUT);
    }

    function connect() {
      if (!active) return;
      socket = new WebSocket(DERIV_WS_URL);
      armWatchdog();

      socket.onopen = () => {
        if (!active || !socket) return;
        retryCount = 0;
        // Two requests on the one socket:
        //  1) ready-made OHLC candle history (reliable bars — fixes the old
        //     "only 2 candles" bug from rebuilding history out of raw ticks).
        //  2) a live tick subscription that drives the forming bar every tick,
        //     so the chart actually moves second-to-second instead of only
        //     jumping when a minute closes.
        socket.send(JSON.stringify({
          ticks_history: selectedMarket.derivSymbol,
          adjust_start_time: 1,
          count: 200,
          end: "latest",
          style: "candles",
          granularity: CANDLE_SECONDS,
        }));
        socket.send(JSON.stringify({
          ticks: selectedMarket.derivSymbol,
          subscribe: 1,
        }));
      };

      socket.onmessage = (event) => {
        if (!active) return;

        let response: {
          error?: { message?: string };
          candles?: { epoch: number; open: number; high: number; low: number; close: number }[];
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

        // Initial OHLC snapshot — the full history of bars for this market.
        if (response.candles?.length) {
          gotData = true;
          if (dataTimer) window.clearTimeout(dataTimer);
          const historyCandles: Candle[] = response.candles
            .map((c) => ({
              time: bucketTime(c.epoch),
              open: c.open, high: c.high, low: c.low, close: c.close,
            }))
            .slice(-180);
          setCandles(historyCandles);
          setStreamStatus("live");
          setStreamError(null);
        }

        // Live tick — fold it into the forming bar (or start a new one at the
        // top of the minute) so the candle grows in real time.
        if (response.tick) {
          gotData = true;
          if (dataTimer) window.clearTimeout(dataTimer);
          const { epoch, quote } = response.tick;
          const time = bucketTime(epoch);
          setCandles((current) => {
            const last = current[current.length - 1];
            if (last && last.time === time) {
              return [
                ...current.slice(0, -1),
                { ...last, high: Math.max(last.high, quote), low: Math.min(last.low, quote), close: quote },
              ];
            }
            const open = last?.close ?? quote;
            return [...current, { time, open, high: Math.max(open, quote), low: Math.min(open, quote), close: quote }].slice(-180);
          });
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
      if (dataTimer) window.clearTimeout(dataTimer);
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
  // KSh value per pip for the chosen size — same basis used for P/L elsewhere.
  const pipValueKes = size / 10000;
  const riskKes = riskPips * pipValueKes;
  const rewardKes = targetPips * pipValueKes;
  const rrRatio = riskPips > 0 ? targetPips / riskPips : 0;
  const lots = size / 100000;
  const openTrades = trades;
  const exposure = openTrades.reduce((total, trade) => total + trade.size, 0);

  // Track the direction of the latest tick so the header price can flash
  // green/red on every move — makes the live feed obviously "alive" even when
  // forex only ticks a fraction of a pip at a time.
  const prevPriceRef = useRef(price);
  const [tickDir, setTickDir] = useState<"up" | "down" | "flat">("flat");
  const [tickKey, setTickKey] = useState(0);
  useEffect(() => {
    const prev = prevPriceRef.current;
    if (price > prev) setTickDir("up");
    else if (price < prev) setTickDir("down");
    if (price !== prev) setTickKey((k) => k + 1);
    prevPriceRef.current = price;
  }, [price]);
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

  // Auto-expand the desktop rail as soon as there's something to watch.
  const hasOpenPositions = trades.length > 0;
  useEffect(() => {
    if (hasOpenPositions) setRailOpen(true);
  }, [hasOpenPositions]);

  async function openTrade(nextDirection: Direction = direction) {
    if (openingTrade) return; // guard double-taps now that the button stays live
    setTradeError(null);
    setOpeningTrade(true);
    // Instant feedback the moment the button is tapped — don't wait for the server.
    placed();
    toast.info(`${nextDirection === "buy" ? "Buy" : "Sell"} ${selectedMarket.symbol}`, `Size ${size} @ ${price.toFixed(selectedMarket.precision)}`);
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
        const msg = data.error ?? "Failed to open trade";
        setTradeError(msg);
        toast.error(msg);
        return;
      }
      setTrades((current) => [data as Trade, ...current]);
      window.dispatchEvent(new Event("wallet-refresh"));
      // Surface the new position in the activity rail right away.
      setActivityTab("open");
      setRailOpen(true);
    } catch {
      const msg = "Network error — please try again";
      setTradeError(msg);
      toast.error(msg);
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
        const msg = data.error ?? "Failed to close trade";
        setTradeError(msg);
        toast.error(msg);
        return;
      }
      setTrades((current) => current.filter((t) => t.id !== id));
      window.dispatchEvent(new Event("wallet-refresh"));
      // Win = green, loss = red.
      const pl = data.profitLoss;
      if (typeof pl === "number") {
        if (pl >= 0) toast.cashout(`Closed +${format(pl)}`, trade.symbol);
        else toast.loss(`Closed −${format(Math.abs(pl))}`, trade.symbol);
      }
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
        setActivityTab("history");
      }
    } catch {
      const msg = "Network error — please try again";
      setTradeError(msg);
      toast.error(msg);
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
            setActivityTab("history");
          })
          .catch(() => autoClosingRef.current.delete(trade.id));
      }
    }
  }, [price, trades]);

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-[#0c0c0e] text-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:block sm:h-auto sm:min-h-full sm:overflow-x-hidden sm:pb-8 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:pb-0">
      {/* Native top chrome — replaces logo / bell / wallet shell header */}
      <header className="grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 border-b border-white/[0.06] bg-[#0c0c0e] px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:hidden">
        <Link
          href="/dashboard"
          aria-label="Back to home"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-300 transition active:bg-white/[0.06]"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </Link>
        <button
          type="button"
          onClick={() => router.replace(`${pathname}?panel=markets`, { scroll: false })}
          className="min-w-0 text-center"
        >
          <div className="truncate text-[15px] font-black tracking-tight text-white">
            {selectedMarket.symbol.replace("/", "")}
          </div>
          <div className="truncate text-[10px] font-medium text-slate-500">{selectedMarket.name}</div>
        </button>
        <button
          type="button"
          onClick={() => openWallet()}
          aria-label="Open wallet"
          className="grid h-9 w-9 place-items-center rounded-full text-[#087cff] transition active:bg-white/[0.06]"
        >
          <Icon name="account_balance_wallet" fill className="text-[20px]" />
        </button>
      </header>

      {streamStatus === "fallback" && (() => {
        const isClosed = /closed|presently closed|market.*open/i.test(streamError ?? "");
        return isClosed ? (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 sm:px-4">
            <span className="sm:hidden">
              🕒 Markets closed for the weekend.{" "}
              <a href="/binary" className="underline decoration-amber-400/60 underline-offset-2">Trade Binary</a>
            </span>
            <span className="hidden sm:inline">
              🕒 Forex markets are closed on weekends — {selectedMarket.symbol} trading reopens when the week starts (Sunday evening UTC).
              Meanwhile, <a href="/binary" className="underline decoration-amber-400/60 underline-offset-2 hover:text-white">Binary</a> and <a href="/aviator" className="underline decoration-amber-400/60 underline-offset-2 hover:text-white">Aviator</a> run live 24/7.
            </span>
          </div>
        ) : (
          <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300">
            ⚠ Live feed unavailable — trading disabled.{streamError ? ` ${streamError}` : ""} Reconnecting automatically.
          </div>
        );
      })()}

      {section === "discover" ? (
        <ForexDiscoverNews />
      ) : (
      <div data-forex-grid="true" className={`flex min-h-0 flex-1 flex-col max-w-full min-w-0 gap-1 overflow-hidden px-0 py-0 sm:grid sm:overflow-visible sm:px-2 sm:py-2 xl:min-h-0 xl:flex-1 xl:gap-0 xl:overflow-hidden xl:p-0 ${railOpen ? "xl:grid-cols-[300px_minmax(0,1fr)_340px]" : "xl:grid-cols-[44px_minmax(0,1fr)_340px]"}`}>
        <aside className="order-2 hidden min-h-0 flex-col overflow-hidden rounded border border-white/[0.08] xl:order-none xl:flex xl:rounded-none xl:border-y-0 xl:border-l-0 xl:border-r">
          {railOpen ? (
            <ForexActivityPanel
              tab={activityTab} setTab={setActivityTab}
              openTrades={trades} forexHistory={forexHistory}
              price={price} closingId={closingId} closeTrade={closeTrade}
              onCollapse={() => setRailOpen(false)}
            />
          ) : (
            <CollapsedActivityRail openCount={trades.length} onExpand={() => setRailOpen(true)} />
          )}
        </aside>

        <main className="order-1 flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden rounded-none border-y border-white/[0.08] sm:min-h-[520px] sm:flex-none sm:rounded sm:border xl:order-none xl:min-h-0 xl:rounded-none xl:border-0">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0c0c0e]">
            <div className="hidden shrink-0 flex-col gap-2 border-b border-white/[0.07] px-2 py-1.5 sm:flex sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PairDropdown markets={MARKETS} selected={selectedMarket} price={price} streamStatus={streamStatus} onSelect={setSelectedSymbol} />
                  <span className={`rounded px-2 py-1 text-[10px] font-black ${changePct >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                    {changePct >= 0 ? "+" : ""}{changePct.toFixed(3)}%
                  </span>
                  <LiveTicker price={formatPrice(selectedMarket, price)} dir={tickDir} flashKey={tickKey} live={streamStatus === "live"} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-600">Open P/L</div>
                  <div className={`font-mono text-sm font-black ${estimatedPnl > 0 ? "text-emerald-300" : estimatedPnl < 0 ? "text-red-300" : "text-white"}`}>
                    {estimatedPnl >= 0 ? "+" : ""}{estimatedPnl.toFixed(1)} pips
                  </div>
                </div>
                <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-right sm:w-auto">
                  <QuoteBox label="Bid" value={formatPrice(selectedMarket, bid)} tone="sell" />
                  <QuoteBox label="Ask" value={formatPrice(selectedMarket, ask)} tone="buy" />
                </div>
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              {/* Mobile quotes strip — bid/ask over the chart (pair title is in the native header) */}
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-[#0c0c0e] via-[#0c0c0e]/80 to-transparent px-3 pb-6 pt-1.5 sm:hidden">
                <div className="flex items-baseline gap-2 font-mono text-[12px] font-black">
                  <span className="text-[#ef4444]">{formatPrice(selectedMarket, bid)}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-[#087cff]">{formatPrice(selectedMarket, ask)}</span>
                  <span className={`text-[10px] ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {changePct >= 0 ? "+" : ""}{changePct.toFixed(3)}%
                  </span>
                </div>
                {openTrades.length > 0 && (
                  <button
                    type="button"
                    onClick={() => router.replace(`${pathname}?panel=positions`, { scroll: false })}
                    className="shrink-0 rounded-lg bg-black/40 px-2 py-1 text-right ring-1 ring-white/[0.08] backdrop-blur"
                  >
                    <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                      Open ({openTrades.length})
                    </div>
                    <div className={`font-mono text-[11px] font-black tabular-nums ${estimatedPnl > 0 ? "text-emerald-300" : estimatedPnl < 0 ? "text-red-300" : "text-white"}`}>
                      {estimatedPnl >= 0 ? "+" : ""}{estimatedPnl.toFixed(1)} pips
                    </div>
                  </button>
                )}
              </div>
              <TradingViewCandles candles={chartCandles} market={selectedMarket} bid={bid} ask={ask} />
              {chartCandles.length === 0 && (
                <div className="absolute inset-0 grid place-items-center bg-[#0c0c0e]/80">
                  <div className="rounded-lg border border-white/[0.08] bg-[#14151a]/90 px-4 py-3 text-center shadow-2xl shadow-black/30">
                    <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />
                    <p className="text-xs font-black text-white">Loading live candles</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Waiting for Deriv history for {selectedMarket.symbol}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="hidden shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.08] bg-[#0c0c0e] px-3 py-1.5 text-[11px] sm:flex sm:px-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Session</span>
            <span className="flex items-center gap-1.5"><span className="font-bold text-slate-500">High</span><span className="font-mono font-black text-emerald-300">{formatPrice(selectedMarket, levels.high)}</span></span>
            <span className="flex items-center gap-1.5"><span className="font-bold text-slate-500">Avg</span><span className="font-mono font-black text-white">{formatPrice(selectedMarket, levels.average)}</span></span>
            <span className="flex items-center gap-1.5"><span className="font-bold text-slate-500">Low</span><span className="font-mono font-black text-red-300">{formatPrice(selectedMarket, levels.low)}</span></span>
          </section>
        </main>

        <aside className="order-2 shrink-0 min-w-0 overflow-hidden rounded-t-2xl border border-white/[0.08] bg-[#18191f] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 sm:rounded sm:border xl:order-none xl:block xl:min-h-0 xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l">
          <section className="flex h-full min-h-0 flex-col xl:h-full xl:min-h-0">
            {/* Mobile chart-first ticket dock (sm:hidden); desktop/tablet ticket below */}
            <MobileForexTicket
              symbol={selectedMarket.symbol}
              direction={direction} setDirection={setDirection}
              bidLabel={formatPrice(selectedMarket, bid)} askLabel={formatPrice(selectedMarket, ask)}
              entryLabel={formatPrice(selectedMarket, price)}
              stopLabel={formatPrice(selectedMarket, stopLoss)}
              targetLabel={formatPrice(selectedMarket, takeProfit)}
              size={size} setSize={setSize} lots={lots} sizePresets={SIZES}
              riskPips={riskPips} setRiskPips={setRiskPips}
              targetPips={targetPips} setTargetPips={setTargetPips}
              rrPresets={RR_PRESETS}
              riskKes={riskKes} rewardKes={rewardKes} rrRatio={rrRatio}
              marginKes={calcMargin(size)}
              forexBalance={wallet.forexBalance}
              tradeError={tradeError}
              onDismissError={() => setTradeError(null)}
              onOpen={() => openTrade()} opening={openingTrade} live={streamStatus === "live"}
            />
            <div className="hidden sm:flex sm:flex-col xl:h-full xl:min-h-0">
            <div className="shrink-0 border-b border-white/[0.07] px-3 py-2 sm:px-4 sm:py-3">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Order ticket</div>
              <div className="mt-1 text-base font-black text-white sm:text-lg">{selectedMarket.symbol} {direction.toUpperCase()}</div>
            </div>
            <div className="space-y-2 p-2 sm:space-y-3 sm:p-4 xl:min-h-0 xl:overflow-y-auto">
              {/* Buy / Sell live-quote toggle — each side shows the price it fills at */}
              <div className="grid grid-cols-2 gap-2">
                <QuoteToggle
                  active={direction === "buy"} tone="buy" label="Buy"
                  price={formatPrice(selectedMarket, ask)}
                  onClick={() => setDirection("buy")}
                />
                <QuoteToggle
                  active={direction === "sell"} tone="sell" label="Sell"
                  price={formatPrice(selectedMarket, bid)}
                  onClick={() => setDirection("sell")}
                />
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500" htmlFor="forex-size">
                    Position size
                  </label>
                  <span className="font-mono text-[11px] font-black text-sky-300">{lots.toFixed(2)} lots</span>
                </div>
                <input
                  id="forex-size"
                  type="number"
                  min={1000}
                  step={1000}
                  value={size}
                  onChange={(event) => setSize(Math.max(1000, Number(event.target.value) || 1000))}
                  className="h-10 w-full rounded border border-white/[0.08] bg-black/25 px-4 font-mono text-base font-black text-white outline-none transition focus:border-[#087cff]/70"
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

              {/* Quick R:R presets — one tap sets both SL and TP to a common
                  risk/reward shape, so beginners don't have to type pips. */}
              <div className="grid grid-cols-4 gap-1.5">
                {RR_PRESETS.map((preset) => {
                  const active = riskPips === preset.sl && targetPips === preset.tp;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => { setRiskPips(preset.sl); setTargetPips(preset.tp); }}
                      className={`rounded px-1 py-1.5 text-[10px] font-black transition ${active ? "bg-[#087cff] text-white" : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-white"}`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Risk / Reward — pip inputs as real money plus the R:R ratio,
                  packed into one compact row to keep the Open button in view. */}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Risk</span>
                  <span className="font-mono text-[11px] font-black text-[#ff6171]">−{format(riskKes)}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Reward</span>
                  <span className="font-mono text-[11px] font-black text-[#33d49b]">+{format(rewardKes)}</span>
                </div>
                <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-black ${rrRatio >= 1 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                  1:{rrRatio.toFixed(2)}
                </span>
              </div>

              {/* Entry / SL / TP price chips */}
              <div className="grid grid-cols-3 gap-2">
                <PriceChip label="Entry" value={formatPrice(selectedMarket, price)} />
                <PriceChip label="Stop" value={formatPrice(selectedMarket, stopLoss)} tone="sell" />
                <PriceChip label="Target" value={formatPrice(selectedMarket, takeProfit)} tone="buy" />
              </div>

              {/* Margin the server will reserve for this position. */}
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Margin required</span>
                <span className="font-mono text-sm font-black text-white">{format(calcMargin(size))}</span>
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
                aria-busy={openingTrade}
                disabled={streamStatus !== "live"}
                className={`hidden w-full rounded-lg py-4 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 xl:block ${
                  direction === "buy"
                    ? "bg-gradient-to-b from-[#16b87b] to-[#0f9f68] hover:from-[#1ac98a] hover:to-[#13ae73]"
                    : "bg-gradient-to-b from-[#e8505f] to-[#d33d4b] hover:from-[#f25a69] hover:to-[#e24755]"
                }`}
              >
                {streamStatus !== "live" ? "Awaiting live feed…" : `Open ${direction.toUpperCase()} ${selectedMarket.symbol}`}
              </button>

              <p className="hidden text-center text-[10px] font-bold leading-relaxed text-slate-600 xl:block">
                Watch the pips — green means profit.<br />
                Your trade closes automatically at Stop Loss / Take Profit.<br />
                Positions &amp; history live in the panel on the left.
              </p>
            </div>
            </div>
          </section>
        </aside>
      </div>
      )}

      {/* Mobile Positions — sits above the native forex tab bar */}
      {positionsOpen && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] top-0 z-40 flex flex-col overflow-hidden bg-[#0c0c0e] pt-[env(safe-area-inset-top)] sm:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Forex</p>
              <h2 className="text-[16px] font-black text-white">Positions</h2>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-slate-300 ring-1 ring-white/[0.06] transition hover:bg-white/[0.1] hover:text-white"
              aria-label="Close positions"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ForexActivityPanel
              tab={activityTab} setTab={setActivityTab}
              openTrades={trades} forexHistory={forexHistory}
              price={price} closingId={closingId} closeTrade={closeTrade}
            />
          </div>
        </div>
      )}

      {/* Mobile pair picker — opened by the Markets tab (?panel=markets). */}
      {marketsOpen && (
        <ForexPairSheet
          markets={MARKETS}
          current={selectedMarket.symbol}
          onSelect={(sym) => { setSelectedSymbol(sym); closePanel(); }}
          onClose={closePanel}
        />
      )}

      {/* Sticky tablet CTA — no global bottom nav in immersive mode */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 hidden border-t border-white/[0.08] bg-[#18191f]/95 p-2 shadow-[0_-12px_24px_rgba(0,0,0,.45)] backdrop-blur sm:block xl:hidden ${positionsOpen || marketsOpen || section !== "trade" ? "sm:hidden" : ""}`}>
        <button
          type="button"
          onClick={() => openTrade()}
          aria-busy={openingTrade}
          disabled={streamStatus !== "live"}
          className={`flex min-h-14 w-full items-center justify-between rounded-lg px-4 text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
            direction === "buy"
              ? "bg-gradient-to-b from-[#16b87b] to-[#0f9f68]"
              : "bg-gradient-to-b from-[#e8505f] to-[#d33d4b]"
          }`}
        >
          <span className="text-sm font-black">
            {streamStatus !== "live" ? "Awaiting live feed…" : `Open ${direction.toUpperCase()} ${selectedMarket.symbol}`}
          </span>
          {streamStatus === "live" && !openingTrade && (
            <span className="font-mono text-sm font-black">{formatPrice(selectedMarket, direction === "buy" ? ask : bid)}</span>
          )}
        </button>
      </div>

      <ForexNativeTabBar panel={panel} positionsCount={trades.length} />
    </div>
  );
}

type DiscoverNewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string | null;
};

function ForexDiscoverNews() {
  const [items, setItems] = useState<DiscoverNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/forex/news")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load news");
        return r.json() as Promise<{ items?: DiscoverNewsItem[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("News feed unavailable right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function relativeTime(iso: string | null): string {
    if (!iso) return "";
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#151518] px-4 pb-24 pt-5 text-white sm:px-6 sm:pb-10">
      <div className="mx-auto flex max-w-lg flex-col">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Discover</p>
            <h1 className="mt-1 text-lg font-black">Market news</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetch("/api/forex/news")
                .then((r) => r.json())
                .then((d: { items?: DiscoverNewsItem[] }) => setItems(d.items ?? []))
                .finally(() => setLoading(false));
            }}
            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-slate-300 ring-1 ring-white/[0.06] transition hover:bg-white/[0.1] hover:text-white"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#18191f] ring-1 ring-white/[0.06]" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-red-500/10 px-4 py-6 text-center text-[13px] font-bold text-red-300 ring-1 ring-red-500/20">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl bg-[#18191f] px-4 py-10 text-center ring-1 ring-white/[0.06]">
            <p className="text-sm font-black text-white">No headlines yet</p>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">Try refresh in a moment.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl bg-[#18191f] p-3.5 ring-1 ring-white/[0.06] transition hover:bg-white/[0.04] hover:ring-white/[0.1]"
                >
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <span className="text-[#75b8ff]">{item.source}</span>
                    {item.publishedAt && (
                      <>
                        <span>·</span>
                        <span>{relativeTime(item.publishedAt)}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-[14px] font-black leading-snug text-white">{item.title}</p>
                  {item.summary && (
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-slate-500">
                      {item.summary}
                    </p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

// Rich pair picker — restores the old watchlist detail (symbol + full name +
// indicative price) inside a compact dropdown.
function PairDropdown({ markets, onSelect, price, selected, streamStatus }: {
  markets: ForexMarket[];
  onSelect: (symbol: string) => void;
  price: number;
  selected: ForexMarket;
  streamStatus: StreamStatus;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded border border-white/[0.08] bg-[#18191f] px-2 text-sm font-black text-white outline-none transition hover:border-white/20 sm:h-10 sm:px-3"
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-sky-400/15 text-[9px] font-black text-sky-300">FX</span>
        {selected.symbol}
        <Icon name="expand_more" className={`text-[18px] text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 overflow-hidden rounded-lg border border-white/[0.1] bg-[#18191f] shadow-2xl shadow-black/50">
          <div className="max-h-[60vh] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {markets.map((market) => {
              const isSelected = market.symbol === selected.symbol;
              const isLive = isSelected && streamStatus === "live";
              return (
                <button
                  key={market.symbol}
                  type="button"
                  onClick={() => { onSelect(market.symbol); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 border-b border-white/[0.05] px-3 py-2.5 text-left transition last:border-0 ${isSelected ? "bg-sky-400/10" : "hover:bg-white/[0.04]"}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white">{market.symbol}</div>
                    <div className="truncate text-[11px] font-bold text-slate-500">{market.name}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs font-black text-slate-300">{formatPrice(market, isSelected ? price : market.fallbackPrice)}</div>
                    <div className={`text-[9px] font-black uppercase tracking-wider ${isLive ? "text-emerald-400" : "text-slate-600"}`}>{isLive ? "● live" : "deriv"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type ActivityTab = "open" | "history" | "tx";

interface ForexActivityProps {
  tab: ActivityTab;
  setTab: (t: ActivityTab) => void;
  openTrades: Trade[];
  forexHistory: ClosedTrade[];
  price: number;
  closingId: string | null;
  closeTrade: (id: string) => void;
  onCollapse?: () => void;
}

// A single line in the Transactions tab, derived client-side from the trades we
// already hold — open positions become "reserved margin" rows, closed trades
// become win/loss settlement rows. Mirrors Binary's Tx tab without a new route.
type ForexTx = {
  id: string;
  kind: "stake" | "win" | "loss";
  symbol: string;
  amount: number; // signed KES: negative = out of wallet, positive = credited
  at: number;
};

function buildForexTransactions(openTrades: Trade[], history: ClosedTrade[]): ForexTx[] {
  const stakes: ForexTx[] = openTrades.map((t) => ({
    id: `stake-${t.id}`,
    kind: "stake",
    symbol: t.symbol,
    amount: -(t.margin ?? calcMargin(t.size)),
    at: t.openedAt,
  }));
  const settlements: ForexTx[] = history.map((t) => {
    const pl = t.profitLoss ?? 0;
    return {
      id: `settle-${t.id}`,
      kind: pl >= 0 ? "win" : "loss",
      symbol: t.symbol,
      amount: pl,
      at: t.closedAt ?? t.openedAt,
    };
  });
  return [...stakes, ...settlements].sort((a, b) => b.at - a.at).slice(0, 40);
}

// Shared Positions / History tabs — used by the desktop left rail and the
// mobile collapsible, so both surfaces show identical detail (mirrors Binary).
function ForexActivityPanel({ tab, setTab, openTrades, forexHistory, price, closingId, closeTrade, onCollapse }: ForexActivityProps) {
  const transactions = useMemo(() => buildForexTransactions(openTrades, forexHistory), [openTrades, forexHistory]);

  return (
    <>
      <ForexSessionStats openTrades={openTrades} forexHistory={forexHistory} price={price} />

      <div className="flex shrink-0 items-stretch border-b border-white/[0.06] bg-[#151518] text-xs font-black">
        {(["open", "history", "tx"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-3 transition ${tab === t ? "border-b-2 border-[#087cff] text-white" : "text-slate-500 hover:text-white"}`}
          >
            {t === "open" ? `Open (${openTrades.length})` : t === "history" ? `Closed (${forexHistory.length})` : "Activity"}
          </button>
        ))}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse panel"
            aria-label="Collapse panel"
            className="grid w-9 shrink-0 place-items-center border-l border-white/[0.06] text-slate-500 transition hover:bg-white/[0.04] hover:text-white"
          >
            <Icon name="remove" className="text-[18px]" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#151518]">
        {tab === "open" && (
          <div className="space-y-2 p-3">
            {openTrades.length === 0 ? (
              <div className="rounded-2xl bg-[#18191f] px-4 py-10 text-center ring-1 ring-white/[0.06]">
                <p className="text-[13px] font-black text-white">No open positions</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Open a trade from the chart to see it here.</p>
              </div>
            ) : (
              openTrades.map((trade) => (
                <PositionRow key={trade.id} currentPrice={price} onClose={() => closeTrade(trade.id)} trade={trade} closing={closingId === trade.id} />
              ))
            )}
          </div>
        )}
        {tab === "history" && (
          <div className="space-y-2 p-3">
            {forexHistory.length === 0 ? (
              <div className="rounded-2xl bg-[#18191f] px-4 py-10 text-center ring-1 ring-white/[0.06]">
                <p className="text-[13px] font-black text-white">No closed trades yet</p>
              </div>
            ) : (
              forexHistory.map((trade) => <HistoryRow key={trade.id} trade={trade} />)
            )}
          </div>
        )}
        {tab === "tx" && (
          <div className="space-y-1.5 p-3">
            {transactions.length === 0 ? (
              <div className="rounded-2xl bg-[#18191f] px-4 py-10 text-center ring-1 ring-white/[0.06]">
                <p className="text-[13px] font-black text-white">No activity yet</p>
              </div>
            ) : (
              transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
            )}
          </div>
        )}
      </div>
    </>
  );
}

// Session summary — realized result from this session's closed trades plus the
// live unrealized P/L across open positions. Mirrors Binary's rail stats.
function ForexSessionStats({ openTrades, forexHistory, price }: { openTrades: Trade[]; forexHistory: ClosedTrade[]; price: number }) {
  const { format } = useMoney();
  const wins = forexHistory.filter((t) => (t.profitLoss ?? 0) >= 0).length;
  const losses = forexHistory.length - wins;
  const realized = forexHistory.reduce((sum, t) => sum + (t.profitLoss ?? 0), 0);
  const unrealized = openTrades.reduce((sum, t) => {
    const pips = getPips(t.entry, price, t);
    return sum + (t.direction === "buy" ? pips : -pips) * (t.size / 10000);
  }, 0);

  return (
    <div className="grid shrink-0 grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.07] bg-[#151518]">
      <div className="px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-600">W / L</div>
        <div className="mt-0.5 font-mono text-sm font-black text-white">
          <span className="text-[#33d49b]">{wins}</span>
          <span className="text-slate-600"> / </span>
          <span className="text-[#ff6171]">{losses}</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-600">Realized</div>
        <div className={`mt-0.5 font-mono text-sm font-black ${realized > 0 ? "text-[#33d49b]" : realized < 0 ? "text-[#ff6171]" : "text-white"}`}>
          {realized >= 0 ? "+" : "−"}{format(Math.abs(realized))}
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-600">Open P/L</div>
        <div className={`mt-0.5 font-mono text-sm font-black ${unrealized > 0 ? "text-[#33d49b]" : unrealized < 0 ? "text-[#ff6171]" : "text-white"}`}>
          {unrealized >= 0 ? "+" : "−"}{format(Math.abs(unrealized))}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: ForexTx }) {
  const { format } = useMoney();
  const label = tx.kind === "stake" ? "Margin reserved" : tx.kind === "win" ? "Trade closed · profit" : "Trade closed · loss";
  const positive = tx.amount >= 0;
  const time = new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeStyle: "short" }).format(new Date(tx.at));
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#18191f] px-3 py-2.5 ring-1 ring-white/[0.05]">
      <div className="min-w-0">
        <div className="truncate text-xs font-black text-slate-200">{tx.symbol} · {label}</div>
        <div className="text-[10px] font-bold text-slate-600">{time}</div>
      </div>
      <div className={`shrink-0 font-mono text-xs font-black ${positive ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
        {positive ? "+" : "−"}{format(Math.abs(tx.amount))}
      </div>
    </div>
  );
}

// Narrow collapsed state of the desktop activity rail — a thin strip with an
// expand control and a badge for any open positions.
function CollapsedActivityRail({ openCount, onExpand }: { openCount: number; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      title="Expand positions"
      aria-label="Expand positions"
      className="group flex h-full w-full flex-col items-center gap-3 bg-[#18191f] py-3 text-slate-500 transition hover:bg-white/[0.03] hover:text-white"
    >
      <span className="grid h-7 w-7 place-items-center rounded bg-white/[0.06] text-slate-300 transition group-hover:bg-white/[0.1]">
        <Icon name="add" className="text-[16px]" />
      </span>
      {openCount > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky-400/15 px-1 text-[10px] font-black text-sky-300">
          {openCount}
        </span>
      )}
      <span className="mt-1 text-[10px] font-black uppercase tracking-wider [writing-mode:vertical-rl]">
        Positions
      </span>
    </button>
  );
}

// Currency → ISO country code for flag images (flagcdn.com, public-domain).
const CURRENCY_ISO: Record<string, string> = {
  EUR: "eu", USD: "us", GBP: "gb", JPY: "jp", CHF: "ch", AUD: "au", CAD: "ca", NZD: "nz",
};
const flagUrl = (cur: string) => `https://flagcdn.com/w40/${CURRENCY_ISO[cur] ?? "un"}.png`;

// Overlapped base/quote flags for a forex pair (Deriv-style). Rendered as
// background images (real flags that display on Android, unlike emoji flags).
function PairFlags({ base, quote, className = "" }: { base: string; quote: string; className?: string }) {
  return (
    <span className={`relative inline-block h-9 w-9 shrink-0 ${className}`} aria-hidden>
      <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-[#1b2433] bg-cover bg-center ring-2 ring-[#151518]" style={{ backgroundImage: `url(${flagUrl(quote)})` }} />
      <span className="absolute left-0 top-0 h-6 w-6 rounded-full bg-[#1b2433] bg-cover bg-center ring-2 ring-[#151518]" style={{ backgroundImage: `url(${flagUrl(base)})` }} />
    </span>
  );
}

// Chart-first mobile ticket dock: collapsed peek keeps the chart tall; expand
// for size / SL / TP / margin. Errors + forex balance always visible when needed.
function MobileForexTicket({
  symbol, direction, setDirection, bidLabel, askLabel,
  entryLabel, stopLabel, targetLabel,
  size, setSize, lots, sizePresets,
  riskPips, setRiskPips, targetPips, setTargetPips, rrPresets,
  riskKes, rewardKes, rrRatio, marginKes, forexBalance,
  tradeError, onDismissError, onOpen, opening, live,
}: {
  symbol: string;
  direction: Direction; setDirection: (d: Direction) => void;
  bidLabel: string; askLabel: string;
  entryLabel: string; stopLabel: string; targetLabel: string;
  size: number; setSize: (v: number) => void; lots: number; sizePresets: number[];
  riskPips: number; setRiskPips: (v: number) => void;
  targetPips: number; setTargetPips: (v: number) => void;
  rrPresets: { label: string; sl: number; tp: number }[];
  riskKes: number; rewardKes: number; rrRatio: number;
  marginKes: number; forexBalance: number;
  tradeError: string | null; onDismissError: () => void;
  onOpen: () => void; opening: boolean; live: boolean;
}) {
  const { format } = useMoney();
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState<null | "size" | "sl" | "tp" | "rr" | "fund">(null);
  const [funding, setFunding] = useState(false);
  const [localFundError, setLocalFundError] = useState<string | null>(null);
  const buy = direction === "buy";
  const needsFunds = forexBalance < marginKes;
  const fieldCard = "flex flex-col items-start rounded-2xl bg-[#12141a] px-3 py-2.5 text-left transition active:scale-[0.99] ring-1 ring-white/[0.05]";
  const bannerError = tradeError ?? localFundError;

  // Surface failures immediately — expand dock so the banner is readable.
  useEffect(() => {
    if (tradeError) setExpanded(true);
  }, [tradeError]);

  async function fundForex(amount: number) {
    setFunding(true);
    setLocalFundError(null);
    try {
      const res = await fetch("/api/forex/funding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocalFundError(typeof data.error === "string" ? data.error : "Funding failed");
        setExpanded(true);
        return;
      }
      window.dispatchEvent(new Event("wallet-refresh"));
      setSheet(null);
    } catch {
      setLocalFundError("Network error — please try again");
      setExpanded(true);
    } finally {
      setFunding(false);
    }
  }

  const clearBanner = () => {
    if (tradeError) onDismissError();
    if (localFundError) setLocalFundError(null);
  };

  return (
    <div className="flex shrink-0 flex-col border-t border-white/[0.08] bg-[#18191f] sm:hidden">
      {/* Grab handle + setup summary — collapses detail so the chart owns the screen */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-col items-center px-3 pt-1.5 pb-1"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse trade setup" : "Expand trade setup"}
      >
        <span className="h-1 w-9 rounded-full bg-white/20" />
        <span className="mt-1.5 flex w-full items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            {expanded ? "Hide setup" : "Trade setup"}
          </span>
          <span className="flex items-center gap-2 font-mono text-[11px] font-black text-slate-300">
            <span>{lots.toFixed(2)} lot</span>
            <span className="text-slate-600">·</span>
            <span className="text-[#ff6171]">SL {riskPips}</span>
            <span className="text-slate-600">·</span>
            <span className="text-[#33d49b]">TP {targetPips}</span>
            <Icon name={expanded ? "expand_more" : "expand_less"} className="text-[18px] text-slate-400" />
          </span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-2.5 px-3 pb-1">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setSheet("size")} className={fieldCard}>
              <span className="truncate text-[11px] font-bold text-slate-400">Size</span>
              <span className="mt-0.5 text-[15px] font-black text-white">{lots.toFixed(2)} lot</span>
            </button>
            <button type="button" onClick={() => setSheet("sl")} className={fieldCard}>
              <span className="truncate text-[11px] font-bold text-slate-400">Stop loss</span>
              <span className="mt-0.5 text-[15px] font-black text-white">{riskPips} <span className="text-[11px] text-slate-500">pips</span></span>
              <span className="mt-0.5 font-mono text-[10px] font-bold text-slate-500">{stopLabel}</span>
            </button>
            <button type="button" onClick={() => setSheet("tp")} className={fieldCard}>
              <span className="truncate text-[11px] font-bold text-slate-400">Take profit</span>
              <span className="mt-0.5 text-[15px] font-black text-white">{targetPips} <span className="text-[11px] text-slate-500">pips</span></span>
              <span className="mt-0.5 font-mono text-[10px] font-bold text-slate-500">{targetLabel}</span>
            </button>
          </div>

          <button type="button" onClick={() => setSheet("rr")}
            className="flex w-full items-center justify-between rounded-2xl bg-[#12141a] px-3.5 py-2.5 text-left ring-1 ring-white/[0.05] transition active:scale-[0.99]">
            <span className="flex flex-col items-start">
              <span className="text-[11px] font-bold text-slate-400">Risk : Reward</span>
              <span className="mt-0.5 text-[15px] font-black text-white">1:{rrRatio.toFixed(2)}</span>
            </span>
            <span className="flex items-center gap-2.5 font-mono text-[11px] font-black">
              <span className="text-[#ff6171]">−{format(riskKes)}</span>
              <span className="text-[#33d49b]">+{format(rewardKes)}</span>
              <Icon name="expand_more" className="text-[18px] text-slate-400" />
            </span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-[#12141a] px-2.5 py-2 ring-1 ring-white/[0.05]">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Entry</div>
              <div className="truncate font-mono text-[11px] font-black text-white">{entryLabel}</div>
            </div>
            <div className="rounded-xl bg-[#12141a] px-2.5 py-2 ring-1 ring-white/[0.05]">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#ff6171]/80">Stop</div>
              <div className="truncate font-mono text-[11px] font-black text-white">{stopLabel}</div>
            </div>
            <div className="rounded-xl bg-[#12141a] px-2.5 py-2 ring-1 ring-white/[0.05]">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#33d49b]/80">Target</div>
              <div className="truncate font-mono text-[11px] font-black text-white">{targetLabel}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#12141a] px-3 py-2.5 ring-1 ring-white/[0.05]">
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Forex wallet</div>
              <div className="font-mono text-[13px] font-black text-white">{format(forexBalance)}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Margin</div>
              <div className={`font-mono text-[13px] font-black ${needsFunds ? "text-amber-300" : "text-white"}`}>{format(marginKes)}</div>
            </div>
            <button
              type="button"
              onClick={() => { setLocalFundError(null); setSheet("fund"); }}
              className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition active:scale-[0.97] ${
                needsFunds
                  ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30"
                  : "bg-white/[0.06] text-slate-200 ring-1 ring-white/[0.08]"
              }`}
            >
              Fund
            </button>
          </div>
        </div>
      )}

      {/* Always-visible balance strip when collapsed and funds are tight */}
      {!expanded && needsFunds && (
        <div className="flex items-center justify-between gap-2 px-3 pb-1">
          <span className="text-[11px] font-bold text-amber-200">
            Need {format(marginKes - forexBalance)} more margin
          </span>
          <button
            type="button"
            onClick={() => setSheet("fund")}
            className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-200 ring-1 ring-amber-400/30 active:scale-[0.97]"
          >
            Fund
          </button>
        </div>
      )}

      {bannerError && (
        <div className={`mx-3 mb-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold ${
          bannerError.includes("reached") || bannerError.includes("triggered")
            ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <span>{bannerError}</span>
            <button type="button" onClick={clearBanner} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
          </div>
          {(bannerError.toLowerCase().includes("forex wallet") || bannerError.toLowerCase().includes("insufficient")) && (
            <button
              type="button"
              onClick={() => setSheet("fund")}
              className="mt-1.5 text-[11px] font-black underline decoration-red-300/50 underline-offset-2"
            >
              Fund forex wallet
            </button>
          )}
        </div>
      )}

      <div className="space-y-2 px-3 pb-2 pt-0.5">
        <div className="relative grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => setDirection("sell")}
            className={`flex flex-col items-center rounded-2xl py-3 transition active:scale-[0.98] ${!buy ? "bg-[#ef4444] text-white" : "bg-[#1a1b20] text-slate-400 ring-1 ring-white/[0.06]"}`}>
            <span className="text-[12px] font-black tracking-wide">Sell</span>
            <span className="mt-0.5 font-mono text-[15px] font-black leading-none">{bidLabel}</span>
          </button>
          <button type="button" onClick={() => setDirection("buy")}
            className={`flex flex-col items-center rounded-2xl py-3 transition active:scale-[0.98] ${buy ? "bg-[#087cff] text-white" : "bg-[#1a1b20] text-slate-400 ring-1 ring-white/[0.06]"}`}>
            <span className="text-[12px] font-black tracking-wide">Buy</span>
            <span className="mt-0.5 font-mono text-[15px] font-black leading-none">{askLabel}</span>
          </button>
        </div>

        <button type="button" onClick={onOpen} aria-busy={opening} disabled={!live}
          className={`flex min-h-12 w-full flex-col items-center justify-center gap-0 rounded-2xl py-2.5 font-black text-white transition active:scale-[0.98] disabled:opacity-50 ${buy ? "bg-[#087cff] active:bg-[#1a8cff]" : "bg-[#ef4444] active:bg-[#f87171]"}`}>
          <span className="text-[15px] leading-tight">{!live ? "Awaiting feed…" : `Confirm ${buy ? "buy" : "sell"}`}</span>
          <span className="font-mono text-[11px] leading-tight text-white/85">
            {buy ? askLabel : bidLabel}
            <span className="mx-1.5 text-white/40">·</span>
            margin {format(marginKes)}
          </span>
        </button>
      </div>

      {sheet === "size" && (
        <ValuePickerSheet title="Position size" unit="units" value={size}
          presets={[...sizePresets]} min={1000} max={50_000} integer
          onChange={setSize} onClose={() => setSheet(null)} />
      )}
      {sheet === "sl" && (
        <ValuePickerSheet title="Stop loss" unit="pips" value={riskPips}
          presets={[10, 15, 20, 25, 40, 60]} min={1} max={500} integer
          onChange={setRiskPips} onClose={() => setSheet(null)} />
      )}
      {sheet === "rr" && (
        <RrSheet presets={rrPresets} riskPips={riskPips} targetPips={targetPips}
          riskKes={riskKes} rewardKes={rewardKes}
          onSelect={(sl, tp) => { setRiskPips(sl); setTargetPips(tp); }} onClose={() => setSheet(null)} />
      )}
      {sheet === "tp" && (
        <ValuePickerSheet title="Take profit" unit="pips" value={targetPips}
          presets={[15, 20, 30, 45, 60, 100]} min={1} max={1000} integer
          onChange={setTargetPips} onClose={() => setSheet(null)} />
      )}
      {sheet === "fund" && (
        <ForexFundSheet
          marginKes={marginKes}
          forexBalance={forexBalance}
          funding={funding}
          onFund={(amount) => void fundForex(amount)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function ForexFundSheet({
  marginKes, forexBalance, funding, onFund, onClose,
}: {
  marginKes: number;
  forexBalance: number;
  funding: boolean;
  onFund: (amount: number) => void;
  onClose: () => void;
}) {
  const { format } = useMoney();
  const shortfall = Math.max(0, marginKes - forexBalance);
  const presets = Array.from(new Set([
    Math.max(50, Math.ceil(shortfall) || marginKes),
    marginKes,
    marginKes * 2,
    100,
    500,
    1000,
  ].filter((n) => n > 0))).sort((a, b) => a - b).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#18191f] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-1 pt-2 text-center">
          <div className="text-[13px] font-black text-white">Fund forex wallet</div>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">
            Move money from your main wallet. Balance {format(forexBalance)} · margin {format(marginKes)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-2">
          {presets.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={funding}
              onClick={() => onFund(amount)}
              className="rounded-2xl bg-[#12141a] px-3 py-3 text-center ring-1 ring-white/[0.06] transition active:scale-[0.98] disabled:opacity-50"
            >
              <span className="font-mono text-[14px] font-black text-white">{format(amount)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Risk:Reward preset picker sheet — replaces the bare 1:1/1:2/1:3/Scalp buttons
// with a neat popup (matches the Size/SL/TP picker pattern).
function RrSheet({
  presets, riskPips, targetPips, riskKes, rewardKes, onSelect, onClose,
}: {
  presets: { label: string; sl: number; tp: number }[];
  riskPips: number; targetPips: number; riskKes: number; rewardKes: number;
  onSelect: (sl: number, tp: number) => void; onClose: () => void;
}) {
  const { format } = useMoney();
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative rounded-t-3xl bg-[#18191f] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-1 pt-2 text-center text-[13px] font-black text-white">Risk : Reward</div>
        <div className="flex items-center justify-center gap-3 pb-2 font-mono text-[11px] font-black">
          <span className="text-[#ff6171]">−{format(riskKes)}</span>
          <span className="text-[#33d49b]">+{format(rewardKes)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-1">
          {presets.map((p) => {
            const active = riskPips === p.sl && targetPips === p.tp;
            return (
              <button key={p.label} type="button" onClick={() => { onSelect(p.sl, p.tp); onClose(); }}
                className={`flex flex-col items-start rounded-2xl px-4 py-3 transition active:scale-[0.98] ${active ? "bg-white text-[#18191f]" : "bg-[#18191f] text-white"}`}>
                <span className="text-[15px] font-black">{p.label}</span>
                <span className={`text-[11px] font-bold ${active ? "text-slate-600" : "text-slate-500"}`}>SL {p.sl} · TP {p.tp} pips</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Deriv-style mobile pair picker (opened by the Markets tab). Search + favourites
// (persisted) + the current pair highlighted white. Mirrors binary's MarketsSheet.
function ForexPairSheet({
  markets, current, onSelect, onClose,
}: {
  markets: ForexMarket[];
  current: string;
  onSelect: (symbol: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"favourites" | "all">("all");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);
  const [starPop, setStarPop] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("forex-fav-pairs") ?? "[]");
      if (Array.isArray(saved)) setFavs(new Set(saved));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("forex-fav-pairs", JSON.stringify([...favs])); } catch { /* ignore */ }
  }, [favs]);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (starTimer.current) clearTimeout(starTimer.current);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      onClose();
      closeTimer.current = null;
    }, 220);
  }, [closing, onClose]);

  const toggleFav = (sym: string) => {
    setFavs((s) => {
      const n = new Set(s);
      if (n.has(sym)) n.delete(sym);
      else n.add(sym);
      return n;
    });
    setStarPop(sym);
    if (starTimer.current) clearTimeout(starTimer.current);
    starTimer.current = setTimeout(() => setStarPop(null), 280);
  };

  const term = q.trim().toLowerCase();
  const base = tab === "favourites" ? markets.filter((m) => favs.has(m.symbol)) : markets;
  const filtered = base.filter(
    (m) => term === "" || m.symbol.toLowerCase().includes(term) || m.name.toLowerCase().includes(term),
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/60 ${closing ? "animate-sheet-backdrop-out" : "animate-sheet-backdrop-in"}`}
      />
      <div
        className={`relative flex max-h-[85dvh] flex-col rounded-t-3xl bg-[#151518] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-2xl ring-1 ring-white/[0.06] ${
          closing ? "animate-sheet-out" : "animate-sheet-in"
        }`}
      >
        <button type="button" onClick={requestClose} className="flex w-full justify-center pt-2.5 pb-1" aria-label="Close sheet">
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </button>
        <div className="flex items-center gap-2 px-4 pb-3 pt-1.5">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/[0.05] px-3 ring-1 ring-white/[0.07] focus-within:ring-sky-500/50">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pairs"
              className="h-9 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-slate-400 transition-[transform] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97]"
          >
            <Icon name="close" className="text-[14px]" />
          </button>
        </div>

        <div className="flex items-stretch gap-5 border-b border-white/[0.07] px-4 text-[13px] font-black">
          {(["favourites", "all"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 py-2.5 capitalize transition-[color,border-color] duration-150 [transition-timing-function:var(--ease-out)] ${
                tab === t ? "border-white text-white" : "border-transparent text-slate-500"
              }`}
            >
              {t}
              {t === "favourites" && favs.size > 0 && (
                <span className="ml-1.5 tabular-nums text-[11px] text-slate-500">{favs.size}</span>
              )}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
          {tab === "favourites" && filtered.length === 0 ? (
            <div className="animate-fav-empty flex flex-col items-center justify-center px-8 py-16 text-center">
              <Icon name="star" className="text-[56px] text-slate-700" />
              <div className="mt-3 text-[14px] font-black text-slate-400">No favourites</div>
              <div className="mt-1 text-[12px] font-bold text-slate-600">Tap the star on a pair to add it here.</div>
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-5 rounded-xl bg-[#087cff] px-4 py-2.5 text-[12px] font-black text-white transition-[transform] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97]"
              >
                Browse pairs
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-[12px] font-bold text-slate-600">No pairs match “{q}”.</p>
          ) : (
            <>
              <p className="px-3 pb-1 pt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Forex pairs</p>
              {filtered.map((m) => {
                const active = m.symbol === current;
                const starred = favs.has(m.symbol);
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => onSelect(m.symbol)}
                    className={`animate-fav-row flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97] ${
                      active ? "bg-white" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <PairFlags base={m.base} quote={m.quote} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] font-black ${active ? "text-[#151518]" : "text-white"}`}>
                        {m.symbol}
                      </span>
                      <span className={`block truncate text-[11px] font-bold ${active ? "text-slate-600" : "text-slate-500"}`}>
                        {m.name}
                      </span>
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFav(m.symbol);
                      }}
                      className={`shrink-0 transition-[transform] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.92] ${
                        starPop === m.symbol ? "animate-fav-star-pop" : ""
                      }`}
                    >
                      <Icon
                        name="star"
                        className={`text-[20px] ${starred ? "fill-current text-amber-400" : active ? "text-slate-500" : "text-slate-600"}`}
                      />
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Discover demoted from bottom nav — still one tap from Markets */}
        <div className="shrink-0 border-t border-white/[0.06] px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.replace(`${pathname}?panel=discover`, { scroll: false });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] hover:bg-white/[0.04]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-slate-300">
              <Icon name="explore" className="text-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-white">Discover</span>
              <span className="block text-[11px] font-bold text-slate-500">Market news &amp; headlines</span>
            </span>
            <Icon name="chevron_right" className="text-[18px] text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Live mid-price pill that flashes green on an up-tick and red on a down-tick.
// The inner value remounts on `flashKey` so the flash animation replays every
// tick — makes the feed read as alive even on sub-pip forex moves.
function LiveTicker({ price, dir, flashKey, live }: { price: string; dir: "up" | "down" | "flat"; flashKey: number; live: boolean }) {
  const color = dir === "up" ? "#33d49b" : dir === "down" ? "#ff6171" : "#94a3b8";
  return (
    <span className="hidden items-center gap-1.5 rounded px-2 py-1 sm:inline-flex" style={{ background: "rgba(255,255,255,0.04)" }}>
      <style>{`@keyframes fxflash{0%{transform:scale(1.12);opacity:.55}100%{transform:scale(1);opacity:1}}`}</style>
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse" : ""}`}
        style={{ background: live ? color : "#64748b" }}
      />
      <span
        key={flashKey}
        className="font-mono text-[11px] font-black tabular-nums"
        style={{ color, animation: "fxflash .4s ease-out" }}
      >
        {dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {price}
      </span>
    </span>
  );
}

function QuoteBox({ label, tone, value }: { label: string; tone: "buy" | "sell"; value: string }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded border px-2 py-1 sm:min-w-[80px] ${tone === "buy" ? "border-[#33d49b]/30 bg-[#33d49b]/8" : "border-[#ff6171]/30 bg-[#ff6171]/8"}`}>
      <div className="text-[8px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="truncate font-mono text-xs font-black text-white sm:text-sm">{value}</div>
    </div>
  );
}

function QuoteToggle({ active, label, onClick, price, tone }: { active: boolean; label: string; onClick: () => void; price: string; tone: "buy" | "sell" }) {
  const accent = tone === "buy" ? "#0f9f68" : "#d33d4b";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border px-3 py-1.5 text-left transition active:scale-[0.98] ${
        active
          ? tone === "buy"
            ? "border-[#33d49b]/60 bg-[#0f9f68]/15"
            : "border-[#ff6171]/60 bg-[#d33d4b]/15"
          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-black ${active ? "text-white" : "text-slate-400"}`}>{label}</span>
        <span className="h-2 w-2 rounded-full transition" style={{ background: active ? accent : "rgba(255,255,255,0.15)" }} />
      </div>
      <div className={`mt-0.5 font-mono text-sm font-black ${active ? (tone === "buy" ? "text-[#33d49b]" : "text-[#ff6171]") : "text-slate-500"}`}>{price}</div>
    </button>
  );
}

function PriceChip({ label, tone, value }: { label: string; tone?: "buy" | "sell"; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/25 px-2 py-2 text-center">
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate font-mono text-xs font-black ${tone === "buy" ? "text-[#33d49b]" : tone === "sell" ? "text-[#ff6171]" : "text-white"}`}>{value}</div>
    </div>
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

function PositionRow({ closing, currentPrice, onClose, trade }: { closing?: boolean; currentPrice: number; onClose: () => void; trade: Trade }) {
  const { format } = useMoney();
  const rawPips = getPips(trade.entry, currentPrice, trade);
  const pips = trade.direction === "buy" ? rawPips : -rawPips;
  const plKes = parseFloat((pips * (trade.size / 10000)).toFixed(2));

  // Where the live price sits between stop loss (0) and take profit (1). The
  // formula holds for both directions: 0 = at SL (worst), 1 = at TP (best).
  const span = trade.takeProfit - trade.stopLoss;
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const progress = span !== 0 ? clamp01((currentPrice - trade.stopLoss) / span) : 0.5;
  const entryMark = span !== 0 ? clamp01((trade.entry - trade.stopLoss) / span) : 0.5;
  const inProfit = plKes >= 0;
  // Pulse the bar when price is closing in on either barrier.
  const nearBarrier = progress <= 0.12 || progress >= 0.88;

  return (
    <div className="rounded-2xl bg-[#18191f] p-3.5 ring-1 ring-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-white">{trade.symbol}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${trade.direction === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
              {trade.direction.toUpperCase()}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-slate-500">
            {trade.size.toLocaleString("en-US")} @ {formatPrice(trade, trade.entry)}
          </div>
          {trade.margin && (
            <div className="text-[10px] text-slate-600">Margin: {format(Number(trade.margin))}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-mono text-sm font-black tabular-nums ${pips >= 0 ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
            {pips >= 0 ? "+" : ""}{pips.toFixed(1)} pips
          </div>
          <div className={`font-mono text-[11px] font-bold tabular-nums ${plKes >= 0 ? "text-[#33d49b]" : "text-[#ff6171]"}`}>
            {plKes >= 0 ? "+" : ""}{format(plKes)}
          </div>
        </div>
      </div>

      {/* SL ←→ TP track. Fill grows from the SL end; an entry tick and a live
          price marker show how close the position is to either barrier. */}
      <div className="mt-3">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out ${inProfit ? "bg-[#33d49b]" : "bg-[#ff6171]"} ${nearBarrier ? "animate-pulse" : ""}`}
            style={{ width: `${progress * 100}%` }}
          />
          {/* entry reference tick */}
          <div className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${entryMark * 100}%` }} />
          {/* live price marker */}
          <div
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 shadow ${inProfit ? "bg-[#33d49b]" : "bg-[#ff6171]"} ${nearBarrier ? "animate-pulse" : ""}`}
            style={{ left: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-black uppercase tracking-wider">
          <span className="text-[#ff6171]/80">SL {formatPrice(trade, trade.stopLoss)}</span>
          <span className="text-[#33d49b]/80">TP {formatPrice(trade, trade.takeProfit)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={closing}
        className="mt-3 w-full rounded-xl bg-white/[0.06] py-2.5 text-xs font-black text-slate-300 ring-1 ring-white/[0.06] transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
      >
        {closing ? "Closing…" : "Close position"}
      </button>
    </div>
  );
}

function HistoryRow({ trade }: { trade: ClosedTrade }) {
  const { format } = useMoney();
  const pl = trade.profitLoss ?? 0;
  const won = pl >= 0;
  const closedDate = trade.closedAt ? new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeStyle: "short" }).format(new Date(trade.closedAt)) : "—";

  return (
    <div className="rounded-2xl bg-[#18191f] p-3.5 ring-1 ring-white/[0.06]">
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
            {won ? "+" : ""}{format(pl)}
          </div>
          <div className={`rounded px-2 py-0.5 text-[9px] font-black ${won ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
            {won ? "WIN" : "LOSS"}
          </div>
        </div>
      </div>
    </div>
  );
}
