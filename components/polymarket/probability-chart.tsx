"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid, Dot,
} from "recharts";

interface PricePoint { t: number; p: number; }
interface SeriesData { label: string; color: string; history: PricePoint[]; }

const COLORS = ["#3b82f6", "#f59e0b", "#f97316", "#a855f7", "#10b981", "#ec4899"];

const INTERVALS = [
  { label: "1D", value: "1d", fidelity: "5"   },
  { label: "1W", value: "1w", fidelity: "60"  },
  { label: "1M", value: "1m", fidelity: "240" },
  { label: "All", value: "all", fidelity: "1440" },
];

interface Props {
  tokenIds: string[];
  outcomes: string[];
}

function formatTime(ts: number, interval: string) {
  const d = new Date(ts * 1000);
  if (interval === "1d") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (interval === "all" || interval === "1m") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, interval }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#1a1b22] px-3 py-2.5 shadow-xl">
      <p className="mb-1.5 text-[11px] font-bold text-white/35">{formatTime(label, interval)}</p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[12px] font-semibold text-white/70">{entry.name}</span>
          <span className="ml-auto pl-4 text-[12px] font-black text-white">{(entry.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function ProbabilityChart({ tokenIds, outcomes }: Props) {
  const [interval, setInterval] = useState("1w");
  const [series,   setSeries]   = useState<SeriesData[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!tokenIds.length) return;
    setLoading(true);

    const fidelity = INTERVALS.find((i) => i.value === interval)?.fidelity ?? "60";

    Promise.all(
      tokenIds.map(async (id, idx) => {
        try {
          const res = await fetch(`/api/polymarket/prices-history?tokenId=${encodeURIComponent(id)}&interval=${interval}&fidelity=${fidelity}`);
          if (!res.ok) return null;
          const data: { history: PricePoint[] } = await res.json();
          return {
            label:   outcomes[idx] ?? `Outcome ${idx + 1}`,
            color:   COLORS[idx % COLORS.length],
            history: data.history ?? [],
          } satisfies SeriesData;
        } catch { return null; }
      })
    ).then((results) => {
      setSeries(results.filter(Boolean) as SeriesData[]);
      setLoading(false);
    });
  }, [tokenIds, outcomes, interval]);

  // Merge all series onto a shared timeline
  const merged = useMemo(() => {
    if (!series.length) return [];
    const allTs = new Set<number>();
    series.forEach((s) => s.history.forEach((p) => allTs.add(p.t)));
    const sorted = [...allTs].sort((a, b) => a - b);

    return sorted.map((t) => {
      const row: Record<string, number> = { t };
      series.forEach((s) => {
        const pt = s.history.findLast?.((p) => p.t <= t) ?? s.history.find((p) => p.t >= t);
        if (pt) row[s.label] = pt.p;
      });
      return row;
    });
  }, [series]);

  const lastValues = useMemo(() =>
    series.map((s) => ({ label: s.label, color: s.color, p: s.history[s.history.length - 1]?.p ?? 0 })),
  [series]);

  return (
    <div className="flex flex-col gap-3">
      {/* Legend + interval switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-3">
          {lastValues.map(({ label, color, p }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-[11px] font-semibold text-white/55">{label}</span>
              <span className="text-[11px] font-black" style={{ color }}>{(p * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval(iv.value)}
              className={`rounded-md px-3 py-1 text-[11px] font-black transition ${
                interval === iv.value
                  ? "bg-white/10 text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          </div>
        ) : merged.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[12px] text-white/25">No history data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(v) => formatTime(v, interval)}
                tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                minTickGap={60}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 1]}
                width={36}
                ticks={[0.2, 0.4, 0.6, 0.8, 1.0]}
              />
              <Tooltip
                content={<CustomTooltip interval={interval} />}
                cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
              />
              <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
              {series.map((s) => (
                <Line
                  key={s.label}
                  type="monotone"
                  dataKey={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={<Dot r={4} fill={s.color} stroke="#1a1b22" strokeWidth={2} />}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
