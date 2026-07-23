"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCurrency, PlayUsdProvider } from "@/lib/currency-context";
import type { DisplayCurrency } from "@/lib/currency-config";
import { FALLBACK_USD_KES, MIN_PLAY_USD } from "@/lib/play-usd";
import { useNavBadge } from "@/lib/nav-badge-context";
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type AreaData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Icon } from "@/components/icon";
import { LiveTickChart, type LiveChartTheme, type ChartLine as LiveChartLine } from "@/components/charts/live-tick-chart";
import { toast } from "@/lib/toast";
import { placed } from "@/lib/game-feel";
import { celebrateWin } from "@/components/aviator/win-celebration";
import {
  digitInterimStatus,
  directionalInterimStatus,
  type InterimStatus,
} from "@/lib/binary/display";

// Blue/white theme for the shared live chart engine (Nezeem).
const BINARY_THEME: LiveChartTheme = {
  bg: "#151518",
  up: "#3b82f6", down: "#ef4444",
  areaTop: "rgba(59,130,246,0.28)", areaBottom: "rgba(59,130,246,0.02)",
  dot: "#ffffff", stub: "rgba(59,130,246,0.9)", lineColor: "#e5edf8",
};

// BinaryKE — lime/white on pure black (Olymp-adjacent).
const BOK_THEME: LiveChartTheme = {
  bg: "#000000",
  up: "#b8ff2a", down: "#e11d48",
  areaTop: "rgba(184,255,42,0.22)", areaBottom: "rgba(184,255,42,0.02)",
  dot: "#ffffff", stub: "rgba(184,255,42,0.9)", lineColor: "#f0f0f0",
};

// MoneyBinary — green on dark grey (#1a1d23).
const MBK_THEME: LiveChartTheme = {
  bg: "#1a1d23",
  up: "#22c55e", down: "#ef4444",
  areaTop: "rgba(34,197,94,0.22)", areaBottom: "rgba(34,197,94,0.02)",
  dot: "#ffffff", stub: "rgba(34,197,94,0.9)", lineColor: "#f0f0f0",
};

// BinaryMarket — blue on navy.
const BM_THEME: LiveChartTheme = {
  bg: "#080d1a",
  up: "#3b82f6", down: "#f87171",
  areaTop: "rgba(59,130,246,0.22)", areaBottom: "rgba(59,130,246,0.02)",
  dot: "#ffffff", stub: "rgba(59,130,246,0.9)", lineColor: "#f0f0f0",
};
import { createClient } from "@/lib/supabase/client";
import { quoteToDigit } from "@/lib/binary-digit";
import {
  applyServerBinaryDigits,
  closedDisplayStatus,
  mergeClosedPositions,
  toAccumulatorClosedPosition,
  toBinaryClosedPosition,
  toDirectionalClosedPosition,
  toLeveragedClosedPosition,
  type ClosedPosition,
} from "@/lib/binary/history";
import { CopyTradingPanel } from "@/components/binary/copy-trading-panel";
import { useIsBinarySurface, useSiteConfig } from "@/lib/site-config-context";
import {
  BARRIER_TOO_CLOSE_COPY,
  MATCHES_FREQ_HI,
  MATCHES_FREQ_LO,
  MIN_OVER_UNDER_TICKS,
  isCalmDigitAvailabilityReject,
  isCalmDirectionalReject,
  minBarrierOffsetPts,
  previewDigitPayout,
  shortDigitRejectReason,
  shortDirectionalRejectReason,
} from "@/lib/binary/server-price";
import { isUnderQuarantined } from "@/lib/binary/quarantine";
import {
  SIGMA_WINDOW, computeSigma, barrierFracFor, maxTicksFor, payoutAtTick,
} from "@/lib/accumulator";
import dynamic from "next/dynamic";
import { TradeTypePicker } from "./trade-type-picker";
/** Default panel stays eager so /binary first paint ships chart + digit controls. */
import { DigitPanel } from "./panels/digit-panel";
import { tradeTypeById, TRADE_TYPES, type TradeTypeId } from "./trade-types";
import { MarketIcon } from "./market-icon";
import { payoutRate as dirPayoutRate, vanillaPayoutPerPoint, resolveContract, MAX_VANILLA_MULT, type DirectionalSide, type DirectionalKind } from "@/lib/directional";
import {
  resolveLeveraged, leveragedValueAt, multiplierStopOutPrice, clampTurboBarrier, turboPayoutPerPoint,
  LEVERAGED_MAX_MULT, type LeveragedKindT, type LeveragedDirection,
} from "@/lib/leveraged";

function PanelSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-3 p-4" aria-hidden>
      <div className="h-8 rounded bg-white/[0.06]" />
      <div className="h-24 rounded bg-white/[0.04]" />
      <div className="mt-auto h-12 rounded bg-white/[0.06]" />
    </div>
  );
}

const AccumulatorsPanel = dynamic(
  () => import("./panels/accumulators-panel").then((m) => m.AccumulatorsPanel),
  { ssr: false, loading: () => <PanelSkeleton /> },
);
const DirectionalPanel = dynamic(
  () => import("./panels/directional-panel").then((m) => m.DirectionalPanel),
  { ssr: false, loading: () => <PanelSkeleton /> },
);
const VanillaPanel = dynamic(
  () => import("./panels/vanilla-panel").then((m) => m.VanillaPanel),
  { ssr: false, loading: () => <PanelSkeleton /> },
);
const LeveragedPanel = dynamic(
  () => import("./panels/leveraged-panel").then((m) => m.LeveragedPanel),
  { ssr: false, loading: () => <PanelSkeleton /> },
);
const AutoPanel = dynamic(
  () => import("./panels/auto-panel").then((m) => m.AutoPanel),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

// Digit trade types reuse the existing Even/Odd/Matches/Over digit controls.
const DIGIT_TYPE_TO_FAMILY: Partial<Record<TradeTypeId, ContractFamily>> = {
  even_odd:        "evenOdd",
  matches_differs: "matchDiffer",
  over_under:      "overUnder",
};

// Directional trade types share one server spine + settle flow. Rise/Fall,
// Higher/Lower and Touch/No-Touch reuse DirectionalPanel; Vanilla has its own.
const DIRECTIONAL_KIND: Partial<Record<TradeTypeId, DirectionalKind>> = {
  rise_fall:      "RISE_FALL",
  higher_lower:   "HIGHER_LOWER",
  touch_no_touch: "TOUCH_NO_TOUCH",
  vanillas:       "VANILLA",
};

// Sides offered per directional kind, in button order (bullish first).
const DIRECTIONAL_SIDES: Record<DirectionalKind, [DirectionalSide, DirectionalSide]> = {
  RISE_FALL:      ["RISE", "FALL"],
  HIGHER_LOWER:   ["HIGHER", "LOWER"],
  TOUCH_NO_TOUCH: ["TOUCH", "NO_TOUCH"],
  VANILLA:        ["CALL", "PUT"],
};

// Leveraged trade types (Multipliers, Turbos) share one live-position spine +
// cash-out flow, like Accumulators. Both use LeveragedPanel.
const LEVERAGED_KIND: Partial<Record<TradeTypeId, LeveragedKindT>> = {
  multipliers: "MULTIPLIER",
  turbos:      "TURBO",
};

type ContractFamily = "evenOdd" | "matchDiffer" | "overUnder";
type ContractSide = "Even" | "Odd" | "Matches" | "Differs" | "Over" | "Under";
type TradeStatus = "open" | "won" | "lost";
type StreamStatus = "connecting" | "live" | "fallback";

type BinaryMarket = {
  symbol: string;
  derivSymbol: string;
  name: string;
  price: number;
  volatility: number;
  speedMs: number;
};

type Tick = {
  time: UTCTimestamp;
  quote: number;
  digit: number;
};

type BinaryTrade = {
  id: string;
  market: string;
  side: ContractSide;
  stake: number;
  payout: number;
  entryDigit: number;
  targetDigit: number;
  exitDigit?: number;
  openedAt: number;
  settlesAt: number;
  status: TradeStatus;
  isReal?: boolean; // true when backed by real wallet
  copyLeaderUsername?: string | null;
};

// A single in-flight accumulator contract. Deriv runs one at a time per symbol;
// we mirror that — the panel shows the running contract with a cash-out button.
type AccaPosition = {
  id: string;
  market: string;        // display symbol
  derivSymbol: string;
  stake: number;
  growthRate: number;
  entrySpot: number;
  entryEpoch: number;
  barrierFrac: number;
  maxTicks: number;
  takeProfit: number | null;
  isReal: boolean;
  ticksSurvived: number;
  lastEpoch: number;     // newest tick already applied to this contract
  prevSpot: number;      // spot of the last surviving tick (band is around this)
  status: "open" | "won" | "lost";
};

// A directional contract (Rise/Fall, Higher/Lower, Touch/No-Touch, Vanilla).
type DirTrade = {
  id: string;
  market: string;        // display symbol
  derivSymbol: string;
  kind: DirectionalKind;
  side: DirectionalSide;
  stake: number;
  payout: number;        // fixed net payout if won (0 for VANILLA — proportional)
  payoutPerPoint: number | null; // VANILLA only: credit per in-the-money point
  entrySpot: number;
  entryEpoch: number;
  barrier: number | null; // barrier (HIGHER_LOWER/TOUCH) or strike (VANILLA)
  durationTicks: number;
  isReal: boolean;
  settlesAt: number;     // wall-clock estimate for the UI countdown / settle attempt
  status: "open" | "won" | "lost";
  copyLeaderUsername?: string | null;
};

// A single in-flight leveraged contract (Multiplier or Turbo). One at a time per
// symbol, like Accumulators — the panel shows live P&L with a cash-out button.
type LevPosition = {
  id: string;
  market: string;        // display symbol
  derivSymbol: string;
  kind: LeveragedKindT;
  direction: LeveragedDirection;
  stake: number;
  multiplier: number | null;
  barrier: number | null;        // knockout (TURBO) or stop-out (MULTIPLIER) price
  payoutPerPoint: number | null; // TURBO only
  entrySpot: number;
  entryEpoch: number;
  takeProfit: number | null;
  stopLoss: number | null;
  isReal: boolean;
  lastEpoch: number;     // newest tick already folded into this contract
  status: "open" | "won" | "lost";
};

const MARKETS: BinaryMarket[] = [
  // 1-second volatility indices (tick each second — the "(1s)" feeds, 1HZ*V).
  { symbol: "Vol 10 (1s)",  derivSymbol: "1HZ10V",  name: "Deriv synthetic index", price: 9447.34, volatility: 0.65, speedMs: 1000 },
  { symbol: "Vol 25 (1s)",  derivSymbol: "1HZ25V",  name: "Deriv synthetic index", price: 3821.8,  volatility: 0.95, speedMs: 1000 },
  { symbol: "Vol 50 (1s)",  derivSymbol: "1HZ50V",  name: "Deriv synthetic index", price: 602.91,  volatility: 1.35, speedMs: 1000 },
  { symbol: "Vol 75 (1s)",  derivSymbol: "1HZ75V",  name: "Deriv synthetic index", price: 12843.2, volatility: 1.75, speedMs: 1000 },
  { symbol: "Vol 100 (1s)", derivSymbol: "1HZ100V", name: "Deriv synthetic index", price: 1762.48, volatility: 2.2,  speedMs: 1000 },
  // Standard volatility indices (tick ~every 2s — the R_* feeds).
  { symbol: "Vol 10",  derivSymbol: "R_10",  name: "Deriv synthetic index", price: 9447.34, volatility: 0.65, speedMs: 2000 },
  { symbol: "Vol 25",  derivSymbol: "R_25",  name: "Deriv synthetic index", price: 3821.8,  volatility: 0.95, speedMs: 2000 },
  { symbol: "Vol 50",  derivSymbol: "R_50",  name: "Deriv synthetic index", price: 602.91,  volatility: 1.35, speedMs: 2000 },
  { symbol: "Vol 75",  derivSymbol: "R_75",  name: "Deriv synthetic index", price: 12843.2, volatility: 1.75, speedMs: 2000 },
  { symbol: "Vol 100", derivSymbol: "R_100", name: "Deriv synthetic index", price: 1762.48, volatility: 2.2,  speedMs: 2000 },
];

// Default mobile quick-bar order — digits first (most-played), then the rest.
// User navigation reorders this (most-recent first), persisted to localStorage.
const DEFAULT_TYPE_ORDER: TradeTypeId[] = [
  "even_odd", "over_under", "matches_differs",
  "accumulators", "vanillas", "turbos", "multipliers",
  "rise_fall", "higher_lower", "touch_no_touch",
];

// Stake presets in USD — converted to KES via PlayUsdProvider.toKes for the ledger.
const STAKE_PRESETS_USD = [1, 5, 10, 25, 50, 100];
const DIGITS = Array.from({ length: 10 }, (_, index) => index);

/** Prefer Even/Odd (and other digit types) over Call/Put when available. */
function pickDefaultTradeType(liveTypes: TradeTypeId[]): TradeTypeId {
  const preferred: TradeTypeId[] = [
    "even_odd",
    "over_under",
    "matches_differs",
    "rise_fall",
    "higher_lower",
    "touch_no_touch",
    "accumulators",
    "vanillas",
    "turbos",
    "multipliers",
  ];
  return preferred.find((id) => liveTypes.includes(id)) ?? liveTypes[0] ?? "even_odd";
}
const TICK_SECONDS = 1;
// Deriv's public options feed — the ONLY client endpoint that still serves
// synthetic indices (1HZ*, R_*). The legacy `ws.derivws.com/websockets/v3`
// endpoint (any app_id, incl. 1089) now rejects every synthetic with
// "InvalidSymbol: Symbol … is invalid", which dropped the chart to REST
// fallback and showed that warning. This matches the server feed
// (lib/deriv-feed.ts) and forex-client, which already use it and work.
const DERIV_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

function seedTicks(market: BinaryMarket): Tick[] {
  let quote = market.price;
  const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
  const count = 3600;

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index / 5) * market.volatility * 2.5;
    const drift = Math.cos(index / 9) * market.volatility;
    quote = Math.max(1, quote + wave + drift + ((index % 3) - 1) * market.volatility);
    return {
      time: (now - (count - index) * TICK_SECONDS) as UTCTimestamp,
      quote,
      digit: quoteToDigit(quote),
    };
  });
}

function nextTick(previous: Tick, market: BinaryMarket): Tick {
  const shock = (Math.random() - 0.5) * market.volatility * 7;
  const micro = Math.sin(Date.now() / 1600) * market.volatility * 1.6;
  const quote = Math.max(1, previous.quote + shock + micro);

  return {
    time: (previous.time + TICK_SECONDS) as UTCTimestamp,
    quote,
    digit: quoteToDigit(quote),
  };
}

function toTick(epoch: number, quote: number): Tick {
  return {
    time: epoch as UTCTimestamp,
    quote,
    digit: quoteToDigit(quote),
  };
}

// All binary amounts are canonical KES (demo + live). `fmtMoney` converts a KES
// amount into the active display currency for showing only — stakes posted to
// the server stay KES (converted back via context.toKes at the input boundary).
function fmtMoney(
  kes: number,
  currency: DisplayCurrency,
  convert: (k: number) => number,
  opts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 },
) {
  return `${currency.symbol} ${convert(kes).toLocaleString(currency.locale, opts)}`;
}

function formatQuote(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function retainedPayout(stake: number, grossPayout: number) {
  if (grossPayout <= stake) return grossPayout;
  return stake + (grossPayout - stake) * 0.70;
}

function familySides(family: ContractFamily): ContractSide[] {
  if (family === "evenOdd") return ["Even", "Odd"];
  if (family === "matchDiffer") return ["Matches", "Differs"];
  return ["Over", "Under"];
}

function evaluateTrade(side: ContractSide, digit: number, targetDigit: number) {
  if (side === "Even") return digit % 2 === 0;
  if (side === "Odd") return digit % 2 === 1;
  if (side === "Matches") return digit === targetDigit;
  if (side === "Differs") return digit !== targetDigit;
  if (side === "Over") return digit > targetDigit;
  return digit < targetDigit;
}

// A horizontal overlay line on the chart (barrier / strike / stop-out / knockout
// / entry). Diffed by `id` so lines that follow the spot update in place.
type ChartLine = LiveChartLine;
// An entry/exit marker pinned to a tick time.
type ChartMarker = { id: string; time: UTCTimestamp; color: string; text: string; above?: boolean };

// Bars of empty space kept to the right of the live point (Deriv-style gap so the
// pulsing dot sits clear of the price axis). The view scrolls a further bar over
// each tick interval, then resets when the next tick lands — continuous flow.
/** Small trailing whitespace so the live tip isn’t glued to the price scale. */
const RIGHT_GAP_BARS = 3;
const VALUE_EASING = 0.16; // fraction of the price gap closed per animation frame

function TradingViewBinaryChart({ ticks, lines, markers }: { ticks: Tick[]; lines?: ChartLine[]; markers?: ChartMarker[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const lastPointRef = useRef<{ time: number; value: number } | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // Smooth-motion state: the newest point glides toward the latest tick each
  // animation frame (LERP) and the view scrolls continuously, instead of
  // snapping/freezing once per tick.
  const targetRef = useRef<{ time: UTCTimestamp; value: number } | null>(null);
  const renderValueRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const stubRef = useRef<HTMLDivElement | null>(null); // dashed price line, right of the dot only
  const lastTickAtRef = useRef<number>(0);     // performance.now() of the last real tick
  const tickIntervalRef = useRef<number>(1000); // smoothed ms between ticks

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#151518" },
        textColor: "#8d99ae",
        fontFamily: "var(--font-jakarta), sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.045)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: RIGHT_GAP_BARS,        // whitespace on the right (Deriv-style gap)
        barSpacing: 16,
        shiftVisibleRangeOnNewBar: false,   // we drive the scroll ourselves in the rAF loop
        tickMarkFormatter: (time: Time) => fmtClock(time, true),
      },
      crosshair: {
        vertLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" },
        horzLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" },
      },
      localization: {
        priceFormatter: (price: number) => formatQuote(price),
        timeFormatter: (time: Time) => fmtClock(time, true),
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#e5edf8",
      lineWidth: 2,
      topColor: "rgba(59,130,246,0.28)",
      bottomColor: "rgba(59,130,246,0.02)",
      priceLineColor: "#3b82f6",
      priceLineWidth: 1,
      lastValueVisible: true,
      priceLineVisible: true, // full-width guide — reads clearly on wide / half-panel layouts
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#93c5fd",
      crosshairMarkerBackgroundColor: "#3b82f6",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    chart.timeScale().fitContent();

    // Continuous animation loop (paints at the monitor's refresh rate, decoupled
    // from websocket cadence). Three things every frame, so the chart flows like
    // Deriv instead of snapping/freezing once per tick:
    //   1. glide the newest point's value toward the latest tick (LERP),
    //   2. scroll the view left continuously between ticks,
    //   3. move the pulsing live dot to the line's tip.
    const step = () => {
      const chart = chartRef.current;
      const s = seriesRef.current;
      const target = targetRef.current;
      if (chart && s && target) {
        const cur = renderValueRef.current ?? target.value;
        const diff = target.value - cur;
        const next = Math.abs(diff) < 1e-7 ? target.value : cur + diff * VALUE_EASING;
        if (next !== cur) {
          renderValueRef.current = next;
          s.update({ time: target.time, value: next });
        }

        // Continuous scroll: glide one extra bar of whitespace over the measured
        // tick interval, then the next tick resets it — seamless leftward flow.
        const frac = lastTickAtRef.current
          ? Math.min(1, (performance.now() - lastTickAtRef.current) / tickIntervalRef.current)
          : 0;
        chart.timeScale().scrollToPosition(RIGHT_GAP_BARS + frac, false);

        // Pulsing live dot at the line tip (full-width price line comes from the series).
        const dot = dotRef.current;
        const stub = stubRef.current;
        if (stub) stub.style.opacity = "0";
        const y = s.priceToCoordinate(renderValueRef.current ?? target.value);
        const x = chart.timeScale().timeToCoordinate(target.time);
        if (dot) {
          if (x != null && y != null) {
            dot.style.transform = `translate(${x}px, ${y}px)`;
            dot.style.opacity = "1";
          } else {
            dot.style.opacity = "0";
          }
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || ticks.length === 0) return;

    const latest = ticks[ticks.length - 1];
    const prev = ticks[ticks.length - 2];
    const last = lastPointRef.current;

    // Smooth path: exactly one new tick was appended to the series we already
    // rendered — the point now second-to-last is the *same* point (time AND
    // value) we last drew. update() animates the new point in and auto-scrolls,
    // instead of setData() which re-anchors the whole view and flickers.
    //
    // Matching on value as well as time matters: the seed and an incoming
    // history/market replace are both timestamped near "now", so a time-only
    // check mistakes a wholesale replace for an append and leaves stale points.
    if (
      last !== null &&
      prev?.time === last.time &&
      prev?.quote === last.value &&
      latest.time > last.time
    ) {
      // Lock the previous point at its exact value (the glide may not have fully
      // arrived), then hand the new point to the rAF loop to glide toward.
      series.update({ time: prev.time, value: prev.quote });
      targetRef.current = { time: latest.time, value: latest.quote };
      if (renderValueRef.current == null) renderValueRef.current = prev.quote;
      lastPointRef.current = { time: latest.time, value: latest.quote };
      // Measure the tick cadence so the continuous scroll keeps pace with it.
      const nowMs = performance.now();
      const dt = nowMs - lastTickAtRef.current;
      if (lastTickAtRef.current && dt > 50 && dt < 5000) {
        tickIntervalRef.current = tickIntervalRef.current * 0.6 + dt * 0.4;
      }
      lastTickAtRef.current = nowMs;
      return;
    }

    // Wholesale reset: initial load, market switch, history replace, or a
    // same-epoch last-tick correction. setData() clears any stale points.
    const data: AreaData<Time>[] = ticks.map((tick) => ({
      time: tick.time,
      value: tick.quote,
    }));
    series.setData(data);
    targetRef.current = { time: latest.time as UTCTimestamp, value: latest.quote };
    renderValueRef.current = latest.quote; // snap on load / market switch (no glide)
    lastPointRef.current = { time: latest.time, value: latest.quote };
    lastTickAtRef.current = performance.now();
    chartRef.current?.timeScale().scrollToPosition(RIGHT_GAP_BARS, false);
  }, [ticks]);

  // Contract overlay lines — barrier / strike / stop-out / knockout / entry, for
  // whatever contract is being configured or is running. Diffed by id so lines
  // that follow the spot (e.g. the accumulator band) update in place rather than
  // flicker, and lines that vanish are removed.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const want = lines ?? [];
    const wantIds = new Set(want.map((l) => l.id));
    const map = priceLinesRef.current;

    for (const [id, line] of map) {
      if (!wantIds.has(id)) { series.removePriceLine(line); map.delete(id); }
    }
    for (const l of want) {
      const opts = {
        price: l.price, color: l.color, lineWidth: 1 as const,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true, title: l.title,
      };
      const existing = map.get(l.id);
      if (existing) existing.applyOptions(opts);
      else map.set(l.id, series.createPriceLine(opts));
    }
  }, [lines]);

  // Entry / exit markers pinned to tick times.
  useEffect(() => {
    const plugin = markersRef.current;
    if (!plugin) return;
    const ms: SeriesMarker<Time>[] = (markers ?? []).map((m) => ({
      time: m.time,
      position: m.above ? "aboveBar" : "belowBar",
      color: m.color,
      shape: "circle",
      text: m.text,
    }));
    plugin.setMarkers(ms);
  }, [markers]);

  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const current = ts.options().barSpacing ?? 12;
    ts.applyOptions({ barSpacing: Math.min(60, Math.max(2, current * factor)) });
  };

  const recenter = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    ts.applyOptions({ barSpacing: 16 });
    ts.scrollToPosition(RIGHT_GAP_BARS, false);
  };

  return (
    <div className="relative h-full min-h-[180px] overflow-hidden bg-[#151518] sm:min-h-[260px]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Dashed price stub — runs from the live dot to the right edge only (the
          full-width price line is disabled). Positioned each frame by the rAF loop. */}
      <div ref={stubRef} className="pointer-events-none absolute left-0 top-0 z-10 h-0 opacity-0 will-change-transform"
        style={{ borderTop: "1px dashed rgba(59,130,246,0.9)" }} />

      {/* Pulsing live price dot — positioned at the line's tip each frame by the
          rAF loop (Deriv-style). */}
      <div ref={dotRef} className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 will-change-transform">
        <span className="relative flex h-3 w-3 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white ring-2 ring-[#151518]" />
        </span>
      </div>

      {/* Deriv-style zoom / recenter controls — lifted above the TradingView
          attribution logo and given enough contrast to read on the dark chart */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 sm:bottom-12">
        <button type="button" onClick={() => zoom(1.3)} title="Zoom in" aria-label="Zoom in"
          className="grid h-7 w-7 place-items-center rounded border border-white/10 bg-[#1c1d24]/90 text-slate-100 shadow-lg backdrop-blur transition hover:bg-[#22242a] sm:h-8 sm:w-8">
          <Icon name="add" className="text-[15px] sm:text-[18px]" />
        </button>
        <button type="button" onClick={recenter} title="Latest" aria-label="Scroll to latest"
          className="grid h-7 w-7 place-items-center rounded border border-white/10 bg-[#1c1d24]/90 text-slate-100 shadow-lg backdrop-blur transition hover:bg-[#22242a] sm:h-8 sm:w-8">
          <Icon name="my_location" className="text-[14px] sm:text-[16px]" />
        </button>
        <button type="button" onClick={() => zoom(1 / 1.3)} title="Zoom out" aria-label="Zoom out"
          className="grid h-7 w-7 place-items-center rounded border border-white/10 bg-[#1c1d24]/90 text-slate-100 shadow-lg backdrop-blur transition hover:bg-[#22242a] sm:h-8 sm:w-8">
          <Icon name="remove" className="text-[15px] sm:text-[18px]" />
        </button>
      </div>

      <span className="absolute bottom-3 right-3 z-10 rounded bg-[#1c1d24]/90 px-2 py-1 text-[10px] font-black text-emerald-300 backdrop-blur">LIVE</span>
    </div>
  );
}

interface BinaryClientProps {
  userId?:   string;
  username?: string;
  balance?:  number;
  liveTypes: TradeTypeId[];
}

export function BinaryClient(props: BinaryClientProps) {
  return (
    <PlayUsdProvider>
      <BinaryClientInner {...props} />
    </PlayUsdProvider>
  );
}

function BinaryClientInner({ userId, balance: initialBalance = 0, liveTypes }: BinaryClientProps) {
  const isLive = !!userId;
  const bok = useIsBinarySurface();
  const { brand } = useSiteConfig();
  const chartTheme = bok
    ? brand === "BinaryMarket" ? BM_THEME
    : brand === "MoneyBinary" ? MBK_THEME
    : BOK_THEME
    : BINARY_THEME;
  const setNavBadge = useNavBadge()?.setBadge;
  // Forced USD display for Binary; stakes posted to the server stay KES.
  const { convert, toKes, currency } = useCurrency();
  const money = (kes: number, opts?: Intl.NumberFormatOptions) => fmtMoney(kes, currency, convert, opts);
  const minStake = useMemo(() => Math.max(1, toKes(MIN_PLAY_USD)), [toKes]);
  const stakePresets = useMemo(
    () => STAKE_PRESETS_USD.map((usd) => Math.max(minStake, toKes(usd))),
    [toKes, minStake],
  );

  const [marketSymbol, setMarketSymbol] = useState(MARKETS[0].symbol);
  const market = MARKETS.find((item) => item.symbol === marketSymbol) ?? MARKETS[0];
  const [ticks, setTicks] = useState(() => seedTicks(market));
  // Raw price points for the shared live chart (memoised so it only changes with ticks).
  const livePoints = useMemo(() => ticks.map((t) => ({ time: t.time, value: t.quote })), [ticks]);
  const [family, setFamily] = useState<ContractFamily>(() => {
    const defaultType = pickDefaultTradeType(liveTypes);
    return DIGIT_TYPE_TO_FAMILY[defaultType] ?? "evenOdd";
  });
  const [tradeType, setTradeType] = useState<TradeTypeId>(() => pickDefaultTradeType(liveTypes));
  // Manual vs. server-driven auto-trader (lib/auto-trade). Self-contained panel.
  const [autoMode, setAutoMode] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyEnabled, setCopyEnabled] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/copy/leaders")
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => {
        if (!cancelled) setCopyEnabled(d.enabled === true);
      })
      .catch(() => { if (!cancelled) setCopyEnabled(false); });
    return () => { cancelled = true; };
  }, []);
  const [growthRate, setGrowthRate] = useState(3);
  const [takeProfitOn, setTakeProfitOn] = useState(false);
  const [takeProfit, setTakeProfit] = useState(18);
  // Leveraged config (Multipliers, Turbos).
  const [multiplier, setMultiplier] = useState(100);
  const [stopLossOn, setStopLossOn] = useState(false);
  const [stopLoss, setStopLoss] = useState(5);

  const isDigitType = tradeType in DIGIT_TYPE_TO_FAMILY;
  // Mobile quick bar uses a fixed order (digits first, most-played) so tapping a
  // type never reshuffles the bar under the user's finger.
  const recentTypes = DEFAULT_TYPE_ORDER.filter((t) => liveTypes.includes(t));
  const selectTradeType = useCallback((id: TradeTypeId) => {
    if (!liveTypes.includes(id)) return;
    setTradeType(id);
    const fam = DIGIT_TYPE_TO_FAMILY[id];
    if (fam) setFamily(fam);
  }, [liveTypes]);
  const [stake, setStake] = useState(FALLBACK_USD_KES);
  useEffect(() => {
    setStake((s) => (s < minStake ? minStake : s));
  }, [minStake]);
  const [targetDigit, setTargetDigit] = useState(5);
  const setDigitTarget = useCallback((digit: number) => {
    const next = Math.round(digit);
    setTargetDigit(family === "overUnder"
      ? Math.min(8, Math.max(1, next))
      : Math.min(9, Math.max(0, next)));
  }, [family]);
  useEffect(() => {
    if (family === "overUnder" && (targetDigit < 1 || targetDigit > 8)) {
      setTargetDigit(Math.min(8, Math.max(1, targetDigit)));
    }
  }, [family, targetDigit]);
  const [duration, setDuration] = useState(5);
  // Over/Under short ticks were house-bleeding — silently lift to the server min
  // instead of leaving Buy stuck on a sermon about "unavailable".
  useEffect(() => {
    if (family === "overUnder" && duration < MIN_OVER_UNDER_TICKS) {
      setDuration(MIN_OVER_UNDER_TICKS);
    }
  }, [family, duration]);
  // Duration is canonical in ticks; for options contracts the user may pick in
  // seconds instead (Deriv-style). We keep the unit only for display/picker — the
  // contract is still placed in ticks (seconds → ticks via the market's tick speed).
  const [durationUnit, setDurationUnit] = useState<"ticks" | "seconds">("ticks");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState(initialBalance);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [placing, setPlacing] = useState(false);
  const [openTrades, setOpenTrades] = useState<BinaryTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<BinaryTrade[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [persistedPositions, setPersistedPositions] = useState<ClosedPosition[]>([]);
  const [transactions, setTransactions] = useState<string[]>([]);
  const [tab, setTab] = useState<"open" | "closed" | "tx">("open");
  // Desktop activity rail is collapsed by default to give the chart room; it
  // pops open automatically the moment a position is opened.
  const [railOpen, setRailOpen] = useState(false);

  // Mobile bottom-nav panels (Markets / Positions) are URL-driven via `?panel=`,
  // so the section-native tabs in AppShell can open in-page surfaces without a
  // shared context. Trade is the base view (no param).
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get("panel");
  const [mobileActivityOpen, setMobileActivityOpen] = useState(false);
  const [marketsOpen, setMarketsOpen] = useState(false);
  // Mobile chart tools (Deriv-style): "1t" chart-types + drawing tools. UI shell
  // only for now — the sheets show "coming soon".
  const [chartSheet, setChartSheet] = useState<null | "types" | "drawing">(null);
  useEffect(() => {
    setMobileActivityOpen(panel === "positions");
    setMarketsOpen(panel === "markets");
  }, [panel]);
  // Clear the panel param (back to Trade) when a sheet is dismissed.
  const closePanel = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const balance = isLive ? liveBalance : demoBalance;

  // Accumulators: one in-flight contract at a time (mirrors Deriv).
  const [accaPos, setAccaPos] = useState<AccaPosition | null>(null);
  const [accaPlacing, setAccaPlacing] = useState(false);
  const [accaClosing, setAccaClosing] = useState(false);
  const accaPosRef     = useRef<AccaPosition | null>(null);
  const accaClosingRef = useRef(false);
  useEffect(() => { accaPosRef.current = accaPos; }, [accaPos]);

  // Directional contracts (Rise/Fall, Higher/Lower).
  const [barrierOffset, setBarrierOffset] = useState(0);
  // Brief chart-line pulse when the user focuses / edits barrier or strike offset.
  const [barrierPulseUntil, setBarrierPulseUntil] = useState(0);
  const pulseBarrierLine = useCallback((focused?: boolean) => {
    if (focused === false) return;
    setBarrierPulseUntil(Date.now() + 1100);
  }, []);
  useEffect(() => {
    if (!barrierPulseUntil) return;
    const ms = Math.max(0, barrierPulseUntil - Date.now());
    const id = setTimeout(() => setBarrierPulseUntil(0), ms || 50);
    return () => clearTimeout(id);
  }, [barrierPulseUntil]);
  const barrierLinePulsing = barrierPulseUntil > Date.now();
  const [dirPlacing, setDirPlacing] = useState(false);
  const [dirTrades, setDirTrades] = useState<DirTrade[]>([]);
  const dirTradesRef = useRef<DirTrade[]>([]);
  const dirInFlight  = useRef(new Set<string>()); // real trades awaiting server settle
  const dirSettled   = useRef(new Set<string>()); // demo trades settled locally
  useEffect(() => { dirTradesRef.current = dirTrades; }, [dirTrades]);

  // Leveraged: one in-flight contract at a time (mirrors Deriv/Accumulators).
  const [levPos, setLevPos] = useState<LevPosition | null>(null);
  const [levPlacing, setLevPlacing] = useState(false);
  const [levClosing, setLevClosing] = useState(false);
  const levPosRef     = useRef<LevPosition | null>(null);
  const levClosingRef = useRef(false);
  useEffect(() => { levPosRef.current = levPos; }, [levPos]);

  // Auto-open the desktop activity rail the moment any contract type opens.
  const hasOpenPositions = openTrades.length > 0 || dirTrades.length > 0 || !!accaPos || !!levPos;
  useEffect(() => {
    if (hasOpenPositions) setRailOpen(true);
  }, [hasOpenPositions]);

  // Load persisted closed trades from DB on mount (live users only). History is
  // cross-family: digit, directional, accumulator and leveraged contracts all
  // feed the same Closed tab, sorted by settlement time. Also hydrate PENDING
  // digit/directional rows (including server-placed copy fills) into Open.
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;

    async function loadHistory() {
      try {
        const [digits, directional, accumulators, leveraged] = await Promise.all([
          fetch("/api/binary/history").then((r) => r.ok ? r.json() : []),
          fetch("/api/directional/history").then((r) => r.ok ? r.json() : []),
          fetch("/api/accumulator/history").then((r) => r.ok ? r.json() : []),
          fetch("/api/leveraged/history").then((r) => r.ok ? r.json() : []),
        ]) as [
          Array<{
            id: string; market: string; side: string; stake: number; payout: number;
            targetDigit: number; entryDigit: number; exitDigit?: number | null;
            entryEpoch?: number | null; durationTicks: number; status: string;
            settledAt?: string | null; createdAt: string; copyLeaderUsername?: string | null;
          }>,
          Array<{
            id: string; market: string; kind: string; side: string; stake: number;
            payout?: number | null; entrySpot?: number; entryEpoch?: number;
            barrier?: number | null; payoutPerPoint?: number | null;
            durationTicks?: number | null; status: string;
            settledAt?: string | null; createdAt: string; copyLeaderUsername?: string | null;
          }>,
          Array<{ id: string; market: string; growthRate: number; stake: number; payout?: number | null; ticksSurvived?: number | null; status: string; settledAt?: string | null; createdAt: string }>,
          Array<{ id: string; market: string; kind: string; direction: string; stake: number; payout?: number | null; status: string; settledAt?: string | null; createdAt: string }>,
        ];
        if (cancelled) return;

        setPersistedPositions(mergeClosedPositions(
          digits.filter((t) => t.status !== "PENDING").map((t) => toBinaryClosedPosition({ ...t, isReal: true })),
          directional.filter((t) => t.status !== "PENDING").map((t) => toDirectionalClosedPosition({ ...t, isReal: true })),
          accumulators.filter((t) => t.status !== "OPEN").map((t) => toAccumulatorClosedPosition({ ...t, isReal: true })),
          leveraged.filter((t) => t.status !== "OPEN").map((t) => toLeveragedClosedPosition({ ...t, isReal: true })),
        ));

        // Merge server PENDING into local open lists so copy fills and refreshes show.
        const pendingDigits = digits.filter((t) => t.status === "PENDING");
        if (pendingDigits.length) {
          setOpenTrades((cur) => {
            const byId = new Map(cur.map((t) => [t.id, t]));
            for (const t of pendingDigits) {
              if (byId.has(t.id)) {
                const prev = byId.get(t.id)!;
                if (t.copyLeaderUsername && !prev.copyLeaderUsername) {
                  byId.set(t.id, { ...prev, copyLeaderUsername: t.copyLeaderUsername });
                }
                continue;
              }
              const mkt = MARKETS.find((m) => m.derivSymbol === t.market);
              const openedAt = new Date(t.createdAt).getTime();
              const entryEpochMs = (t.entryEpoch ?? Math.floor(openedAt / 1000)) * 1000;
              const speedMs = mkt?.speedMs ?? 1000;
              byId.set(t.id, {
                id: t.id,
                market: mkt?.symbol ?? t.market,
                side: t.side as ContractSide,
                stake: t.stake,
                payout: t.payout,
                entryDigit: t.entryDigit,
                targetDigit: t.targetDigit,
                openedAt,
                settlesAt: entryEpochMs + t.durationTicks * speedMs,
                status: "open",
                isReal: true,
                copyLeaderUsername: t.copyLeaderUsername ?? null,
              });
            }
            return Array.from(byId.values()).slice(0, 12);
          });
        }

        const pendingDir = directional.filter((t) => t.status === "PENDING");
        if (pendingDir.length) {
          setDirTrades((cur) => {
            const byId = new Map(cur.map((t) => [t.id, t]));
            for (const t of pendingDir) {
              if (byId.has(t.id)) {
                const prev = byId.get(t.id)!;
                if (t.copyLeaderUsername && !prev.copyLeaderUsername) {
                  byId.set(t.id, { ...prev, copyLeaderUsername: t.copyLeaderUsername });
                }
                continue;
              }
              const mkt = MARKETS.find((m) => m.derivSymbol === t.market);
              const speedMs = mkt?.speedMs ?? 1000;
              const entryEpoch = t.entryEpoch ?? Math.floor(Date.now() / 1000);
              byId.set(t.id, {
                id: t.id,
                market: mkt?.symbol ?? t.market,
                derivSymbol: t.market,
                kind: t.kind as DirectionalKind,
                side: t.side as DirectionalSide,
                stake: t.stake,
                payout: Number(t.payout ?? 0),
                payoutPerPoint: t.payoutPerPoint ?? null,
                entrySpot: Number(t.entrySpot ?? 0),
                entryEpoch,
                barrier: t.barrier ?? null,
                durationTicks: t.durationTicks ?? 0,
                isReal: true,
                settlesAt: entryEpoch * 1000 + (t.durationTicks ?? 0) * speedMs,
                status: "open",
                copyLeaderUsername: t.copyLeaderUsername ?? null,
              });
            }
            return Array.from(byId.values());
          });
        }
      } catch {
        /* transient */
      }
    }

    void loadHistory();
    const id = window.setInterval(() => { void loadHistory(); }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLive]);

  // Merge session trades with persisted DB trades (dedup by id) and always sort
  // newest first so the last played/settled contract appears at the top.
  const allClosedPositions = useMemo(() => mergeClosedPositions(
    closedTrades.map((t) => toBinaryClosedPosition({
      ...t,
      status: t.status === "won" ? "WON" : "LOST",
      settledAt: new Date(t.openedAt + Math.max(0, t.settlesAt - t.openedAt)),
    })),
    closedPositions,
    persistedPositions,
  ), [closedTrades, closedPositions, persistedPositions]);

  useEffect(() => {
    setTicks(seedTicks(market));
    setOpenTrades([]);
    setStreamStatus("connecting");
    setStreamError(null);
  }, [market]);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | undefined;
    let fallbackTimer: number | undefined;

    function startFallback(message: string) {
      if (!active || fallbackTimer) return;
      setStreamStatus("fallback");
      setStreamError(message);
      fallbackTimer = window.setInterval(() => {
        setTicks((current) => [...current.slice(-3599), nextTick(current[current.length - 1], market)]);
      }, market.speedMs);
    }

    socket = new WebSocket(DERIV_WS_URL);

    socket.onopen = () => {
      if (!active || !socket) return;
      socket.send(JSON.stringify({
        ticks_history: market.derivSymbol,
        adjust_start_time: 1,
        count: 3600,
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
        startFallback("Deriv returned an unreadable tick message.");
        return;
      }

      if (response.error) {
        startFallback(response.error.message ?? "Deriv tick stream returned an error.");
        return;
      }

      if (response.history?.prices?.length && response.history.times?.length) {
        const historyTicks = response.history.prices
          .map((quote, index) => toTick(response.history?.times?.[index] ?? Math.floor(Date.now() / 1000), quote))
          .filter((tick, index, all) => index === 0 || tick.time > all[index - 1].time)
          .slice(-3600);
        if (historyTicks.length > 0) {
          setTicks(historyTicks);
          setStreamStatus("live");
          setStreamError(null);
        }
      }

      if (response.tick) {
        setTicks((current) => {
          const next = toTick(response.tick!.epoch, response.tick!.quote);
          const last = current[current.length - 1];
          if (last?.time === next.time) return [...current.slice(0, -1), next];
          return [...current.slice(-3599), next];
        });
        setStreamStatus("live");
        setStreamError(null);
      }
    };

    socket.onerror = () => {
      startFallback("Deriv tick stream is unavailable.");
    };

    socket.onclose = () => {
      startFallback("Deriv tick stream disconnected.");
    };

    return () => {
      active = false;
      if (fallbackTimer) window.clearInterval(fallbackTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, [market]);

  const latest = ticks[ticks.length - 1];

  // Refs so interval callbacks always read latest state without stale closures
  const latestRef     = useRef(latest);
  const ticksRef      = useRef(ticks);
  const openTradesRef = useRef(openTrades);
  useEffect(() => { ticksRef.current = ticks; }, [ticks]);
  const settledIds    = useRef(new Set<string>()); // demo trades, settled client-side
  const inFlightRef   = useRef(new Set<string>()); // real trades, awaiting server settle
  useEffect(() => { latestRef.current = latest; },         [latest]);
  useEffect(() => { openTradesRef.current = openTrades; }, [openTrades]);

  const change = latest.quote - (ticks[0]?.quote ?? latest.quote);
  const changePct = (change / Math.max(1, ticks[0]?.quote ?? latest.quote)) * 100;
  // Hide sides the server will reject so the UI never offers a dead bet:
  // Under on markets where it's quarantined (see lib/binary/quarantine).
  // Matches is live again via kernel pricing + stability gate in priceDigitServer.
  const selectedSides = familySides(family).filter(
    (s) => !(s === "Under" && isUnderQuarantined(marketSymbol)),
  );

  // Live digit quotes from POST /api/binary/quote (priceDigitServer).
  // Explicit rejections are kept so Matches never falls back to a fake ~8×
  // static preview while the server would refuse the trade.
  type LiveDigitQuote =
    | { accepted: true; payout: number }
    | { accepted: false; reason: string };
  const [liveDigitQuotes, setLiveDigitQuotes] = useState<Partial<Record<ContractSide, LiveDigitQuote>>>({});
  const selectedSidesKey = selectedSides.join(",");
  useEffect(() => {
    if (!isDigitType || stake <= 0) return;
    let cancelled = false;
    const sides = selectedSidesKey.split(",").filter(Boolean) as ContractSide[];
    if (!sides.length) return;
    // Drop stale payouts/reasons when market/target/stake/duration changes.
    setLiveDigitQuotes({});

    const fetchQuotes = async () => {
      try {
        const res = await fetch("/api/binary/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            market: market.derivSymbol,
            sides,
            stake,
            targetDigit,
            durationTicks: duration,
          }),
        });
        const data = await res.json() as {
          quotes?: Record<string, { accepted: boolean; payout?: number; reason?: string }>;
        };
        if (cancelled || !res.ok || !data.quotes) return;
        setLiveDigitQuotes(() => {
          const next: Partial<Record<ContractSide, LiveDigitQuote>> = {};
          for (const side of sides) {
            const q = data.quotes![side];
            if (q?.accepted && typeof q.payout === "number") {
              next[side] = { accepted: true, payout: q.payout };
            } else if (q && q.accepted === false) {
              next[side] = { accepted: false, reason: q.reason || "Unavailable" };
            }
          }
          return next;
        });
      } catch {
        // Keep last live quote on transient network blips.
      }
    };

    const debounce = setTimeout(fetchQuotes, 280);
    const poll = setInterval(fetchQuotes, 3000);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearInterval(poll);
    };
  }, [isDigitType, market.derivSymbol, stake, duration, targetDigit, selectedSidesKey]);

  const digitRejectReason = useCallback((side: ContractSide): string | null => {
    const q = liveDigitQuotes[side];
    if (q && !q.accepted) return shortDigitRejectReason(q.reason, side);
    // Matches requires a live accepted quote — never offer on static preview.
    if (side === "Matches" && !q?.accepted) return "Pricing…";
    return null;
  }, [liveDigitQuotes]);

  const digitPayoutFor = useCallback((side: ContractSide) => {
    const q = liveDigitQuotes[side];
    if (q?.accepted) return q.payout;
    // Rejected / pending Matches → hide inflated static ~8× payout.
    if ((q && !q.accepted) || side === "Matches") return 0;
    return previewDigitPayout(stake, side, targetDigit);
  }, [liveDigitQuotes, stake, targetDigit]);

  // Client-only hint: digits outside the Matches freq band look "less available".
  // Server gates stay fail-closed — this never enables a trade.
  const lessAvailableDigits = useMemo(() => {
    if (family !== "matchDiffer" || ticks.length < 40) return undefined;
    const counts = Array<number>(10).fill(0);
    for (const t of ticks) counts[t.digit]++;
    const n = ticks.length;
    const out = new Set<number>();
    for (let d = 0; d < 10; d++) {
      const freq = counts[d] / n;
      if (freq < MATCHES_FREQ_LO || freq > MATCHES_FREQ_HI) out.add(d);
    }
    return out.size ? out : undefined;
  }, [family, ticks]);

  // Matches: silently hop off busy digits instead of sticking "unavailable" on Buy.
  useEffect(() => {
    if (family !== "matchDiffer" || !lessAvailableDigits?.has(targetDigit)) return;
    const open = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !lessAvailableDigits.has(d));
    if (!open.length) return;
    const next = open.includes(latest.digit)
      ? latest.digit
      : open.reduce((best, d) =>
          Math.abs(d - targetDigit) < Math.abs(best - targetDigit) ? d : best,
        );
    if (next !== targetDigit) setTargetDigit(next);
  }, [family, lessAvailableDigits, targetDigit, latest.digit]);

  // Live net payout (what an accumulator cash-out would credit now).
  const accaNetPayout = accaPos
    ? retainedPayout(accaPos.stake, payoutAtTick(accaPos.stake, accaPos.growthRate, accaPos.ticksSurvived))
    : 0;

  // Directional derived values (Rise/Fall, Higher/Lower, Touch/No-Touch, Vanilla).
  const dirKind = DIRECTIONAL_KIND[tradeType];
  const isDirectionalType = !!dirKind;
  const isVanillaType = dirKind === "VANILLA";
  const dirSides: DirectionalSide[] = dirKind ? DIRECTIONAL_SIDES[dirKind] : ["RISE", "FALL"];
  const clientSigma = useMemo(() => {
    try { return computeSigma(ticks.slice(-(SIGMA_WINDOW + 1)).map((t) => t.quote)); } catch { return null; }
  }, [ticks]);
  // Fair barrier band: keep the offset within ±K·σ·√duration of spot so the
  // contract prices into a sensible win-chance band. Beyond it the server rejects
  // the trade ("barrier too far") rather than sell a capped, near-unwinnable
  // ticket — this bound keeps the UI inside the sellable range. σ is per-tick.
  const BARRIER_BAND_SIGMAS = 2;
  const maxBarrierOffset = useMemo(() => {
    const frac = (clientSigma ?? 0.003) * Math.sqrt(Math.max(1, duration)) * BARRIER_BAND_SIGMAS;
    return Math.max(0.02, Math.round(latest.quote * frac * 100) / 100);
  }, [clientSigma, duration, latest.quote]);
  // Server rejects barriers closer than MIN_BARRIER_FRAC (0.1%) — keep the picker outside that dead zone.
  const minBarrierOffset = useMemo(
    () => minBarrierOffsetPts(latest.quote),
    [latest.quote],
  );
  const minDurationTicks = dirKind === "RISE_FALL" && market.derivSymbol.startsWith("1HZ") ? 2 : 1;

  // Live directional quotes (priceDirectionalServer) for fixed-payout kinds.
  // Keep explicit rejections so Buy can disable calmly (Matches pattern).
  type LiveDirQuote =
    | { accepted: true; payout: number }
    | { accepted: false; reason: string };
  const [liveDirQuotes, setLiveDirQuotes] = useState<Partial<Record<DirectionalSide, LiveDirQuote>>>({});
  const dirSidesKey = dirSides.join(",");
  const needsDirQuote = isDirectionalType && !isVanillaType && !!dirKind;
  useEffect(() => {
    if (!needsDirQuote || stake <= 0 || !dirKind) return;
    if ((dirKind === "HIGHER_LOWER" || dirKind === "TOUCH_NO_TOUCH") && barrierOffset === 0) return;
    let cancelled = false;
    const sides = dirSidesKey.split(",").filter(Boolean) as DirectionalSide[];
    if (!sides.length) return;
    setLiveDirQuotes({});

    const fetchQuotes = async () => {
      try {
        const res = await fetch("/api/directional/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            market: market.derivSymbol,
            kind: dirKind,
            sides,
            stake,
            durationTicks: duration,
            barrierOffset: dirKind === "RISE_FALL" ? 0 : barrierOffset,
          }),
        });
        const data = await res.json() as {
          quotes?: Record<string, { accepted: boolean; payout?: number; reason?: string }>;
        };
        if (cancelled || !res.ok || !data.quotes) return;
        setLiveDirQuotes(() => {
          const next: Partial<Record<DirectionalSide, LiveDirQuote>> = {};
          for (const side of sides) {
            const q = data.quotes![side];
            if (q?.accepted && typeof q.payout === "number") {
              next[side] = { accepted: true, payout: q.payout };
            } else if (q && q.accepted === false) {
              next[side] = { accepted: false, reason: q.reason || "Unavailable" };
            }
          }
          return next;
        });
      } catch {
        /* keep last / fall back to client preview */
      }
    };

    const debounce = setTimeout(fetchQuotes, 280);
    const poll = setInterval(fetchQuotes, 3000);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearInterval(poll);
    };
  }, [needsDirQuote, dirKind, market.derivSymbol, stake, duration, barrierOffset, dirSidesKey]);

  const dirRejectReason = useCallback((side: DirectionalSide): string | null => {
    // Client gate matches server MIN_BARRIER_FRAC — disable calmly, never toast "Trade failed".
    if ((dirKind === "HIGHER_LOWER" || dirKind === "TOUCH_NO_TOUCH")
        && (barrierOffset === 0 || Math.abs(barrierOffset) + 1e-10 < minBarrierOffset)) {
      return BARRIER_TOO_CLOSE_COPY;
    }
    const q = liveDirQuotes[side];
    if (q && !q.accepted) return shortDirectionalRejectReason(q.reason, dirKind);
    return null;
  }, [liveDirQuotes, dirKind, barrierOffset, minBarrierOffset]);

  // Fixed-payout preview: prefer live server quote; else client estimate.
  // Rise/Fall used to hardcode 1.90× + retention while place used Wilson pricing.
  const dirPayoutFor = (side: DirectionalSide): number => {
    const live = liveDirQuotes[side];
    if (live?.accepted) return live.payout;
    if (live && !live.accepted) return 0;
    let rate = 1.90;
    if (dirKind === "HIGHER_LOWER" || dirKind === "TOUCH_NO_TOUCH") {
      if (!clientSigma) return 0;
      rate = dirPayoutRate({ kind: dirKind, side, entrySpot: latest.quote, barrier: latest.quote + barrierOffset, sigmaTick: clientSigma, durationTicks: duration });
    }
    // Server fixed kinds do not apply client retention — only use it on the
    // static fallback so a failed quote still shows something plausible.
    return dirKind === "RISE_FALL" ? Number((stake * rate).toFixed(2)) : retainedPayout(stake, stake * rate);
  };
  // Vanilla preview: contracts bought (payout per in-the-money point), capped credit.
  const dirPayoutPerPoint = (side: DirectionalSide): number => {
    if (!clientSigma || (side !== "CALL" && side !== "PUT")) return 0;
    return vanillaPayoutPerPoint({ entrySpot: latest.quote, strike: latest.quote + barrierOffset, side, sigmaTick: clientSigma, durationTicks: duration, stake });
  };
  const dirMaxPayout = retainedPayout(stake, stake * MAX_VANILLA_MULT);
  const dirOpenPositions = dirTrades.map((t) => ({ id: t.id, side: t.side, settlesAt: t.settlesAt }));

  // Leveraged derived values (Multipliers, Turbos). Danger line + payout-per-
  // point are previewed off the live spot for the current config; when a contract
  // is running we report its live retained value for the cash-out button.
  const levKind = LEVERAGED_KIND[tradeType];
  const isLeveragedType = !!levKind;
  const levMaxPayout = retainedPayout(stake, stake * LEVERAGED_MAX_MULT);
  const levConfigDanger = levKind === "TURBO"
    ? clampTurboBarrier(latest.quote, latest.quote + barrierOffset, "UP") // preview vs UP; flips by direction on buy
    : multiplierStopOutPrice(latest.quote, multiplier, "UP");
  const levConfigPpp = levKind === "TURBO"
    ? turboPayoutPerPoint(stake, latest.quote, clampTurboBarrier(latest.quote, latest.quote + barrierOffset, "UP"))
    : 0;
  const levRunning = (() => {
    if (!levPos || market.derivSymbol !== levPos.derivSymbol) return null;
    const { value } = leveragedValueAt(levPos, latest.quote);
    const gross = Math.min(value, levPos.stake * LEVERAGED_MAX_MULT);
    return {
      kind: levPos.kind, direction: levPos.direction, stake: levPos.stake,
      netPayout: retainedPayout(levPos.stake, Math.max(0, gross)),
      multiplier: levPos.multiplier, dangerSpot: levPos.barrier,
    };
  })();

  // Chart overlays — barrier/strike/stop-out/knockout/entry lines + entry markers
  // for whatever contract is running or being configured, drawn on the price
  // chart (Deriv-style). A running cash-out position owns the chart; otherwise we
  // show open directional barriers plus a live preview of the selected type.
  const ENTRY_COLOR = "#94a3b8", BARRIER_COLOR = "#f59e0b", DANGER_COLOR = "#ef4444";
  const chartLines: ChartLine[] = (() => {
    if (accaPos && market.derivSymbol === accaPos.derivSymbol) {
      return [
        { id: "acc-up", price: latest.quote * (1 + accaPos.barrierFrac), color: BARRIER_COLOR, title: "▲", dashed: true },
        { id: "acc-lo", price: latest.quote * (1 - accaPos.barrierFrac), color: BARRIER_COLOR, title: "▼", dashed: true },
      ];
    }
    if (levPos && market.derivSymbol === levPos.derivSymbol) {
      const out: ChartLine[] = [{ id: "lev-entry", price: levPos.entrySpot, color: ENTRY_COLOR, title: "Entry", dashed: true }];
      if (levPos.barrier != null) out.push({ id: "lev-danger", price: levPos.barrier, color: DANGER_COLOR, title: levPos.kind === "TURBO" ? "Barrier" : "Stop out" });
      return out;
    }
    const out: ChartLine[] = [];
    // Open directional trades on this market — their barrier/strike lines.
    for (const t of dirTrades) {
      if (t.status !== "open" || t.derivSymbol !== market.derivSymbol || t.barrier == null) continue;
      out.push({ id: `dir-${t.id}`, price: t.barrier, color: BARRIER_COLOR, title: t.side === "NO_TOUCH" ? "NO TOUCH" : t.side, dashed: true });
      if (out.length >= 4) break;
    }
    // Live preview of the barrier/strike/stop-out for the type being configured.
    if (isDirectionalType && dirKind && dirKind !== "RISE_FALL") {
      out.push({
        id: "cfg-barrier",
        price: latest.quote + barrierOffset,
        color: BARRIER_COLOR,
        title: dirKind === "VANILLA" ? "Strike" : "Barrier",
        dashed: true,
        pulse: barrierLinePulsing,
      });
    } else if (isLeveragedType && !levPos) {
      out.push({
        id: "cfg-danger",
        price: levConfigDanger,
        color: DANGER_COLOR,
        title: levKind === "TURBO" ? "Barrier" : "Stop out",
        dashed: true,
        pulse: barrierLinePulsing,
      });
    }
    return out;
  })();
  const chartMarkers: ChartMarker[] = (() => {
    const out: ChartMarker[] = [];
    if (accaPos && market.derivSymbol === accaPos.derivSymbol)
      out.push({ id: "m-acc", time: accaPos.entryEpoch as UTCTimestamp, color: ENTRY_COLOR, text: "Buy" });
    if (levPos && market.derivSymbol === levPos.derivSymbol)
      out.push({ id: "m-lev", time: levPos.entryEpoch as UTCTimestamp, color: levPos.direction === "UP" ? "#16a085" : "#e2474b", text: levPos.direction === "UP" ? "▲" : "▼", above: levPos.direction === "DOWN" });
    for (const t of dirTrades) {
      if (t.status !== "open" || t.derivSymbol !== market.derivSymbol) continue;
      out.push({ id: `m-${t.id}`, time: t.entryEpoch as UTCTimestamp, color: ENTRY_COLOR, text: "Buy" });
      if (out.length >= 5) break;
    }
    return out;
  })();

  // Every open contract, unified for the activity rail's "Open" tab. Digit and
  // directional contracts settle on a countdown; accumulator and leveraged are
  // live cash-out (value moves each tick). Recomputed on every tick so live
  // values stay current.
  const openPositions: OpenPositionView[] = [
    ...openTrades.map((t) => {
      const interim = digitInterimStatus({
        side: t.side, targetDigit: t.targetDigit, liveDigit: latest.digit, settlesAt: t.settlesAt,
      });
      return {
        id: t.id, title: t.side, subtitle: `${t.market} · digit ${t.entryDigit}`,
        stake: t.stake, value: t.payout, isReal: t.isReal ?? false, settlesAt: t.settlesAt,
        interim,
        copyLeaderUsername: t.copyLeaderUsername ?? null,
      };
    }),
    ...dirTrades.filter((t) => t.status === "open").map((t) => {
      const pathSpots = t.kind === "TOUCH_NO_TOUCH"
        ? ticks.filter((tk) => (tk.time as number) > t.entryEpoch).map((tk) => tk.quote)
        : undefined;
      const interim = directionalInterimStatus({
        kind: t.kind, side: t.side, entrySpot: t.entrySpot, barrier: t.barrier,
        liveSpot: latest.quote, settlesAt: t.settlesAt, pathSpots,
      });
      return {
        id: t.id, title: t.side === "NO_TOUCH" ? "NO TOUCH" : t.side,
        subtitle: `${t.market} · ${t.durationTicks} ticks`,
        stake: t.stake, value: t.kind === "VANILLA" ? t.stake : t.payout, isReal: t.isReal, settlesAt: t.settlesAt,
        interim,
        copyLeaderUsername: t.copyLeaderUsername ?? null,
      };
    }),
    ...(accaPos ? [{
      id: accaPos.id, title: `Accumulator ${accaPos.growthRate}%`,
      subtitle: `${accaPos.market} · ${accaPos.ticksSurvived} ticks`,
      stake: accaPos.stake, value: accaNetPayout, isReal: accaPos.isReal,
    }] : []),
    ...(levPos && levRunning ? [{
      id: levPos.id,
      title: `${levPos.kind === "TURBO" ? "Turbo" : `Multiplier ×${levPos.multiplier}`} · ${levPos.direction}`,
      subtitle: levPos.market, stake: levPos.stake, value: levRunning.netPayout, isReal: levPos.isReal,
    }] : []),
  ];

  // The mobile bottom nav lives in AppShell, outside this trader. Publish the
  // complete cross-contract count so Positions retains the red badge until the
  // last digit, directional, accumulator, or leveraged contract settles.
  useEffect(() => {
    setNavBadge?.("positions", openPositions.length);
    return () => setNavBadge?.("positions", 0);
  }, [setNavBadge, openPositions.length]);

  const digitStats = useMemo(() => {
    const recent = ticks.slice(-80);
    return DIGITS.map((digit) => {
      const count = recent.filter((tick) => tick.digit === digit).length;
      return {
        digit,
        count,
        pct: recent.length ? (count / recent.length) * 100 : 0,
      };
    });
  }, [ticks]);

  const sessionPnl = closedTrades.reduce((total, trade) => {
    if (trade.status === "won") return total + trade.payout - trade.stake;
    if (trade.status === "lost") return total - trade.stake;
    return total;
  }, 0);
  const wins = closedTrades.filter((trade) => trade.status === "won").length;
  const losses = closedTrades.filter((trade) => trade.status === "lost").length;

  // Real trades are settled by the server, which derives the exit digit from
  // the live Deriv feed (the client never gets to say whether it won). We just
  // reflect the authoritative result here.
  const applyBinarySettled = useCallback((trade: BinaryTrade, data: {
    won: boolean;
    winAmount?: number;
    entryDigit?: number | null;
    exitDigit: number;
  }) => {
    if (settledIds.current.has(trade.id)) return;
    settledIds.current.add(trade.id);
    const won = data.won;
    const exitDigit = data.exitDigit;
    // Prefer DB entry_digit from settle/Realtime — optimistic place used the
    // client WS lastDigit, which can disagree with the server entry spot.
    const settled = applyServerBinaryDigits(
      { ...trade, exitDigit, status: won ? "won" as const : "lost" as const },
      { entryDigit: data.entryDigit, exitDigit },
    );
    setOpenTrades((cur) => cur.filter((t) => t.id !== trade.id));
    setClosedTrades((cur) => [settled, ...cur].slice(0, 20));
    if (won && data.winAmount) {
      setLiveBalance((b) => b + data.winAmount!);
      window.dispatchEvent(new Event("wallet-refresh"));
    }
    if (won) {
      const credited = data.winAmount ?? trade.payout;
      celebrateWin({
        amount: credited,
        multiplier: trade.stake > 0 ? credited / trade.stake : undefined,
        label: `${trade.side} won!`,
        toastTitle: `${trade.side} won!`,
        toastDescription: `${trade.market} · +${money(credited)}`,
      });
    } else {
      toast.loss(`${trade.side} lost`, `${trade.market} · Exit digit ${exitDigit}`);
    }
    setTab("closed");
  }, [money]);

  const settleReal = useCallback(async (trade: BinaryTrade) => {
    try {
      const res  = await fetch("/api/binary/settle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tradeId: trade.id }),
      });
      const data = await res.json() as {
        won?: boolean; winAmount?: number; entryDigit?: number; exitDigit?: number; error?: string; pending?: boolean; alreadySettled?: boolean; status?: string;
      };
      if (!res.ok) {
        // 503 / not-ready: leave open; fast poll retries within settleBefore.
        if (res.status !== 503 && !data.pending) console.error("binary settle failed:", data.error);
        return false;
      }
      applyBinarySettled(trade, {
        won: !!data.won,
        winAmount: data.winAmount,
        entryDigit: data.entryDigit,
        exitDigit: data.exitDigit ?? 0,
      });
      return true;
    } catch (err) {
      console.error("binary settle error:", err);
      return false;
    }
  }, [applyBinarySettled]);

  // Demo digit settle stays fast; live real trades use Realtime + a short poll
  // so Open clears as soon as the contract is due (not after a 15s lag).
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const pending = openTradesRef.current.filter((t) => t.settlesAt <= now);
      if (pending.length === 0) return;

      const demoPending: BinaryTrade[] = [];
      for (const trade of pending) {
        if (isLive && trade.isReal) continue; // handled by Realtime + live poll below
        if (settledIds.current.has(trade.id)) continue;
        settledIds.current.add(trade.id);
        demoPending.push(trade);
      }

      if (demoPending.length === 0) return;

      const digit = latestRef.current.digit;
      setOpenTrades((cur) => cur.filter((t) => !demoPending.some((p) => p.id === t.id)));
      setClosedTrades((cur) => {
        const settled = demoPending.map((trade) => {
          const won = evaluateTrade(trade.side, digit, trade.targetDigit);
          return { ...trade, exitDigit: digit, status: won ? "won" as const : "lost" as const };
        });
        return [...settled, ...cur].slice(0, 20);
      });

      for (const trade of demoPending) {
        const won = evaluateTrade(trade.side, digit, trade.targetDigit);
        setDemoBalance((b) => won ? b + trade.payout : b);
        if (won) {
          celebrateWin({
            amount: trade.payout,
            multiplier: trade.stake > 0 ? trade.payout / trade.stake : undefined,
            label: `${trade.side} won!`,
            toastTitle: `${trade.side} won!`,
            toastDescription: `${trade.market} · +${money(trade.payout)}`,
          });
        } else {
          toast.loss(`${trade.side} lost`, `${trade.market} · Exit digit ${digit}`);
        }
      }

      setTab("closed");
    }, 500);

    return () => clearInterval(id);
  }, [isLive, money]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      const now = Date.now();
      const pending = openTradesRef.current.filter(
        (t) => t.isReal && t.settlesAt <= now && !t.id.startsWith("pending-"),
      );
      for (const trade of pending) {
        if (inFlightRef.current.has(trade.id) || settledIds.current.has(trade.id)) continue;
        inFlightRef.current.add(trade.id);
        settleReal(trade).finally(() => inFlightRef.current.delete(trade.id));
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [isLive, settleReal]);

  // Close (cash out) the running accumulator. For real contracts the server
  // replays the tick path and decides bust vs payout — we just reflect it. For
  // demo we settle locally. `auto` distinguishes a detected bust from a manual
  // cash-out / take-profit / cap (only meaningful for demo).
  const closeAccumulator = useCallback(async (auto?: "bust" | "take_profit" | "max_ticks") => {
    const pos = accaPosRef.current;
    if (!pos || accaClosingRef.current) return;
    accaClosingRef.current = true;
    setAccaClosing(true);
    try {
      if (pos.isReal) {
        const res  = await fetch("/api/accumulator/close", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tradeId: pos.id }),
        });
        const data = await res.json() as { busted?: boolean; payout?: number; ticksSurvived?: number; error?: string };
        if (!res.ok) {
          // 503 = feed momentarily down; keep the contract open so a later
          // attempt (or the cron) settles it.
          if (res.status !== 503) toast.error("Close failed", data.error ?? "Try again");
          return;
        }
        const busted = !!data.busted;
        const payout = data.payout ?? 0;
        setAccaPos(null);
        setClosedPositions((cur) => mergeClosedPositions([
          toAccumulatorClosedPosition({
            ...pos,
            payout,
            status: payout > 0 ? "CLOSED" : "BUSTED",
            settledAt: new Date(),
            ticksSurvived: data.ticksSurvived ?? pos.ticksSurvived,
          }),
        ], cur).slice(0, 40));
        if (!busted && payout > 0) {
          setLiveBalance((b) => b + payout);
          window.dispatchEvent(new Event("wallet-refresh"));
          if (payout > pos.stake) {
            celebrateWin({
              amount: payout,
              multiplier: payout / pos.stake,
              label: "Accumulator won!",
              toastTitle: "Accumulator won!",
              toastDescription: `+${money(payout)} · ${data.ticksSurvived ?? pos.ticksSurvived} ticks · ${pos.market}`,
            });
          } else {
            toast.cashout(`+${money(payout)} — Accumulator closed!`, `${data.ticksSurvived ?? pos.ticksSurvived} ticks · ${pos.market}`);
          }
        } else {
          toast.loss("Accumulator busted", `Hit the barrier after ${data.ticksSurvived ?? pos.ticksSurvived} ticks.`);
        }
      } else {
        const busted = auto === "bust";
        const gross  = busted ? 0 : payoutAtTick(pos.stake, pos.growthRate, pos.ticksSurvived);
        const payout = busted ? 0 : retainedPayout(pos.stake, gross);
        setAccaPos(null);
        setClosedPositions((cur) => mergeClosedPositions([
          toAccumulatorClosedPosition({
            ...pos,
            payout,
            status: busted ? "BUSTED" : "CLOSED",
            settledAt: new Date(),
          }),
        ], cur).slice(0, 40));
        if (!busted) {
          setDemoBalance((b) => b + payout);
          if (payout > pos.stake) {
            celebrateWin({
              amount: payout,
              multiplier: payout / pos.stake,
              label: "Accumulator won!",
              toastTitle: "Accumulator won!",
              toastDescription: `+${money(payout)} · ${pos.ticksSurvived} ticks`,
            });
          } else {
            toast.cashout(`+${money(payout)} — Accumulator closed!`, `${pos.ticksSurvived} ticks`);
          }
        } else {
          toast.loss("Accumulator busted", `Hit the barrier after ${pos.ticksSurvived} ticks.`);
        }
      }
    } finally {
      accaClosingRef.current = false;
      setAccaClosing(false);
    }
  }, []);

  // Live tracking — fold each new tick into the running contract: bust on a
  // barrier breakout, otherwise grow and auto-close on take-profit / max ticks.
  // The server is authoritative on settlement; this only drives the live display
  // and decides when to fire the close request.
  useEffect(() => {
    const pos = accaPosRef.current;
    if (!pos || pos.status !== "open") return;
    if (market.derivSymbol !== pos.derivSymbol) return; // ignore other-market ticks
    if (latest.time <= pos.lastEpoch) return;            // no genuinely-new tick

    if (Math.abs(latest.quote / pos.prevSpot - 1) > pos.barrierFrac) {
      setAccaPos((p) => (p ? { ...p, status: "lost", lastEpoch: latest.time as number } : p));
      void closeAccumulator("bust");
      return;
    }

    const survived = pos.ticksSurvived + 1;
    setAccaPos((p) => (p ? { ...p, ticksSurvived: survived, prevSpot: latest.quote, lastEpoch: latest.time as number } : p));

    if (pos.takeProfit != null && payoutAtTick(pos.stake, pos.growthRate, survived) - pos.stake >= pos.takeProfit) {
      void closeAccumulator("take_profit");
      return;
    }
    if (survived >= pos.maxTicks) void closeAccumulator("max_ticks");
  }, [latest, market.derivSymbol, closeAccumulator]);

  const placeAccumulator = useCallback(async () => {
    if (accaPlacing || accaPos || stake <= 0) return;
    if (balance < stake) {
      toast.error("Insufficient balance", isLive ? "Please deposit to continue." : "Increase your demo balance.");
      return;
    }
    const tp = takeProfitOn ? takeProfit : null;

    if (isLive) {
      const prevBalance = liveBalance;
      setAccaPlacing(true);
      setLiveBalance((b) => b - stake);
      placed();
      toast.info(`Accumulator ${growthRate}% placed`, `${market.symbol} · Stake ${money(stake)}`);
      try {
        const res  = await fetch("/api/accumulator/buy", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ market: market.derivSymbol, stake, growthRate, takeProfit: tp }),
        });
        const data = await res.json() as { tradeId?: string; entrySpot?: number; entryEpoch?: number; barrierFrac?: number; maxTicks?: number; error?: string };
        if (!res.ok || !data.tradeId) {
          setLiveBalance(prevBalance);
          toast.error("Trade failed", data.error ?? "Could not place accumulator");
          return;
        }
        setAccaPos({
          id: data.tradeId, market: market.symbol, derivSymbol: market.derivSymbol,
          stake, growthRate, entrySpot: data.entrySpot!, entryEpoch: data.entryEpoch!,
          barrierFrac: data.barrierFrac!, maxTicks: data.maxTicks!, takeProfit: tp,
          isReal: true, ticksSurvived: 0, lastEpoch: data.entryEpoch!, prevSpot: data.entrySpot!, status: "open",
        });
        window.dispatchEvent(new Event("wallet-refresh"));
      } catch (err) {
        setLiveBalance(prevBalance);
        toast.error("Trade failed", err instanceof Error ? err.message : "Could not place accumulator");
      } finally {
        setAccaPlacing(false);
      }
    } else {
      try {
        const window = ticks.slice(-(SIGMA_WINDOW + 1)).map((t) => t.quote);
        const sigma = computeSigma(window);
        const barrierFrac = barrierFracFor(sigma, growthRate);
        const entry = ticks[ticks.length - 1];
        setDemoBalance((b) => b - stake);
        setAccaPos({
          id: `demo-acca-${entry.time}`, market: market.symbol, derivSymbol: market.derivSymbol,
          stake, growthRate, entrySpot: entry.quote, entryEpoch: entry.time as number,
          barrierFrac, maxTicks: maxTicksFor(growthRate), takeProfit: tp,
          isReal: false, ticksSurvived: 0, lastEpoch: entry.time as number, prevSpot: entry.quote, status: "open",
        });
        placed();
        toast.info(`Accumulator ${growthRate}% placed`, `${market.symbol} · Stake ${money(stake)}`);
      } catch {
        toast.error("Not enough market data", "Wait for a few more ticks and try again.");
      }
    }
  }, [accaPlacing, accaPos, stake, balance, liveBalance, isLive, market, growthRate, takeProfit, takeProfitOn, ticks]);

  // Close a leveraged contract. Real cash-out is server-authoritative; demo
  // replays the tick buffer through the shared resolver so demo == server. Also
  // fires automatically when the live tracker detects a stop-out / knockout / cap.
  const closeLeveraged = useCallback(async () => {
    const pos = levPosRef.current;
    if (!pos || levClosingRef.current) return;
    levClosingRef.current = true;
    setLevClosing(true);
    try {
      if (pos.isReal) {
        const res  = await fetch("/api/leveraged/close", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tradeId: pos.id }),
        });
        const data = await res.json() as { terminated?: boolean; payout?: number; error?: string };
        if (!res.ok) {
          if (res.status !== 503) toast.error("Close failed", data.error ?? "Try again");
          return; // keep it open; a later attempt (or the cron) settles it
        }
        const payout = data.payout ?? 0;
        setLevPos(null);
        setClosedPositions((cur) => mergeClosedPositions([
          toLeveragedClosedPosition({
            ...pos,
            payout,
            status: "CLOSED",
            settledAt: new Date(),
          }),
        ], cur).slice(0, 40));
        if (payout > 0) {
          setLiveBalance((b) => b + payout);
          window.dispatchEvent(new Event("wallet-refresh"));
          const kindLabel = pos.kind === "TURBO" ? "Turbo" : "Multiplier";
          if (payout > pos.stake) {
            celebrateWin({
              amount: payout,
              multiplier: payout / pos.stake,
              label: `${kindLabel} won!`,
              toastTitle: `${kindLabel} won!`,
              toastDescription: `+${money(payout)} · ${pos.market}`,
            });
          } else {
            toast.cashout(`+${money(payout)} — ${kindLabel} closed!`, pos.market);
          }
        } else {
          toast.loss(`${pos.kind === "TURBO" ? "Turbo knocked out" : "Multiplier stopped out"}`, pos.market);
        }
      } else {
        const path = ticksRef.current
          .filter((x) => (x.time as number) > pos.entryEpoch)
          .map((x) => ({ price: x.quote, epoch: x.time as number }));
        const outcome = resolveLeveraged({
          kind: pos.kind, direction: pos.direction, entrySpot: pos.entrySpot, stake: pos.stake,
          multiplier: pos.multiplier, barrier: pos.barrier, payoutPerPoint: pos.payoutPerPoint,
          takeProfit: pos.takeProfit, stopLoss: pos.stopLoss, closeEpoch: Math.floor(Date.now() / 1000),
        }, path);
        const payout = outcome.grossPayout > 0 ? retainedPayout(pos.stake, outcome.grossPayout) : 0;
        setLevPos(null);
        setClosedPositions((cur) => mergeClosedPositions([
          toLeveragedClosedPosition({
            ...pos,
            payout,
            status: "CLOSED",
            settledAt: new Date(),
          }),
        ], cur).slice(0, 40));
        if (payout > 0) {
          setDemoBalance((b) => b + payout);
          const kindLabel = pos.kind === "TURBO" ? "Turbo" : "Multiplier";
          if (payout > pos.stake) {
            celebrateWin({
              amount: payout,
              multiplier: payout / pos.stake,
              label: `${kindLabel} won!`,
              toastTitle: `${kindLabel} won!`,
              toastDescription: `+${money(payout)} · ${pos.market}`,
            });
          } else {
            toast.cashout(`+${money(payout)} — ${kindLabel} closed!`, pos.market);
          }
        } else {
          toast.loss(`${pos.kind === "TURBO" ? "Turbo knocked out" : "Multiplier stopped out"}`, pos.market);
        }
      }
    } finally {
      levClosingRef.current = false;
      setLevClosing(false);
    }
  }, []);

  // Live tracking — fold each new tick into the running leveraged contract. The
  // server is authoritative on settlement; this only drives the live display and
  // decides when to auto-fire the close (stop-out / knockout / TP / SL / cap).
  useEffect(() => {
    const pos = levPosRef.current;
    if (!pos || pos.status !== "open") return;
    if (market.derivSymbol !== pos.derivSymbol) return;
    if (latest.time <= pos.lastEpoch) return;

    setLevPos((p) => (p ? { ...p, lastEpoch: latest.time as number } : p));

    const { value, terminal } = leveragedValueAt(pos, latest.quote);
    const profit = value - pos.stake;
    const hitCap = value >= pos.stake * LEVERAGED_MAX_MULT;
    const hitTp  = pos.takeProfit != null && profit >= pos.takeProfit;
    const hitSl  = pos.stopLoss != null && -profit >= pos.stopLoss;
    if (terminal || hitCap || hitTp || hitSl) {
      setLevPos((p) => (p ? { ...p, status: terminal ? "lost" : "won" } : p));
      void closeLeveraged();
    }
  }, [latest, market.derivSymbol, closeLeveraged]);

  const placeLeveraged = useCallback(async (direction: LeveragedDirection) => {
    if (levPlacing || levPos || stake <= 0 || !levKind) return;
    if (balance < stake) {
      toast.error("Insufficient balance", isLive ? "Please deposit to continue." : "Increase your demo balance.");
      return;
    }
    const tp = takeProfitOn ? takeProfit : null;
    const sl = stopLossOn ? stopLoss : null;
    const offset = levKind === "TURBO" ? barrierOffset : 0;

    if (isLive) {
      const prevBalance = liveBalance;
      setLevPlacing(true);
      setLiveBalance((b) => b - stake);
      placed();
      toast.info(`${levKind === "TURBO" ? "Turbo" : `Multiplier ×${multiplier}`} ${direction}`, `${market.symbol} · Stake ${money(stake)}`);
      try {
        const res  = await fetch("/api/leveraged/bet", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ market: market.derivSymbol, kind: levKind, direction, stake, multiplier, barrierOffset: offset, takeProfit: tp, stopLoss: sl }),
        });
        const data = await res.json() as { tradeId?: string; entrySpot?: number; entryEpoch?: number; barrier?: number | null; payoutPerPoint?: number | null; error?: string };
        if (!res.ok || !data.tradeId) {
          setLiveBalance(prevBalance);
          toast.error("Trade failed", data.error ?? "Could not place trade");
          return;
        }
        setLevPos({
          id: data.tradeId, market: market.symbol, derivSymbol: market.derivSymbol, kind: levKind, direction,
          stake, multiplier: levKind === "MULTIPLIER" ? multiplier : null,
          barrier: data.barrier ?? null, payoutPerPoint: data.payoutPerPoint ?? null,
          entrySpot: data.entrySpot!, entryEpoch: data.entryEpoch!, takeProfit: tp, stopLoss: sl,
          isReal: true, lastEpoch: data.entryEpoch!, status: "open",
        });
        window.dispatchEvent(new Event("wallet-refresh"));
      } catch (err) {
        setLiveBalance(prevBalance);
        toast.error("Trade failed", err instanceof Error ? err.message : "Could not place trade");
      } finally {
        setLevPlacing(false);
      }
    } else {
      const entry = ticks[ticks.length - 1];
      const barrier = levKind === "TURBO"
        ? clampTurboBarrier(entry.quote, entry.quote + offset, direction)
        : multiplierStopOutPrice(entry.quote, multiplier, direction);
      const payoutPerPoint = levKind === "TURBO" ? turboPayoutPerPoint(stake, entry.quote, barrier) : null;
      setDemoBalance((b) => b - stake);
      setLevPos({
        id: `demo-lev-${entry.time}-${direction}`, market: market.symbol, derivSymbol: market.derivSymbol, kind: levKind, direction,
        stake, multiplier: levKind === "MULTIPLIER" ? multiplier : null,
        barrier, payoutPerPoint, entrySpot: entry.quote, entryEpoch: entry.time as number, takeProfit: tp, stopLoss: sl,
        isReal: false, lastEpoch: entry.time as number, status: "open",
      });
      placed();
      toast.info(`${levKind === "TURBO" ? "Turbo" : `Multiplier ×${multiplier}`} ${direction}`, `${market.symbol} · Stake ${money(stake)}`);
    }
  }, [levPlacing, levPos, stake, balance, liveBalance, isLive, levKind, multiplier, barrierOffset, takeProfit, takeProfitOn, stopLoss, stopLossOn, market, ticks]);

  // Settle a real directional trade via the server (authoritative exit tick).
  // Keep server `won` for celebration gating; history/toast use credit vs stake
  // so Vanilla partial ITM (LOST + BET_WIN) reads as PARTIAL, not full-stake LOST.
  const applyDirSettled = useCallback((t: DirTrade, data: { won: boolean; winAmount?: number }) => {
    if (dirSettled.current.has(t.id)) return;
    dirSettled.current.add(t.id);
    const credit = Number(data.winAmount ?? 0) || 0;
    const display = closedDisplayStatus(t.stake, credit);
    setDirTrades((cur) => cur.filter((x) => x.id !== t.id));
    setClosedPositions((cur) => mergeClosedPositions([
      toDirectionalClosedPosition({
        ...t,
        payout: credit,
        status: data.won ? "WON" : "LOST",
        settledAt: new Date(),
      }),
    ], cur).slice(0, 40));
    if (credit > 0 && t.isReal) {
      setLiveBalance((b) => b + credit);
      window.dispatchEvent(new Event("wallet-refresh"));
    }
    const pnl = credit - t.stake;
    if (display === "won") {
      celebrateWin({
        amount: credit,
        multiplier: t.stake > 0 ? credit / t.stake : undefined,
        label: `${t.side} won!`,
        toastTitle: `${t.side} won!`,
        toastDescription: `+${money(pnl)} · ${t.market}`,
      });
    } else if (display === "partial") {
      toast.info(`${t.side} partial`, `${t.market} · ${money(pnl)}`);
    } else {
      toast.loss(`${t.side} lost`, `${t.market} · Stake ${money(t.stake)}`);
    }
    setTab("closed");
  }, [money]);

  const settleDirReal = useCallback(async (t: DirTrade) => {
    try {
      const res  = await fetch("/api/directional/settle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: t.id }),
      });
      const data = await res.json() as { won?: boolean; winAmount?: number; pending?: boolean; error?: string; alreadySettled?: boolean };
      if (!res.ok) {
        // Exit tick not ready yet — nudge countdown and retry on the next 1s poll.
        setDirTrades((cur) => cur.map((x) => x.id === t.id ? { ...x, settlesAt: Date.now() + (data.pending ? 800 : 1500) } : x));
        return;
      }
      applyDirSettled(t, { won: !!data.won, winAmount: data.winAmount });
    } catch {
      /* leave open; retried on the next interval */
    }
  }, [applyDirSettled]);

  // Demo directional settle stays fast; live uses Realtime + 1s poll fallback.
  useEffect(() => {
    const id = setInterval(() => {
      const open = dirTradesRef.current.filter((t) => t.status === "open" && !t.isReal);
      if (open.length === 0) return;
      for (const t of open) {
        if (dirSettled.current.has(t.id)) continue;
        const path = ticksRef.current
          .filter((x) => (x.time as number) > t.entryEpoch)
          .map((x) => ({ price: x.quote, epoch: x.time as number }));
        const res = resolveContract({
          kind: t.kind, side: t.side, entrySpot: t.entrySpot, barrier: t.barrier,
          durationTicks: t.durationTicks, stake: t.stake, payout: t.payout, payoutPerPoint: t.payoutPerPoint,
        }, path);
        if (!res.ready) continue;
        dirSettled.current.add(t.id);
        const credit = res.credit;
        const display = closedDisplayStatus(t.stake, credit);
        setDirTrades((cur) => cur.filter((x) => x.id !== t.id));
        setClosedPositions((cur) => mergeClosedPositions([
          toDirectionalClosedPosition({
            ...t,
            payout: credit,
            status: res.won ? "WON" : "LOST",
            settledAt: new Date(),
          }),
        ], cur).slice(0, 40));
        if (credit > 0) setDemoBalance((b) => b + credit);
        const pnl = credit - t.stake;
        if (display === "won") {
          celebrateWin({
            amount: credit,
            multiplier: t.stake > 0 ? credit / t.stake : undefined,
            label: `${t.side} won!`,
            toastTitle: `${t.side} won!`,
            toastDescription: `+${money(pnl)} · ${t.market}`,
          });
        } else if (display === "partial") {
          toast.info(`${t.side} partial`, `${t.market} · ${money(pnl)}`);
        } else {
          toast.loss(`${t.side} lost`, t.market);
        }
        setTab("closed");
      }
    }, 500);
    return () => clearInterval(id);
  }, [money]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      const open = dirTradesRef.current.filter((t) => t.status === "open" && t.isReal);
      const now = Date.now();
      for (const t of open) {
        if (now < t.settlesAt || dirInFlight.current.has(t.id) || dirSettled.current.has(t.id)) continue;
        dirInFlight.current.add(t.id);
        settleDirReal(t).finally(() => dirInFlight.current.delete(t.id));
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [isLive, settleDirReal]);

  // Server push: tick-driven settle broadcasts trade:settled on binary:${userId}.
  useEffect(() => {
    if (!userId || !isLive) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`binary:${userId}`)
      .on("broadcast", { event: "trade:settled" }, ({ payload }: { payload: {
        kind?: string;
        tradeId?: string;
        outcome?: string;
        winAmount?: number;
        entryDigit?: number;
        exitDigit?: number;
        status?: string;
      } }) => {
        if (!payload?.tradeId || payload.outcome === "already") return;
        const won = payload.outcome === "won" || payload.status === "WON";
        if (payload.kind === "directional") {
          const t = dirTradesRef.current.find((x) => x.id === payload.tradeId);
          if (!t) return;
          applyDirSettled(t, { won, winAmount: payload.winAmount });
          return;
        }
        const trade = openTradesRef.current.find((x) => x.id === payload.tradeId);
        if (!trade) return;
        applyBinarySettled(trade, {
          won,
          winAmount: payload.winAmount,
          entryDigit: payload.entryDigit,
          exitDigit: payload.exitDigit ?? 0,
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, isLive, applyBinarySettled, applyDirSettled]);

  const placeDirectional = useCallback(async (side: DirectionalSide) => {
    if (dirPlacing || stake <= 0 || !dirKind) return;
    const reject = dirRejectReason(side);
    if (reject) {
      // Button should already be disabled; calm info only — never "Trade failed".
      if (reject !== "Pricing…") toast.info(reject);
      return;
    }
    if (balance < stake) {
      toast.error("Insufficient balance", isLive ? "Please deposit to continue." : "Increase your demo balance.");
      return;
    }
    // RISE_FALL has no barrier; the rest take the offset (Vanilla allows 0 = ATM).
    // Below-min / zero offset already disabled via dirRejectReason — no Trade-failed toast.
    const offset = dirKind === "RISE_FALL" ? 0 : barrierOffset;
    const needsSigma = dirKind === "HIGHER_LOWER" || dirKind === "TOUCH_NO_TOUCH" || dirKind === "VANILLA";
    const settlesAt = Date.now() + duration * Math.max(1000, market.speedMs) + 500;

    if (isLive) {
      const prevBalance = liveBalance;
      setDirPlacing(true);
      setLiveBalance((b) => b - stake);
      placed();
      toast.info(`${side} placed · ${duration} ticks`, `${market.symbol} · Stake ${money(stake)}`);
      try {
        const res  = await fetch("/api/directional/bet", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ market: market.derivSymbol, kind: dirKind, side, stake, durationTicks: duration, barrierOffset: offset }),
        });
        const data = await res.json() as { tradeId?: string; entrySpot?: number; entryEpoch?: number; barrier?: number | null; payout?: number; payoutPerPoint?: number | null; error?: string };
        if (!res.ok || !data.tradeId) {
          setLiveBalance(prevBalance);
          const err = data.error ?? "Could not place trade";
          if (isCalmDirectionalReject(err)) {
            toast.info(BARRIER_TOO_CLOSE_COPY);
          } else {
            toast.error("Trade failed", err);
          }
          return;
        }
        window.dispatchEvent(new Event("wallet-refresh"));
        setDirTrades((cur) => [{
          id: data.tradeId!, market: market.symbol, derivSymbol: market.derivSymbol, kind: dirKind, side,
          stake, payout: data.payout ?? 0, payoutPerPoint: data.payoutPerPoint ?? null,
          entrySpot: data.entrySpot!, entryEpoch: data.entryEpoch!,
          barrier: data.barrier ?? null, durationTicks: duration, isReal: true, settlesAt, status: "open" as const,
        }, ...cur].slice(0, 12));
      } catch (err) {
        setLiveBalance(prevBalance);
        toast.error("Trade failed", err instanceof Error ? err.message : "Could not place trade");
      } finally {
        setDirPlacing(false);
      }
    } else {
      const entry = ticks[ticks.length - 1];
      if (needsSigma && !clientSigma) { toast.error("Not enough market data", "Wait for more ticks and try again."); return; }
      const barrier = dirKind === "RISE_FALL" ? null : Number((entry.quote + offset).toFixed(5));
      let payout = dirPayoutFor(side);
      let payoutPerPoint: number | null = null;
      if (dirKind === "VANILLA") {
        payout = 0;
        payoutPerPoint = vanillaPayoutPerPoint({ entrySpot: entry.quote, strike: barrier!, side: side as "CALL" | "PUT", sigmaTick: clientSigma!, durationTicks: duration, stake });
      }
      setDemoBalance((b) => b - stake);
      setDirTrades((cur) => [{
        id: `demo-dir-${entry.time}-${side}`, market: market.symbol, derivSymbol: market.derivSymbol, kind: dirKind, side,
        stake, payout, payoutPerPoint, entrySpot: entry.quote, entryEpoch: entry.time as number,
        barrier, durationTicks: duration, isReal: false, settlesAt, status: "open" as const,
      }, ...cur].slice(0, 12));
      placed();
      toast.info(`${side} placed · ${duration} ticks`, `${market.symbol} · Stake ${money(stake)}`);
    }
  }, [dirPlacing, stake, balance, liveBalance, isLive, dirKind, barrierOffset, duration, market, ticks, clientSigma, liveDirQuotes, dirRejectReason, minBarrierOffset]);

  async function placeTrade(side: ContractSide) {
    if (placing || stake <= 0) return;
    const reject = digitRejectReason(side);
    if (reject) {
      // Button should already be disabled. Soft digit gates stay silent (grid hops /
      // dims) — never toast the old "unavailable — try another" sermon.
      if (reject !== "Pricing…" && reject !== "—") toast.info(reject);
      return;
    }
    if (balance < stake) {
      toast.error("Insufficient balance", isLive ? "Please deposit to continue." : "Increase your demo balance.");
      return;
    }

    if (isLive) {
      // Optimistic UI (P2P pattern): deduct + show open trade immediately;
      // server remains source of truth — reconcile id/payout or roll back.
      const prevBalance = liveBalance;
      const prevOpen = openTrades;
      const prevTx = transactions;
      const tempId = `pending-${Date.now()}`;
      const optimistic: BinaryTrade = {
        id: tempId,
        market: market.symbol,
        side,
        stake,
        payout: digitPayoutFor(side),
        entryDigit: latest.digit,
        targetDigit,
        openedAt: Date.now(),
        settlesAt: Date.now() + duration * 1000,
        status: "open",
        isReal: true,
      };
      setPlacing(true);
      setLiveBalance((b) => b - stake);
      setOpenTrades((current) => [optimistic, ...current].slice(0, 12));
      setTransactions((current) => [`${side} ${market.symbol} ${money(stake)}`, ...current].slice(0, 12));
      setTab("open");
      // Instant feedback — fire the toast now, not after the server round-trip.
      placed();
      toast.info(`${side} placed · ${duration} ticks`, `${market.symbol} · Stake ${money(stake)}`);
      try {
        const res  = await fetch("/api/binary/bet", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            market:       market.derivSymbol,
            side,
            stake,
            targetDigit,
            entryDigit:   latest.digit,
            durationTicks: duration,
          }),
        });
        const data = await res.json() as { tradeId?: string; payout?: number; entryDigit?: number; error?: string };
        if (!res.ok || !data.tradeId) {
          setLiveBalance(prevBalance);
          setOpenTrades(prevOpen);
          setTransactions(prevTx);
          const err = data.error ?? "Could not place trade";
          if (isCalmDigitAvailabilityReject(err)) {
            toast.info("Contract shifted", "Try again or pick another side.");
          } else {
            toast.error("Trade failed", err);
          }
          return;
        }
        setOpenTrades((current) =>
          current.map((t) =>
            t.id === tempId
              ? applyServerBinaryDigits(
                  { ...t, id: data.tradeId!, payout: data.payout ?? t.payout },
                  { entryDigit: data.entryDigit },
                )
              : t,
          ),
        );
        window.dispatchEvent(new Event("wallet-refresh"));
      } catch (err) {
        setLiveBalance(prevBalance);
        setOpenTrades(prevOpen);
        setTransactions(prevTx);
        toast.error("Trade failed", err instanceof Error ? err.message : "Could not place trade");
      } finally {
        setPlacing(false);
      }
    } else {
      const trade: BinaryTrade = {
        id:          `demo-${Date.now()}`,
        market:      market.symbol,
        side,
        stake,
        payout:      digitPayoutFor(side),
        entryDigit:  latest.digit,
        targetDigit,
        openedAt:    Date.now(),
        settlesAt:   Date.now() + duration * 1000,
        status:      "open",
        isReal:      false,
      };
      setDemoBalance((b) => b - stake);
      setOpenTrades((current) => [trade, ...current].slice(0, 12));
      setTransactions((current) => [`${side} ${market.symbol} ${money(stake)}`, ...current].slice(0, 12));
      setTab("open");
      placed();
      toast.info(`${side} placed · ${duration} ticks`, `${market.symbol} · Stake ${money(stake)}`);
    }
  }

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden text-white pb-[env(safe-area-inset-bottom)] md:pb-0 ${
      bok ? "bok-trader bg-black" : "bg-[#151518]"
    }`}>
      <CopyTradingPanel open={copyOpen} onClose={() => setCopyOpen(false)} />
      <div
        data-binary-grid="true"
        className={`relative flex min-h-0 flex-1 flex-col min-w-0 gap-0 overflow-hidden px-0 py-0 md:grid md:gap-0 md:overflow-hidden md:border-b md:border-white/[0.08] ${
          railOpen
            ? "xl:grid-cols-[280px_minmax(0,1fr)_minmax(300px,340px)]"
            : "md:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:grid-cols-[44px_minmax(0,1fr)_minmax(300px,340px)]"
        }`}
      >
        {pickerOpen && (
          <TradeTypePicker value={tradeType} onSelect={selectTradeType} onClose={() => setPickerOpen(false)} allowed={new Set(liveTypes)} />
        )}
        <aside className="order-2 hidden min-h-0 flex-col overflow-hidden border-white/[0.08] xl:order-none xl:flex xl:border-y-0 xl:border-l-0 xl:border-r">
          {railOpen ? (
            <BinaryActivityPanel
              tab={tab} setTab={setTab}
              openPositions={openPositions} allClosedPositions={allClosedPositions} transactions={transactions}
              wins={wins} losses={losses} sessionPnl={sessionPnl} isLive={isLive}
              onCollapse={() => setRailOpen(false)}
            />
          ) : (
            <CollapsedActivityRail openCount={openPositions.length} onExpand={() => setRailOpen(true)} />
          )}
        </aside>

        <main className="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-y border-white/[0.08] md:order-none md:border-0">
          <section className={`bok-chart-section flex min-h-0 flex-1 flex-col overflow-hidden ${bok ? "bg-black" : "bg-[#18191f]"}`}>
            {/* Desktop header — same market chrome as mobile (icon + sheet) */}
            <div className="hidden shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-2.5 sm:flex">
              <button
                type="button"
                onClick={() => setMarketsOpen(true)}
                disabled={!!accaPos || !!levPos}
                title={accaPos || levPos ? "Finish your open contract before switching markets" : undefined}
                className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition hover:bg-white/[0.03] active:scale-[0.99] disabled:opacity-50"
              >
                <MarketIcon symbol={market.symbol} size={36} />
                <span className="min-w-0">
                  <span className="flex items-center gap-0.5">
                    <span className="truncate text-[14px] font-black text-white">{market.symbol}</span>
                    <Icon name="expand_more" className="text-[18px] text-slate-400" />
                  </span>
                  <span className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-mono text-[13px] font-black tabular-nums text-white">{formatQuote(latest.quote)}</span>
                    <span className={`font-mono text-[11px] font-black tabular-nums ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                    </span>
                    {streamStatus === "live" && (
                      <span className="hidden items-center gap-1 text-[11px] font-medium text-slate-500 lg:inline-flex">
                        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${bok ? "bg-[var(--bok-lime)]" : "bg-emerald-400"}`} />
                        Live
                      </span>
                    )}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                {streamStatus === "fallback" && (
                  <span className="max-w-[240px] truncate text-[11px] font-medium text-amber-400">
                    {streamError ?? "Fallback ticks"}
                  </span>
                )}
                {copyEnabled && (
                  <button
                    type="button"
                    onClick={() => setCopyOpen(true)}
                    className={bok
                      ? "bok-chip-copy rounded-full px-2.5 py-1 text-[10px] font-black transition active:scale-[0.97]"
                      : "rounded-lg bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-300 ring-1 ring-violet-400/25 transition hover:bg-violet-500/15"}
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              {/* Mobile chrome sits in reserved top pad — no heavy fade over the plot. */}
              <div className={`bok-mobile-chrome absolute inset-x-0 top-0 z-20 flex flex-col gap-1 px-2 pb-1.5 pt-1.5 sm:hidden ${
                bok ? "bg-black" : "bg-[#151518]"
              }`}>
                {/* Compact type chips; All + Copy pinned. */}
                <div className="flex items-center gap-1">
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-4">
                      {recentTypes.map((id) => tradeTypeById(id)).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTradeType(t.id)}
                          className={`flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-black transition active:scale-[0.97] ${
                            tradeType === t.id
                              ? bok
                                ? "bok-chip-active"
                                : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40"
                              : bok
                                ? "bok-chip-idle"
                                : "bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.05]"
                          }`}
                        >
                          {t.label}
                          {t.hot && !bok && <span className="animate-flame text-[10px] leading-none">🔥</span>}
                        </button>
                      ))}
                    </div>
                    <div
                      aria-hidden
                      className={`bok-chip-fade pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l ${
                        bok ? "from-black via-black/90 to-transparent" : "from-[#151518] via-[#151518]/90 to-transparent"
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    title="View all trade types"
                    aria-label="View all trade types"
                    className={`flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-black transition active:scale-[0.97] ${
                      bok
                        ? "bok-chip-all"
                        : "bg-sky-500/12 text-sky-300 ring-1 ring-sky-400/30"
                    }`}
                  >
                    <Icon name="apps" className="text-[13px]" />
                    All
                  </button>
                  {copyEnabled && (
                    <button
                      type="button"
                      onClick={() => setCopyOpen(true)}
                      title="Copy trading"
                      aria-label="Copy trading"
                      className={`flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[11px] font-black transition active:scale-[0.97] ${
                        bok
                          ? "bok-chip-copy"
                          : "bg-violet-500/12 text-violet-300 ring-1 ring-violet-400/30"
                      }`}
                    >
                      <Icon name="groups" className="text-[13px]" />
                      Copy
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 px-0.5">
                  <button
                    type="button"
                    onClick={() => setMarketsOpen(true)}
                    disabled={!!accaPos || !!levPos}
                    className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 text-left disabled:opacity-50"
                  >
                    <MarketIcon symbol={market.symbol} size={32} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-0.5">
                        <span className="truncate text-[13px] font-black text-white">{market.symbol}</span>
                        <Icon name="expand_more" className="text-[18px] text-slate-400" />
                      </span>
                      <span className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="font-mono text-[12px] font-black text-white">{formatQuote(latest.quote)}</span>
                        <span className={`font-mono text-[10px] font-black ${changePct >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.replace(`${pathname}?panel=positions`, { scroll: false })}
                    title="Positions"
                    aria-label="Open positions"
                    className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-[0.96] ${
                      panel === "positions"
                        ? bok
                          ? "bok-pos-btn-on"
                          : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35"
                        : bok
                          ? "bok-pos-btn-off"
                          : "bg-white/[0.04] text-slate-300 ring-1 ring-white/[0.08] hover:text-white"
                    }`}
                  >
                    <Icon name="swap_vert" className="text-[20px]" />
                    {openPositions.length > 0 && (
                      <span className={`absolute -right-0.5 -top-0.5 grid min-w-4 h-4 place-items-center rounded-full px-0.5 text-[9px] font-black leading-none ${
                        bok ? "bok-pos-badge" : "bg-sky-500 text-white"
                      }`}>
                        {openPositions.length > 99 ? "99+" : openPositions.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Chart below mobile header so the line never sits under a fade. */}
              <div className="absolute inset-0 flex flex-col pt-[88px] sm:pt-0">
                <div className="relative min-h-0 flex-1">
                  <LiveTickChart
                    points={livePoints}
                    theme={chartTheme}
                    lines={chartLines}
                    markers={chartMarkers}
                    formatValue={formatQuote}
                    bucketSeconds={5}
                    storageKey={bok ? "bok.binary.chartType" : "nz.binary.chartType"}
                  />
                </div>
              </div>
            </div>

            {/* Digit-frequency strip — last-100-tick distribution. Click a digit
                to set it as the Matches/Differs/Over/Under target. Digit types only. */}
            {isDigitType && (
              <section className={`bok-digit-strip grid h-[48px] shrink-0 grid-cols-10 sm:mb-2.5 sm:h-[78px] ${
                bok ? "bg-black" : "bg-[#151518]"
              }`}>
                {digitStats.map((stat) => (
                  <button
                    key={stat.digit}
                    type="button"
                    onClick={() => setDigitTarget(stat.digit)}
                    className="relative flex h-full flex-col items-center justify-center transition-transform active:scale-95"
                  >
                    <DigitRing stat={stat} isActive={latest.digit === stat.digit} />
                    {latest.digit === stat.digit && (
                      <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] leading-none ${
                        bok ? "text-[var(--bok-lime)]" : "text-amber-400"
                      }`}>▲</span>
                    )}
                  </button>
                ))}
              </section>
            )}
          </section>
        </main>

        <aside className={`bok-trade-dock order-2 flex min-h-0 shrink-0 flex-col overflow-hidden border-white/[0.08] max-md:max-h-[min(48svh,420px)] max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 max-md:border-t md:order-none md:max-h-none md:border-y-0 md:border-r-0 md:border-l`}>
          <section className={`bok-trade-section relative flex h-full min-h-0 flex-col overflow-hidden ${bok ? "bg-[#0e0e0e]" : "bg-[#18191f]"}`}>
            {/* Trade-type selector — desktop only; mobile uses the top quick bar */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="hidden shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-1.5 text-left transition hover:bg-white/[0.03] sm:flex sm:py-2.5"
            >
              <Icon name="chevron_left" className="text-[18px] text-slate-400" />
              <span className="flex items-center gap-0.5">
                <Icon name={tradeTypeById(tradeType).upIcon} className={`text-[16px] ${bok ? "text-[var(--bok-lime)]" : "text-emerald-400"}`} />
                <Icon name={tradeTypeById(tradeType).downIcon} className="text-[16px] text-red-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-white">{tradeTypeById(tradeType).label}</span>
                <span className="mt-0.5 block truncate text-[10px] font-medium leading-snug text-slate-500">
                  {tradeTypeById(tradeType).howItPays}
                </span>
              </span>
            </button>

            {/* Manual vs Auto toggle — shown on every breakpoint. Mobile users
                need the auto-trader too; the panel below scrolls within the dock. */}
            <div className="flex shrink-0 gap-1 border-b border-white/[0.07] px-3 py-1.5">
              {([["Manual", false], ["Auto", true]] as const).map(([label, val]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAutoMode(val)}
                  className={`flex-1 rounded-full py-1.5 text-[11px] font-black transition ${
                    autoMode === val
                      ? bok
                        ? "bok-mode-on"
                        : "bg-[#087cff] text-white"
                      : bok
                        ? "bok-mode-off"
                        : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]"
                  }`}
                >
                  {label === "Auto" ? (bok ? "Auto" : "⚡ Auto") : label}
                </button>
              ))}
              {copyEnabled && (
                <button
                  type="button"
                  onClick={() => setCopyOpen(true)}
                  className={bok
                    ? "bok-chip-copy rounded-full px-2.5 py-1.5 text-[11px] font-black transition active:scale-[0.97]"
                    : "rounded-lg bg-violet-500/12 px-2.5 py-1.5 text-[11px] font-black text-violet-300 ring-1 ring-violet-400/25 transition hover:bg-violet-500/18"}
                  title="Copy trading"
                >
                  Copy
                </button>
              )}
            </div>

            {autoMode ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <AutoPanel currency={currency.symbol} />
              </div>
            ) : tradeType === "accumulators" ? (
              <AccumulatorsPanel
                currency={currency.symbol}
                stake={stake} setStake={setStake}
                growthRate={growthRate} setGrowthRate={setGrowthRate}
                takeProfitOn={takeProfitOn} setTakeProfitOn={setTakeProfitOn}
                takeProfit={takeProfit} setTakeProfit={setTakeProfit}
                onBuy={placeAccumulator}
                placing={accaPlacing}
                position={accaPos ? {
                  ticksSurvived: accaPos.ticksSurvived,
                  maxTicks: accaPos.maxTicks,
                  growthRate: accaPos.growthRate,
                  stake: accaPos.stake,
                  netPayout: accaNetPayout,
                } : null}
                onCashOut={() => closeAccumulator()}
                closing={accaClosing}
                format={money}
                sigma={clientSigma}
                stakePresets={stakePresets}
                minStake={minStake}
              />
            ) : isDigitType ? (
              <DigitPanel
                currency={currency.symbol}
                family={family}
                sides={selectedSides}
                stake={stake} setStake={setStake}
                duration={duration} setDuration={setDuration}
                targetDigit={targetDigit} setTargetDigit={setDigitTarget}
                lastDigit={latest.digit}
                stakePresets={stakePresets}
                minStake={minStake}
                payoutFor={digitPayoutFor}
                rejectReasonFor={digitRejectReason}
                lessAvailableDigits={lessAvailableDigits}
                format={money}
                onTrade={placeTrade}
                placing={placing}
                openPositions={openTrades.map((t) => ({ id: t.id, side: t.side, settlesAt: t.settlesAt }))}
              />
            ) : isVanillaType && dirKind ? (
              <VanillaPanel
                currency={currency.symbol}
                sides={dirSides}
                stake={stake} setStake={setStake}
                duration={duration} setDuration={setDuration}
                secPerTick={Math.max(1, Math.round(market.speedMs / 1000))}
                strikeOffset={barrierOffset}
                setStrikeOffset={(v) => { setBarrierOffset(v); pulseBarrierLine(true); }}
                latestSpot={latest.quote}
                stakePresets={stakePresets}
                minStake={minStake}
                payoutPerPointFor={dirPayoutPerPoint}
                maxPayout={dirMaxPayout}
                format={money}
                formatSpot={formatQuote}
                onTrade={placeDirectional}
                placing={dirPlacing}
                openPositions={dirOpenPositions}
                onStrikeFocus={pulseBarrierLine}
              />
            ) : isDirectionalType && dirKind ? (
              <DirectionalPanel
                currency={currency.symbol}
                kind={dirKind}
                sides={dirSides}
                stake={stake} setStake={setStake}
                duration={duration} setDuration={setDuration}
                durationUnit={durationUnit} setDurationUnit={setDurationUnit}
                secPerTick={Math.max(1, Math.round(market.speedMs / 1000))}
                barrierOffset={barrierOffset}
                setBarrierOffset={(v) => { setBarrierOffset(v); pulseBarrierLine(true); }}
                maxBarrierOffset={maxBarrierOffset}
                minBarrierOffset={minBarrierOffset}
                minDuration={minDurationTicks}
                latestSpot={latest.quote}
                stakePresets={stakePresets}
                minStake={minStake}
                payoutFor={dirPayoutFor}
                rejectReasonFor={dirRejectReason}
                format={money}
                formatSpot={formatQuote}
                onTrade={placeDirectional}
                placing={dirPlacing}
                openPositions={dirOpenPositions}
                onBarrierFocus={pulseBarrierLine}
              />
            ) : isLeveragedType && levKind ? (
              <LeveragedPanel
                currency={currency.symbol}
                kind={levKind}
                stake={stake} setStake={setStake}
                multiplier={multiplier} setMultiplier={setMultiplier}
                barrierOffset={barrierOffset}
                setBarrierOffset={(v) => { setBarrierOffset(v); pulseBarrierLine(true); }}
                takeProfitOn={takeProfitOn} setTakeProfitOn={setTakeProfitOn}
                takeProfit={takeProfit} setTakeProfit={setTakeProfit}
                stopLossOn={stopLossOn} setStopLossOn={setStopLossOn}
                stopLoss={stopLoss} setStopLoss={setStopLoss}
                latestSpot={latest.quote}
                payoutPerPoint={levConfigPpp}
                dangerSpot={levConfigDanger}
                maxPayout={levMaxPayout}
                stakePresets={stakePresets}
                minStake={minStake}
                format={money}
                formatSpot={formatQuote}
                onTrade={placeLeveraged}
                placing={levPlacing}
                position={levRunning}
                onCashOut={() => closeLeveraged()}
                closing={levClosing}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex items-center gap-1">
                  <Icon name={tradeTypeById(tradeType).upIcon} className="text-[24px] text-emerald-400" />
                  <Icon name={tradeTypeById(tradeType).downIcon} className="text-[24px] text-red-400" />
                </span>
                <p className="text-base font-black text-white">{tradeTypeById(tradeType).label}</p>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400">Coming soon</span>
              </div>
            )}
          </section>

        </aside>
      </div>

      {/* Mobile-only Positions screen — full surface under the app header. */}
      {mobileActivityOpen && (
        <MobilePositions
          tab={tab === "tx" ? "open" : tab} setTab={setTab}
          openPositions={openPositions} allClosedPositions={allClosedPositions}
          onClose={closePanel}
        />
      )}

      {/* Market picker — same sheet on mobile + desktop (icon rows, favourites, search). */}
      {marketsOpen && (
        <MarketsSheet
          markets={MARKETS}
          current={market.symbol}
          locked={!!accaPos || !!levPos}
          onSelect={(sym) => { setMarketSymbol(sym); setMarketsOpen(false); if (panel === "markets") closePanel(); }}
          onClose={() => { setMarketsOpen(false); if (panel === "markets") closePanel(); }}
        />
      )}

      {chartSheet === "types" && <ChartTypesSheet onClose={() => setChartSheet(null)} />}
      {chartSheet === "drawing" && <DrawingToolsSheet onClose={() => setChartSheet(null)} />}
    </div>
  );
}

// Mobile market-picker bottom sheet (Deriv-style). Lists every synthetic index
// with its live-ish label; tapping one switches the chart feed. Disabled while a
// live cash-out contract is open so the user can't strand a running position.
// Deriv-style markets picker: a tall bottom sheet with a search field and the
// indices grouped under headings, each row showing a badge (+ "1s" speed dot),
// a favourite star, and the current market highlighted white.
function MarketsSheet({
  markets, current, locked, onSelect, onClose,
}: {
  markets: BinaryMarket[];
  current: string;
  locked: boolean;
  onSelect: (symbol: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"favourites" | "all">("all");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);
  const [starPop, setStarPop] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("binary-fav-markets") ?? "[]");
      if (Array.isArray(saved)) setFavs(new Set(saved));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("binary-fav-markets", JSON.stringify([...favs])); } catch { /* ignore */ }
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

  const term = q.trim().toLowerCase();
  const base = tab === "favourites" ? markets.filter((m) => favs.has(m.symbol)) : markets;
  const filtered = base.filter(
    (m) => term === "" || m.symbol.toLowerCase().includes(term) || m.name.toLowerCase().includes(term),
  );
  const groups: { heading: string; items: BinaryMarket[] }[] = [];
  for (const m of filtered) {
    const heading = m.symbol.startsWith("Jump") ? "Jump indices" : "Volatility indices";
    const g = groups.find((x) => x.heading === heading);
    if (g) g.items.push(m); else groups.push({ heading, items: [m] });
  }

  const toggleFav = (symbol: string) => {
    setFavs((s) => {
      const n = new Set(s);
      if (n.has(symbol)) n.delete(symbol);
      else n.add(symbol);
      return n;
    });
    setStarPop(symbol);
    if (starTimer.current) clearTimeout(starTimer.current);
    starTimer.current = setTimeout(() => setStarPop(null), 280);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:items-start sm:justify-start sm:pt-[4.75rem] sm:pl-3 sm:pr-3" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/60 sm:bg-black/25 ${closing ? "animate-sheet-backdrop-out" : "animate-sheet-backdrop-in"}`}
      />
      <div
        className={`relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[#151518] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-2xl ring-1 ring-white/[0.08] sm:max-h-[min(560px,72vh)] sm:w-[360px] sm:rounded-2xl sm:pb-2 ${
          closing ? "animate-sheet-out" : "animate-sheet-in"
        }`}
      >
        <button type="button" onClick={requestClose} className="flex w-full justify-center pt-2.5 pb-1 sm:hidden" aria-label="Close sheet">
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </button>

        <div className="flex items-center gap-2 px-4 pb-3 pt-1.5">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/[0.05] px-3 ring-1 ring-white/[0.07] focus-within:ring-sky-500/50">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search markets"
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

        {locked && (
          <div className="mx-4 mb-2 mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-300">
            Finish your open contract before switching markets.
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
          {tab === "favourites" && filtered.length === 0 ? (
            <div className="animate-fav-empty flex flex-col items-center justify-center px-8 py-16 text-center">
              <Icon name="star" className="text-[56px] text-slate-700" />
              <div className="mt-3 text-[14px] font-black text-slate-400">No favourites</div>
              <div className="mt-1 text-[12px] font-bold text-slate-600">Tap the star on a market to add it here.</div>
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-5 rounded-xl bg-[#087cff] px-4 py-2.5 text-[12px] font-black text-white transition-[transform] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97]"
              >
                Browse markets
              </button>
            </div>
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-[12px] font-bold text-slate-600">No markets match “{q}”.</p>
          ) : (
            groups.map(({ heading, items }) => (
              <div key={heading} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-wide text-slate-500">{heading}</p>
                {items.map((m) => {
                  const active = m.symbol === current;
                  const starred = favs.has(m.symbol);
                  return (
                    <button
                      key={m.symbol}
                      type="button"
                      disabled={locked}
                      onClick={() => onSelect(m.symbol)}
                      className={`animate-fav-row flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97] disabled:opacity-40 ${
                        active ? "bg-white" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <MarketIcon symbol={m.symbol} size={36} />
                      <span className={`min-w-0 flex-1 truncate text-[14px] font-black ${active ? "text-[#151518]" : "text-white"}`}>
                        {m.symbol}
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Shared chrome for the mobile chart-tool bottom sheets (Deriv-style header +
// rounded sheet + close button).
function ChartToolSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="animate-sheet-in relative flex max-h-[80dvh] flex-col rounded-t-3xl bg-[#18191f] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-[15px] font-black text-white">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.05] text-slate-400 active:scale-95">
            <Icon name="close" className="text-[13px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">{children}</div>
      </div>
    </div>
  );
}

// Small "Coming soon" badge used inside the chart-tool sheets.
function ComingSoon() {
  return <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">Soon</span>;
}

// "1t" → Chart types + time interval (Deriv layout). UI shell; Area + tick are
// the only live options, the rest are disabled with a "coming soon" note.
function ChartTypesSheet({ onClose }: { onClose: () => void }) {
  const types: { label: string; icon: string; active?: boolean }[] = [
    { label: "Area", icon: "show_chart", active: true },
    { label: "Candle", icon: "candlestick_chart" },
    { label: "Hollow", icon: "candlestick_chart" },
    { label: "OHLC", icon: "bar_chart" },
  ];
  const intervals = ["1 tick", "1 min", "2 min", "3 min", "5 min", "10 min", "15 min", "30 min", "1 hour"];
  return (
    <ChartToolSheet title="Chart types" onClose={onClose}>
      <div className="grid grid-cols-4 gap-2 pt-1">
        {types.map((t) => (
          <button key={t.label} type="button" disabled={!t.active}
            className={`flex flex-col items-center gap-1 rounded-xl py-3 transition disabled:opacity-40 ${
              t.active ? "bg-[#18191f] ring-1 ring-sky-400/50 text-white" : "bg-[#18191f] text-slate-400"
            }`}>
            <Icon name={t.icon} className="text-[20px]" />
            <span className="text-[11px] font-black">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mb-2 mt-4 flex items-center gap-2">
        <span className="text-[13px] font-black text-white">Time interval</span>
        <ComingSoon />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {intervals.map((iv, i) => (
          <button key={iv} type="button" disabled={i !== 0}
            className={`rounded-xl py-2.5 text-[12px] font-black transition disabled:opacity-40 ${
              i === 0 ? "bg-[#18191f] ring-1 ring-sky-400/50 text-white" : "bg-[#18191f] text-slate-400"
            }`}>
            {iv}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-[#18191f] px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="text-[13px] font-black text-white">Smooth chart movement</span><ComingSoon /></div>
          <div className="mt-0.5 text-[11px] font-bold text-slate-500">Performance may vary by device.</div>
        </div>
        <span className="ml-3 inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-emerald-500/40 p-0.5">
          <span className="h-5 w-5 translate-x-5 rounded-full bg-white/70" />
        </span>
      </div>
    </ChartToolSheet>
  );
}

// Drawing icon → Drawing tools (Deriv layout): Active / All drawings tabs. UI
// shell only — placing drawings is "coming soon".
function DrawingToolsSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"active" | "all">("all");
  const tools = [
    { label: "Horizontal line", icon: "remove" },
    { label: "Trend line", icon: "show_chart" },
    { label: "Vertical line", icon: "candlestick_chart" },
  ];
  return (
    <ChartToolSheet title="Drawing tools" onClose={onClose}>
      <div className="mb-3 flex items-stretch border-b border-white/[0.07] text-[13px] font-black">
        {(["active", "all"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition ${tab === t ? "border-b-2 border-red-500 text-white" : "text-slate-500"}`}>
            <Icon name={t === "active" ? "bolt" : "edit"} className="text-[16px]" />
            {t === "active" ? "Active" : "All drawings"}
          </button>
        ))}
      </div>
      {tab === "active" ? (
        <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
          <Icon name="edit" className="text-[48px] text-slate-700" />
          <div className="mt-3 text-[13px] font-bold text-slate-500">You have no active drawings yet.</div>
        </div>
      ) : (
        <div className="space-y-1">
          {tools.map((t) => (
            <button key={t.label} type="button" disabled
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left opacity-60">
              <span className="flex items-center gap-3">
                <Icon name={t.icon} className="text-[20px] text-slate-300" />
                <span className="text-[14px] font-bold text-white">{t.label}</span>
              </span>
              <ComingSoon />
            </button>
          ))}
        </div>
      )}
    </ChartToolSheet>
  );
}

// A unified view of any open contract (digit, directional, accumulator,
// leveraged) so the activity rail's "Open" tab lists them all, not just digits.
type OpenPositionView = {
  id: string;
  title: string;            // e.g. "EVEN", "RISE", "Accumulator 3%", "Multiplier ×100 · UP"
  subtitle: string;         // market + detail
  stake: number;
  value: number;            // current/potential payout shown
  isReal: boolean;
  settlesAt?: number;       // fixed-duration types show a countdown; cash-out types show "LIVE"
  /** Best-effort live vs rule — digit/directional only; Acca/Lev stay LIVE. */
  interim?: InterimStatus;
  copyLeaderUsername?: string | null;
};

interface ActivityPanelProps {
  tab: "open" | "closed" | "tx";
  setTab: (t: "open" | "closed" | "tx") => void;
  openPositions: OpenPositionView[];
  allClosedPositions: ClosedPosition[];
  transactions: string[];
  wins: number;
  losses: number;
  sessionPnl: number;
  isLive: boolean;
  onCollapse?: () => void;
}

// Shared Open / Closed / Tx tabs + session stats — used by the desktop rail
// and the mobile collapsible so both views show identical detail.
function BinaryActivityPanel({
  tab, setTab, openPositions, allClosedPositions, transactions, onCollapse,
}: ActivityPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#151518]">
      <div className="flex shrink-0 items-stretch border-b border-white/[0.06] text-[13px] font-semibold">
        {([
          { id: "open" as const, label: openPositions.length ? `Open (${openPositions.length})` : "Open" },
          { id: "closed" as const, label: allClosedPositions.length ? `Closed (${allClosedPositions.length})` : "Closed" },
          { id: "tx" as const, label: "Activity" },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 transition ${tab === t.id ? "border-b-2 border-white text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            {t.label}
          </button>
        ))}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse panel"
            aria-label="Collapse panel"
            className="grid w-10 shrink-0 place-items-center border-l border-white/[0.06] text-slate-500 transition hover:text-white"
          >
            <Icon name="remove" className="text-[18px]" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "open" && (
          openPositions.length === 0 ? (
            <ActivityEmpty icon="candlestick_chart" title="No open positions" subtitle="Place a contract from the ticket to see it here." />
          ) : (
            <div className="space-y-1.5 p-3">
              {openPositions.map((pos) => <PositionRow key={pos.id} pos={pos} />)}
            </div>
          )
        )}
        {tab === "closed" && (
          allClosedPositions.length === 0 ? (
            <ActivityEmpty icon="history" title="No closed trades" subtitle="Settled contracts will show up here." />
          ) : (
            <div className="space-y-1.5 p-3">
              {allClosedPositions.map((position) => <ClosedPositionRow key={position.id} position={position} />)}
            </div>
          )
        )}
        {tab === "tx" && (
          transactions.length === 0 ? (
            <ActivityEmpty icon="receipt_long" title="No activity yet" subtitle="Trade activity will appear here." />
          ) : (
            <div className="space-y-1.5 p-3">
              {transactions.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-lg px-3 py-2 text-[12px] font-medium text-slate-400">{item}</div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ActivityEmpty({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-start justify-center gap-3 px-5 py-10 sm:px-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.06]">
        <Icon name={icon} className="text-[22px]" />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-slate-200">{title}</p>
        <p className="mt-1 max-w-[16rem] text-[12px] font-medium leading-relaxed text-slate-500">{subtitle}</p>
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

// Mobile Positions bottom sheet — slides up from the trade floor (same motion
// language as MarketsSheet). Opened from the Vol-row swap_vert control.
function MobilePositions({
  tab, setTab, openPositions, allClosedPositions, onClose,
}: {
  tab: "open" | "closed";
  setTab: (t: "open" | "closed" | "tx") => void;
  openPositions: OpenPositionView[];
  allClosedPositions: ClosedPosition[];
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
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

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Positions"
    >
      <button
        type="button"
        aria-label="Close positions"
        onClick={requestClose}
        className={`absolute inset-0 bg-black/55 ${closing ? "animate-sheet-backdrop-out" : "animate-sheet-backdrop-in"}`}
      />
      <div
        className={`relative flex max-h-[78dvh] w-full flex-col rounded-t-3xl bg-[#151518] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-2xl ring-1 ring-white/[0.08] ${
          closing ? "animate-sheet-out" : "animate-sheet-in"
        }`}
      >
        <button
          type="button"
          onClick={requestClose}
          className="flex w-full justify-center pt-2.5 pb-1"
          aria-label="Close sheet"
        >
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </button>

        <div className="flex shrink-0 items-stretch border-b border-white/[0.07] text-[13px] font-black">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 transition ${tab === t ? "border-b-2 border-white text-white" : "text-slate-500"}`}
            >
              {t === "open" ? `Open${openPositions.length ? ` (${openPositions.length})` : ""}` : "Closed"}
            </button>
          ))}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Back to trade"
            className="grid w-12 shrink-0 place-items-center border-l border-white/[0.07] text-slate-500 active:text-white"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "open" ? (
            openPositions.length === 0 ? (
              <PositionsEmpty icon="swap_vert" title="No open positions" subtitle="Your open positions will appear here." />
            ) : (
              <div className="space-y-2 p-3">
                {openPositions.map((pos) => <PositionRow key={pos.id} pos={pos} />)}
              </div>
            )
          ) : allClosedPositions.length === 0 ? (
            <PositionsEmpty icon="history" title="No closed positions" subtitle="Settled contracts will appear here." />
          ) : (
            <div className="space-y-2 p-3">
              {allClosedPositions.map((position) => <ClosedPositionRow key={position.id} position={position} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Centered empty state for the mobile Positions screen (Deriv-style).
function PositionsEmpty({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-3 px-6 py-12">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.06]">
        <Icon name={icon} className="text-[22px]" />
      </span>
      <div>
        <div className="text-[15px] font-semibold text-slate-200">{title}</div>
        <div className="mt-1 max-w-[16rem] text-[12px] font-medium leading-relaxed text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}

function DigitRing({ isActive, stat }: { isActive: boolean; stat: { digit: number; pct: number } }) {
  const pct = Math.max(0, Math.min(1, stat.pct / 100));
  const isHot = stat.pct >= 15;
  // Smaller mobile (r=14) and desktop (r=16) rings — the strip was eating too
  // much vertical room and reading oversized.
  const rm = 14, rd = 16;
  const cm = 2 * Math.PI * rm, cd = 2 * Math.PI * rd;

  return (
    <div className="relative flex flex-col items-center gap-0.5">
      {isHot && (
        <span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-400" />
      )}
      <div className={`relative ${isActive ? "animate-digit-pop" : ""}`}>
        <svg width="34" height="34" viewBox="0 0 34 34" className="sm:hidden">
          <circle cx="17" cy="17" r={rm} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
          <circle
            cx="17" cy="17" r={rm}
            fill="none"
            stroke={isActive ? "#f59e0b" : "#22c55e"}
            strokeWidth={isActive ? "3" : "2"}
            strokeDasharray={cm}
            strokeDashoffset={cm - pct * cm}
            strokeLinecap="round"
            transform="rotate(-90 17 17)"
          />
          <text x="17" y="21" textAnchor="middle" fontSize="12" fontWeight="900" fill={isActive ? "#fbbf24" : "white"} fontFamily="monospace">{stat.digit}</text>
        </svg>
        <svg width="40" height="40" viewBox="0 0 40 40" className="hidden sm:block">
          <circle cx="20" cy="20" r={rd} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle
            cx="20" cy="20" r={rd}
            fill="none"
            stroke={isActive ? "#f59e0b" : "#22c55e"}
            strokeWidth={isActive ? "3.5" : "2.5"}
            strokeDasharray={cd}
            strokeDashoffset={cd - pct * cd}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
          />
          <text x="20" y="25" textAnchor="middle" fontSize="14" fontWeight="900" fill={isActive ? "#fbbf24" : "white"} fontFamily="monospace">{stat.digit}</text>
        </svg>
      </div>
      <span className={`text-[8px] font-black sm:text-[9px] ${stat.pct > 0 ? "text-emerald-400" : "text-slate-600"}`}>
        {stat.pct.toFixed(1)}%
      </span>
    </div>
  );
}

function ClosedPositionRow({ position }: { position: ClosedPosition }) {
  const { convert, currency } = useCurrency();
  const money = (kes: number) => fmtMoney(kes, currency, convert);
  const pnl = position.payout - position.stake;
  const badge =
    position.status === "won"
      ? "bg-emerald-400/10 text-emerald-300"
      : position.status === "partial"
        ? "bg-amber-400/10 text-amber-300"
        : "bg-red-400/10 text-red-300";
  const pnlClass =
    position.status === "won" ? "text-emerald-300" : "text-red-300";
  const pnlLabel =
    position.status === "won"
      ? `+${money(pnl)}`
      : position.status === "partial"
        ? money(pnl)
        : `-${money(position.stake)}`;

  return (
    <div className="border border-white/[0.07] bg-black/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{position.title}</div>
          <div className="text-[11px] font-bold text-slate-500">{position.subtitle}</div>
          {position.copyLeaderUsername && (
            <div className="mt-1 text-[10px] font-bold text-sky-400/90">
              Copied from @{position.copyLeaderUsername}
            </div>
          )}
        </div>
        <span className={`rounded px-2 py-1 text-[10px] font-black ${badge}`}>
          {position.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-black">
        <span className="text-slate-500">Stake {money(position.stake)}</span>
        <span className={pnlClass}>{pnlLabel}</span>
      </div>
    </div>
  );
}

// Generic open-position row — used for every contract type (digit, directional,
// accumulator, leveraged). Fixed-duration types show a live countdown; cash-out
// types (accumulator / leveraged) show "LIVE" and a value that moves each tick.
function PositionRow({ pos }: { pos: OpenPositionView }) {
  const hasCountdown = pos.settlesAt != null;
  const { convert, currency } = useCurrency();
  const money = (kes: number) => fmtMoney(kes, currency, convert);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hasCountdown) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [hasCountdown]);
  const secondsLeft = pos.settlesAt != null ? Math.max(0, Math.ceil((pos.settlesAt - now) / 1000)) : 0;
  // Countdown hit 0 but the row is still in Open — waiting on settle / server confirm.
  const settling = hasCountdown && secondsLeft === 0;
  const interim: InterimStatus | null = settling ? "settling" : (pos.interim ?? null);
  const profit = pos.value - pos.stake;
  const edgeClass =
    interim === "winning" ? "border-l-emerald-500/70"
    : interim === "losing" ? "border-l-red-500/60"
    : interim === "settling" ? "border-l-amber-400/70"
    : "border-l-transparent";
  const statusLabel =
    interim === "settling" ? "Settling"
    : interim === "winning" ? "Winning"
    : interim === "losing" ? "Losing"
    : null;

  return (
    <div className={`border border-l-2 bg-black/25 p-3 transition ${edgeClass} ${settling ? "border-amber-400/35" : "border-white/[0.07]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{pos.title}</div>
          <div className="truncate text-[11px] font-bold text-slate-500">{pos.subtitle}</div>
          {pos.copyLeaderUsername && (
            <div className="mt-1 truncate text-[10px] font-bold text-sky-400/90">
              Copied from @{pos.copyLeaderUsername}
            </div>
          )}
          {statusLabel && (
            <div className={`mt-1 text-[10px] font-bold tracking-wide ${
              interim === "winning" ? "text-emerald-400/90"
              : interim === "losing" ? "text-red-400/80"
              : "text-amber-400/80 animate-settle-pulse"
            }`}>
              {statusLabel}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-1 text-[10px] font-black ${
            settling
              ? "animate-settle-pulse bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/50"
              : hasCountdown
                ? "bg-sky-400/10 text-sky-300"
                : "bg-emerald-400/10 text-emerald-300"
          }`}
          title={settling ? "Settling…" : undefined}
        >
          {hasCountdown ? (settling ? "0s" : `${secondsLeft}s`) : "LIVE"}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-black">
        <span className="text-slate-500">Stake {money(pos.stake)}</span>
        <span className={profit >= 0 ? "text-emerald-300" : "text-red-300"}>{money(pos.value)}</span>
      </div>
    </div>
  );
}
