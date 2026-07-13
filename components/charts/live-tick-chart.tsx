"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { Icon } from "@/components/icon";

/**
 * One shared live chart engine for Forex + Binary, so both feel identical.
 *
 * Fed a stream of raw price points ({ time, value }), it renders:
 *  • area  — a smooth per-tick line that GLIDES toward each new tick (LERP),
 *    scrolls continuously between ticks, and carries a pulsing live dot +
 *    dashed price stub at the tip (the "alive" Deriv/Olymp feel).
 *  • candles / heikin / bars — the points are bucketed into OHLC candles.
 *
 * A built-in chart-type picker (top-right) + zoom controls (bottom-left) come
 * with it. Colours are themeable so Forex can be green and Binary blue/white.
 */

export type LivePoint = { time: UTCTimestamp; value: number };
export type ChartLine = { id: string; price: number; color: string; title: string; dashed?: boolean };
export type ChartMarker = { id: string; time: UTCTimestamp; color: string; text: string; above?: boolean };
export type LiveChartType = "area" | "candles" | "heikin" | "bars";

export type LiveChartTheme = {
  bg: string;
  up: string;          // bull colour (candles/bars)
  down: string;        // bear colour
  areaTop: string;     // area gradient top
  areaBottom: string;  // area gradient bottom
  dot: string;         // live dot colour
  stub: string;        // dashed price stub colour (rgba)
  lineColor?: string;  // area line colour (defaults to `up`)
};

const CHART_TYPES: { key: LiveChartType; label: string; icon: string }[] = [
  { key: "area",    label: "Area line",     icon: "show_chart" },
  { key: "candles", label: "Candlesticks",  icon: "candlestick_chart" },
  { key: "heikin",  label: "Heikin Ashi",   icon: "waterfall_chart" },
  { key: "bars",    label: "Bars (OHLC)",   icon: "bar_chart" },
];

const RIGHT_GAP_BARS = 12;   // whitespace kept right of the live point
const VALUE_EASING = 0.16;   // fraction of the price gap closed per frame

function fmtClock(time: Time): string {
  const epoch = typeof time === "number" ? time : 0;
  return new Date(epoch * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

// Fold raw points into OHLC candles of `seconds` width (for the non-area modes).
function bucketCandles(points: LivePoint[], seconds: number): CandlestickData<Time>[] {
  const out: CandlestickData<Time>[] = [];
  let bucket = -1;
  for (const p of points) {
    const t = (Math.floor((p.time as number) / seconds) * seconds) as UTCTimestamp;
    const last = out[out.length - 1];
    if (t !== bucket || !last) {
      out.push({ time: t, open: p.value, high: p.value, low: p.value, close: p.value });
      bucket = t as number;
    } else {
      last.high = Math.max(last.high, p.value);
      last.low = Math.min(last.low, p.value);
      last.close = p.value;
    }
  }
  return out;
}

function toHeikinAshi(candles: CandlestickData<Time>[]): CandlestickData<Time>[] {
  let po: number | undefined, pc: number | undefined;
  return candles.map((c) => {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = po === undefined ? (c.open + c.close) / 2 : (po + pc!) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    po = haOpen; pc = haClose;
    return { time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose };
  });
}

export function LiveTickChart({
  points,
  theme,
  lines,
  markers,
  formatValue,
  bucketSeconds = 5,
  storageKey,
  minHeightClass = "min-h-[200px] sm:min-h-[260px]",
}: {
  points: LivePoint[];
  theme: LiveChartTheme;
  lines?: ChartLine[];
  markers?: ChartMarker[];
  formatValue?: (v: number) => string;
  bucketSeconds?: number;
  storageKey?: string;
  minHeightClass?: string;
}) {
  const [chartType, setChartType] = useState<LiveChartType>("area");
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const v = window.localStorage.getItem(storageKey);
    if (v === "area" || v === "candles" || v === "heikin" || v === "bars") setChartType(v);
  }, [storageKey]);
  const chartTypeRef = useRef<LiveChartType>(chartType);
  useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);
  const pointsRef = useRef<LivePoint[]>(points);
  useEffect(() => { pointsRef.current = points; }, [points]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area" | "Candlestick" | "Bar"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const dotRef = useRef<HTMLDivElement | null>(null);
  const stubRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Area glide/scroll state.
  const targetRef = useRef<{ time: UTCTimestamp; value: number } | null>(null);
  const renderValueRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ time: number; value: number } | null>(null);
  const lastTickAtRef = useRef<number>(0);
  const tickIntervalRef = useRef<number>(1000);
  // Candle glide state.
  const candleAnimRef = useRef<{ time: Time; open: number; high: number; low: number; target: number; shown: number } | null>(null);

  const fmt = formatValue ?? ((v: number) => String(v));
  const isArea = chartType === "area";

  // ── Create chart + series for the active type; rebuild on type/theme change ──
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: theme.bg }, textColor: "#8d99ae", fontFamily: "var(--font-jakarta), sans-serif" },
      grid: { vertLines: { color: "rgba(148,163,184,0.045)" }, horzLines: { color: "rgba(148,163,184,0.06)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.12 } },
      timeScale: {
        borderVisible: false, timeVisible: true, secondsVisible: true,
        rightOffset: RIGHT_GAP_BARS, barSpacing: isArea ? 16 : 8, minBarSpacing: 2,
        shiftVisibleRangeOnNewBar: false,
        tickMarkFormatter: (t: Time) => fmtClock(t),
      },
      crosshair: { vertLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" }, horzLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" } },
      localization: { priceFormatter: (p: number) => fmt(p), timeFormatter: (t: Time) => fmtClock(t) },
    });

    const ohlc = {
      upColor: theme.up, downColor: theme.down, borderUpColor: theme.up, borderDownColor: theme.down,
      wickUpColor: theme.up, wickDownColor: theme.down, borderVisible: true,
      priceLineVisible: false, lastValueVisible: false,
    };
    const series: ISeriesApi<"Area" | "Candlestick" | "Bar"> =
      chartType === "area"
        ? chart.addSeries(AreaSeries, {
            lineColor: theme.lineColor ?? theme.up, lineWidth: 2, topColor: theme.areaTop, bottomColor: theme.areaBottom,
            lastValueVisible: true, priceLineVisible: false,
            crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
          })
        : chartType === "bars"
        ? chart.addSeries(BarSeries, { upColor: theme.up, downColor: theme.down, thinBars: true, priceLineVisible: false, lastValueVisible: false })
        : chart.addSeries(CandlestickSeries, ohlc);

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    // Seed with whatever we already have.
    const seed = pointsRef.current;
    if (seed.length) {
      if (chartType === "area") {
        series.setData(seed.map((p) => ({ time: p.time, value: p.value })));
        const l = seed[seed.length - 1];
        targetRef.current = { time: l.time, value: l.value };
        renderValueRef.current = l.value;
        lastPointRef.current = { time: l.time as number, value: l.value };
        chart.timeScale().scrollToPosition(RIGHT_GAP_BARS, false);
      } else {
        let cs = bucketCandles(seed, bucketSeconds);
        if (chartType === "heikin") cs = toHeikinAshi(cs);
        series.setData(cs as never);
        const l = cs[cs.length - 1];
        if (l) candleAnimRef.current = { time: l.time, open: l.open, high: l.high, low: l.low, target: l.close, shown: l.close };
        chart.timeScale().scrollToRealTime();
      }
    }

    const step = () => {
      rafRef.current = requestAnimationFrame(step);
      const ch = chartRef.current, s = seriesRef.current;
      if (!ch || !s) return;

      if (chartTypeRef.current === "area") {
        const target = targetRef.current;
        if (!target) return;
        const cur = renderValueRef.current ?? target.value;
        const diff = target.value - cur;
        const next = Math.abs(diff) < 1e-9 ? target.value : cur + diff * VALUE_EASING;
        if (next !== cur) { renderValueRef.current = next; (s as ISeriesApi<"Area">).update({ time: target.time, value: next }); }
        const frac = lastTickAtRef.current ? Math.min(1, (performance.now() - lastTickAtRef.current) / tickIntervalRef.current) : 0;
        ch.timeScale().scrollToPosition(RIGHT_GAP_BARS + frac, false);
        // live dot + stub
        const y = s.priceToCoordinate(renderValueRef.current ?? target.value);
        const x = ch.timeScale().timeToCoordinate(target.time);
        const dot = dotRef.current, stub = stubRef.current;
        if (dot) { if (x != null && y != null) { dot.style.transform = `translate(${x}px, ${y}px)`; dot.style.opacity = "1"; } else dot.style.opacity = "0"; }
        if (stub) { const w = containerRef.current?.clientWidth ?? 0; if (x != null && y != null && w > x) { stub.style.transform = `translate(${x}px, ${y}px)`; stub.style.width = `${w - x}px`; stub.style.opacity = "1"; } else stub.style.opacity = "0"; }
      } else if (chartTypeRef.current !== "heikin") {
        // Candle/bar glide: ease the forming bar's close.
        const a = candleAnimRef.current;
        if (!a) return;
        const diff = a.target - a.shown;
        if (Math.abs(diff) < 1e-9) return;
        a.shown = Math.abs(diff) < 1e-7 ? a.target : a.shown + diff * 0.28;
        (s as ISeriesApi<"Candlestick" | "Bar">).update({ time: a.time, open: a.open, high: Math.max(a.high, a.shown), low: Math.min(a.low, a.shown), close: a.shown });
        if (dotRef.current) dotRef.current.style.opacity = "0";
        if (stubRef.current) stubRef.current.style.opacity = "0";
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      chart.remove();
      chartRef.current = null; seriesRef.current = null; markersRef.current = null;
      priceLinesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, theme.bg, theme.up, theme.down]);

  // ── New points ──
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || points.length === 0) return;
    const latest = points[points.length - 1];

    if (chartTypeRef.current === "area") {
      const prev = points[points.length - 2];
      const last = lastPointRef.current;
      if (last !== null && prev?.time === last.time && prev?.value === last.value && (latest.time as number) > last.time) {
        (series as ISeriesApi<"Area">).update({ time: prev.time, value: prev.value });
        targetRef.current = { time: latest.time, value: latest.value };
        if (renderValueRef.current == null) renderValueRef.current = prev.value;
        lastPointRef.current = { time: latest.time as number, value: latest.value };
        const nowMs = performance.now();
        const dt = nowMs - lastTickAtRef.current;
        if (lastTickAtRef.current && dt > 50 && dt < 5000) tickIntervalRef.current = tickIntervalRef.current * 0.6 + dt * 0.4;
        lastTickAtRef.current = nowMs;
        return;
      }
      (series as ISeriesApi<"Area">).setData(points.map((p) => ({ time: p.time, value: p.value })));
      targetRef.current = { time: latest.time, value: latest.value };
      renderValueRef.current = latest.value;
      lastPointRef.current = { time: latest.time as number, value: latest.value };
      lastTickAtRef.current = performance.now();
      chart.timeScale().scrollToPosition(RIGHT_GAP_BARS, false);
      return;
    }

    // Candle modes: rebuild candles from the point buffer.
    let cs = bucketCandles(points, bucketSeconds);
    if (chartTypeRef.current === "heikin") cs = toHeikinAshi(cs);
    const l = cs[cs.length - 1];
    if (!l) return;
    if (chartTypeRef.current === "heikin") {
      series.setData(cs as never);
    } else {
      // setData the settled bars, let the rAF glide the forming one.
      series.setData(cs as never);
      candleAnimRef.current = { time: l.time, open: l.open, high: l.high, low: l.low, target: l.close, shown: candleAnimRef.current?.time === l.time ? candleAnimRef.current.shown : l.open };
    }
    chart.timeScale().scrollToRealTime();
  }, [points, bucketSeconds]);

  // ── Overlay lines (bid/ask, barrier, entry, …) ──
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const want = lines ?? [];
    const wantIds = new Set(want.map((l) => l.id));
    const map = priceLinesRef.current;
    for (const [id, line] of map) { if (!wantIds.has(id)) { series.removePriceLine(line); map.delete(id); } }
    for (const l of want) {
      const opts = { price: l.price, color: l.color, lineWidth: 1 as const, lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: true, title: l.title };
      const existing = map.get(l.id);
      if (existing) existing.applyOptions(opts); else map.set(l.id, series.createPriceLine(opts));
    }
  }, [lines, chartType]);

  // ── Markers ──
  useEffect(() => {
    const plugin = markersRef.current;
    if (!plugin) return;
    const ms: SeriesMarker<Time>[] = (markers ?? []).map((m) => ({ time: m.time, position: m.above ? "aboveBar" : "belowBar", color: m.color, shape: "circle", text: m.text }));
    plugin.setMarkers(ms);
  }, [markers, chartType]);

  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const current = ts.options().barSpacing ?? 12;
    ts.applyOptions({ barSpacing: Math.min(60, Math.max(2, current * factor)) });
  };
  const recenter = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    ts.applyOptions({ barSpacing: isArea ? 16 : 8 });
    ts.scrollToPosition(RIGHT_GAP_BARS, false);
  };
  const selectType = (t: LiveChartType) => {
    setChartType(t);
    if (storageKey) { try { window.localStorage.setItem(storageKey, t); } catch { /* ignore */ } }
    setPickerOpen(false);
  };
  const active = CHART_TYPES.find((t) => t.key === chartType) ?? CHART_TYPES[0];

  return (
    <div className={`relative h-full overflow-hidden ${minHeightClass}`} style={{ background: theme.bg }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* dashed price stub — dot to the right edge (area only) */}
      <div ref={stubRef} className="pointer-events-none absolute left-0 top-0 z-10 h-0 opacity-0 will-change-transform" style={{ borderTop: `1px dashed ${theme.stub}` }} />
      {/* pulsing live dot (area only) */}
      <div ref={dotRef} className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 will-change-transform">
        <span className="relative flex h-3 w-3 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: theme.dot }} />
          <span className="relative inline-flex h-3 w-3 rounded-full ring-2" style={{ background: theme.dot, borderColor: theme.bg }} />
        </span>
      </div>

      {/* chart-type picker (top-right) */}
      <div className="absolute right-2 top-2 z-30 sm:right-3 sm:top-3">
        <button type="button" onClick={() => setPickerOpen((v) => !v)} aria-label="Chart type"
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#1c1d24]/90 px-2.5 text-slate-100 ring-1 ring-white/10 backdrop-blur transition hover:bg-[#22242a] active:scale-[0.97]">
          <Icon name={active.icon} className="text-[16px]" />
          <Icon name="expand_more" className="text-[15px] text-slate-400" />
        </button>
        {pickerOpen && (
          <>
            <button type="button" aria-label="Close" onClick={() => setPickerOpen(false)} className="fixed inset-0 z-[-1] cursor-default" />
            <div className="absolute right-0 mt-1.5 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#151518] py-1 shadow-2xl">
              {CHART_TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => selectType(t.key)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold transition hover:bg-white/[0.05] ${chartType === t.key ? "text-[#75b8ff]" : "text-slate-200"}`}>
                  <Icon name={t.icon} className="text-[18px]" />
                  <span className="flex-1">{t.label}</span>
                  {chartType === t.key && <Icon name="check" className="text-[16px]" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* zoom controls (bottom-left) */}
      <div className="absolute bottom-14 left-3 z-10 flex flex-col gap-1 sm:bottom-12">
        <button type="button" onClick={() => zoom(1.3)} title="Zoom in" aria-label="Zoom in" className="grid h-7 w-7 place-items-center rounded border border-white/10 bg-[#1c1d24]/90 text-slate-100 shadow-lg backdrop-blur transition hover:bg-[#22242a] sm:h-8 sm:w-8"><Icon name="add" className="text-[15px] sm:text-[18px]" /></button>
        <button type="button" onClick={recenter} title="Latest" aria-label="Scroll to latest" className="grid h-7 w-7 place-items-center rounded border border-white/10 bg-[#1c1d24]/90 text-slate-100 shadow-lg backdrop-blur transition hover:bg-[#22242a] sm:h-8 sm:w-8"><Icon name="my_location" className="text-[14px] sm:text-[16px]" /></button>
        <button type="button" onClick={() => zoom(1 / 1.3)} title="Zoom out" aria-label="Zoom out" className="grid h-7 w-7 place-items-center rounded border border-white/10 bg-[#1c1d24]/90 text-slate-100 shadow-lg backdrop-blur transition hover:bg-[#22242a] sm:h-8 sm:w-8"><Icon name="remove" className="text-[15px] sm:text-[18px]" /></button>
      </div>

      <span className="absolute bottom-3 right-3 z-10 rounded bg-[#1c1d24]/90 px-2 py-1 text-[10px] font-black text-emerald-300 backdrop-blur">LIVE</span>
    </div>
  );
}
