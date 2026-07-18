"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
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
 * Shared live area chart for Forex + Binary (area line only).
 *
 * Fed a stream of raw price points ({ time, value }), it renders a smooth
 * per-tick line that glides toward each new tick, keeps a right-side gap,
 * and carries a pulsing live dot + dashed price stub at the tip.
 */

export type LivePoint = { time: UTCTimestamp; value: number };
export type ChartLine = { id: string; price: number; color: string; title: string; dashed?: boolean };
export type ChartMarker = { id: string; time: UTCTimestamp; color: string; text: string; above?: boolean };
/** @deprecated Area line is the only chart type; kept for call-site compat. */
export type LiveChartType = "area";

export type LiveChartTheme = {
  bg: string;
  up: string;
  down: string;
  areaTop: string;
  areaBottom: string;
  dot: string;
  stub: string;
  lineColor?: string;
};

/** Small trailing gap so the tip isn’t glued to the price scale. */
const RIGHT_GAP_BARS = 2;
const VALUE_EASING = 0.16;
const DEFAULT_BAR_SPACING = 8;

function fmtClock(time: Time): string {
  const epoch = typeof time === "number" ? time : 0;
  return new Date(epoch * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

export function LiveTickChart({
  points,
  theme,
  lines,
  markers,
  formatValue,
  pricePrecision = 2,
  topInset = 0,
  minHeightClass = "min-h-0",
}: {
  points: LivePoint[];
  theme: LiveChartTheme;
  lines?: ChartLine[];
  markers?: ChartMarker[];
  formatValue?: (v: number) => string;
  /** Series price ticks / axis labels. Forex needs 5 (or 3 for JPY); binary ~2. */
  pricePrecision?: number;
  /** @deprecated Ignored — area line is the only mode. */
  bucketSeconds?: number;
  /** @deprecated Ignored — chart-type picker removed. */
  storageKey?: string;
  topInset?: number;
  minHeightClass?: string;
}) {
  const pointsRef = useRef<LivePoint[]>(points);
  useEffect(() => { pointsRef.current = points; }, [points]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const dotRef = useRef<HTMLDivElement | null>(null);
  const stubRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const targetRef = useRef<{ time: UTCTimestamp; value: number } | null>(null);
  const renderValueRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ time: number; value: number } | null>(null);
  const lastTickAtRef = useRef<number>(0);
  const tickIntervalRef = useRef<number>(1000);
  const lastDotPosRef = useRef<{ x: number; y: number } | null>(null);

  const fmt = formatValue ?? ((v: number) => String(v));
  const precision = Math.max(0, Math.min(8, Math.floor(pricePrecision)));
  const minMove = Number((10 ** -precision).toFixed(precision));
  const priceFormat = { type: "price" as const, precision, minMove };

  // ── Create chart ──
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    lastDotPosRef.current = null;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: theme.bg }, textColor: "#94a3b8", fontFamily: "var(--font-jakarta), sans-serif" },
      grid: {
        vertLines: { visible: true, color: "rgba(148,163,184,0.04)" },
        horzLines: { visible: true, color: "rgba(148,163,184,0.055)" },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        entireTextOnly: false,
        ticksVisible: false,
        minimumWidth: 64,
        // Tight margins so the series fills the plot (not a thin band mid-panel).
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false, timeVisible: true, secondsVisible: true,
        rightOffset: RIGHT_GAP_BARS, barSpacing: DEFAULT_BAR_SPACING, minBarSpacing: 2,
        shiftVisibleRangeOnNewBar: false,
        tickMarkFormatter: (t: Time) => fmtClock(t),
      },
      crosshair: { vertLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" }, horzLine: { color: "rgba(56,189,248,0.5)", labelBackgroundColor: "#2563eb" } },
      localization: { priceFormatter: (p: number) => fmt(p), timeFormatter: (t: Time) => fmtClock(t) },
    });

    const padAutoscale = (base: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
      const original = base();
      if (!original?.priceRange) return original;
      const { minValue, maxValue } = original.priceRange;
      const span = Math.max(maxValue - minValue, minMove * 40);
      const mid = (minValue + maxValue) / 2;
      const half = (span / 2) * 1.12;
      return { priceRange: { minValue: mid - half, maxValue: mid + half } };
    };

    const series = chart.addSeries(AreaSeries, {
      lineColor: theme.lineColor ?? theme.up,
      lineWidth: 2,
      topColor: theme.areaTop,
      bottomColor: theme.areaBottom,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: theme.lineColor ?? theme.up,
      priceLineWidth: 1,
      priceFormat,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      autoscaleInfoProvider: padAutoscale,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    const seed = pointsRef.current;
    if (seed.length) {
      series.setData(seed.map((p) => ({ time: p.time, value: p.value })));
      const l = seed[seed.length - 1];
      targetRef.current = { time: l.time, value: l.value };
      renderValueRef.current = l.value;
      lastPointRef.current = { time: l.time as number, value: l.value };
      chart.timeScale().scrollToPosition(RIGHT_GAP_BARS, false);
    }

    const step = () => {
      rafRef.current = requestAnimationFrame(step);
      const ch = chartRef.current;
      const s = seriesRef.current;
      if (!ch || !s) return;

      const target = targetRef.current;
      if (!target) return;
      const cur = renderValueRef.current ?? target.value;
      const diff = target.value - cur;
      const next = Math.abs(diff) < 1e-9 ? target.value : cur + diff * VALUE_EASING;
      if (next !== cur) {
        renderValueRef.current = next;
        s.update({ time: target.time, value: next });
      }
      ch.timeScale().scrollToPosition(RIGHT_GAP_BARS, false);

      // Use plain numbers for DOM transforms — LWC's Coordinate is a branded type.
      const price = renderValueRef.current ?? target.value;
      const coordY = s.priceToCoordinate(price);
      const coordX = ch.timeScale().timeToCoordinate(target.time);
      const plotW = containerRef.current?.clientWidth ?? 0;
      const scaleW = ch.priceScale("right").width();
      const spacing = ch.timeScale().options().barSpacing ?? DEFAULT_BAR_SPACING;
      let x: number | null = coordX == null ? null : Number(coordX);
      let y: number | null = coordY == null ? null : Number(coordY);
      if (x == null && plotW > 0) {
        x = Math.max(0, plotW - scaleW - RIGHT_GAP_BARS * spacing);
      }
      if (y == null && lastDotPosRef.current) y = lastDotPosRef.current.y;
      const dot = dotRef.current;
      const stub = stubRef.current;
      if (dot) {
        if (x != null && y != null) {
          lastDotPosRef.current = { x, y };
          dot.style.transform = `translate(${x}px, ${y}px)`;
          dot.style.opacity = "1";
        } else if (lastDotPosRef.current) {
          const p = lastDotPosRef.current;
          dot.style.transform = `translate(${p.x}px, ${p.y}px)`;
          dot.style.opacity = "1";
        }
      }
      if (stub) {
        const endX = Math.max(0, plotW - scaleW);
        const sx = x ?? lastDotPosRef.current?.x;
        const sy = y ?? lastDotPosRef.current?.y;
        if (sx != null && sy != null && endX > sx) {
          stub.style.transform = `translate(${sx}px, ${sy}px)`;
          stub.style.width = `${endX - sx}px`;
          stub.style.opacity = "1";
        }
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.bg, theme.up, theme.down, theme.lineColor, theme.areaTop, theme.areaBottom, precision, minMove, topInset]);

  // ── New points ──
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || points.length === 0) return;
    const latest = points[points.length - 1];
    const prev = points[points.length - 2];
    const last = lastPointRef.current;

    if (last !== null && prev?.time === last.time && prev?.value === last.value && (latest.time as number) > last.time) {
      series.update({ time: prev.time, value: prev.value });
      targetRef.current = { time: latest.time, value: latest.value };
      if (renderValueRef.current == null) renderValueRef.current = prev.value;
      lastPointRef.current = { time: latest.time as number, value: latest.value };
      const nowMs = performance.now();
      const dt = nowMs - lastTickAtRef.current;
      if (lastTickAtRef.current && dt > 50 && dt < 5000) tickIntervalRef.current = tickIntervalRef.current * 0.6 + dt * 0.4;
      lastTickAtRef.current = nowMs;
      return;
    }

    series.setData(points.map((p) => ({ time: p.time, value: p.value })));
    targetRef.current = { time: latest.time, value: latest.value };
    renderValueRef.current = latest.value;
    lastPointRef.current = { time: latest.time as number, value: latest.value };
    lastTickAtRef.current = performance.now();
    chart.timeScale().scrollToPosition(RIGHT_GAP_BARS, false);
  }, [points]);

  // ── Overlay lines ──
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const want = lines ?? [];
    const wantIds = new Set(want.map((l) => l.id));
    const map = priceLinesRef.current;
    for (const [id, line] of map) {
      if (!wantIds.has(id)) {
        series.removePriceLine(line);
        map.delete(id);
      }
    }
    for (const l of want) {
      const opts = {
        price: l.price,
        color: l.color,
        lineWidth: 1 as const,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: l.title,
      };
      const existing = map.get(l.id);
      if (existing) existing.applyOptions(opts);
      else map.set(l.id, series.createPriceLine(opts));
    }
  }, [lines]);

  // ── Markers ──
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
    const current = ts.options().barSpacing ?? DEFAULT_BAR_SPACING;
    ts.applyOptions({ barSpacing: Math.min(60, Math.max(2, current * factor)) });
  };
  const recenter = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    ts.applyOptions({ barSpacing: DEFAULT_BAR_SPACING });
    ts.scrollToPosition(RIGHT_GAP_BARS, false);
  };

  return (
    <div className={`relative h-full overflow-hidden ${minHeightClass}`} style={{ background: theme.bg }}>
      <div className="absolute inset-x-0 bottom-0" style={{ top: topInset }}>
        <div ref={containerRef} className="absolute inset-0" />

        <div ref={stubRef} className="pointer-events-none absolute left-0 top-0 z-10 h-0 opacity-0 will-change-transform" style={{ borderTop: `1px dashed ${theme.stub}` }} />
        <div ref={dotRef} className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 will-change-transform">
          <span className="relative flex h-3 w-3 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: theme.dot }} />
            <span className="relative inline-flex h-3 w-3 rounded-full ring-2" style={{ background: theme.dot, borderColor: theme.bg }} />
          </span>
        </div>
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
