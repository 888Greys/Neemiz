"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// Single-market P&L detail, built in the Stitch design language, wired to
// /api/admin/markets/[key].

type MarketKey = "sports" | "binary" | "aviator" | "predictions" | "forex" | "p2p";

const MARKET_META: Record<MarketKey, { label: string; icon: string }> = {
  sports: { label: "Sportsbook", icon: "sports_soccer" },
  binary: { label: "Binary Options", icon: "candlestick_chart" },
  aviator: { label: "Aviator", icon: "flight_takeoff" },
  predictions: { label: "Predictions", icon: "online_prediction" },
  forex: { label: "Forex", icon: "currency_exchange" },
  p2p: { label: "P2P Desk", icon: "swap_horiz" },
};

interface MarketMetric { turnover: number; ggr: number; margin: number; activePlayers: number; openContracts: number; openLiability: number; liabilityExact: boolean }
interface MarketDetail {
  metric: MarketMetric;
  granularity: "hour" | "day";
  series: { date: string; ggr: number }[];
  openPositions: { id: string; user: string; label: string; amount: number }[];
  topPlayers: { user: string; net: number }[];
  health: { label: string; detail: string; tone: "ok" | "warn" | "danger" }[];
}

const money = (v: number) => {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  return a >= 1_000_000 ? `${sign}${CURRENCY_SYMBOL} ${(a / 1_000_000).toFixed(2)}M`
    : a >= 1_000 ? `${sign}${CURRENCY_SYMBOL} ${(a / 1_000).toFixed(1)}K`
      : `${sign}${CURRENCY_SYMBOL} ${Math.round(a).toLocaleString(MONEY_LOCALE)}`;
};
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="av2-card rounded-lg p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</div>
      <div className={`av2-mono mt-2 text-[20px] font-semibold ${tone ?? "text-[#e5e2e3]"}`}>{value}</div>
    </div>
  );
}

const TONE: Record<string, string> = { ok: "text-emerald-400", warn: "text-[#ffb786]", danger: "text-red-400" };

export function AdminV2Market({ marketKey }: { marketKey: MarketKey }) {
  const meta = MARKET_META[marketKey];
  const isP2P = marketKey === "p2p";
  const [data, setData] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/admin/markets/${marketKey}?range=today`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setData(d); }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [marketKey]);

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Market data could not be loaded.</div>;

  const m = data.metric;
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#222226] text-[#adc6ff]"><Icon name={meta.icon} size={20} /></span>
        <div>
          <h2 className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-[#e5e2e3]">{meta.label}</h2>
          <span className="mt-1 inline-block rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Live</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cell label={isP2P ? "Matched Vol" : "Turnover"} value={money(m.turnover)} />
        <Cell label={isP2P ? "Comm Fees" : "GGR"} value={`${money(m.ggr)} (${pct(m.margin)})`} tone="text-emerald-400" />
        <Cell label={isP2P ? "Active Traders" : "Active Players"} value={m.activePlayers.toLocaleString()} />
        <Cell label={isP2P ? "Open Disputes" : "Open Liability"} value={m.openLiability > 0 ? `${m.liabilityExact ? "" : "~"}${money(m.openLiability)}` : "—"} tone="text-[#ffb786]" />
      </div>

      <div className="av2-card mb-6 rounded-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-[#e5e2e3]">{isP2P ? "Fees" : "GGR"} trend</h3>
          <span className="text-xs text-[#c2c6d6]">{data.granularity === "hour" ? "hour by hour" : "day by day"}</span>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="v2mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#adc6ff" stopOpacity={0.3} /><stop offset="100%" stopColor="#adc6ff" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v: string) => (data.granularity === "hour" ? v : v.slice(5))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fill: "#8c909f", fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip contentStyle={{ background: "#161618", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }} formatter={(v) => money(Number(v ?? 0))} />
              <Area type="monotone" dataKey="ggr" stroke="#adc6ff" fill="url(#v2mk)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="av2-card overflow-hidden rounded-lg lg:col-span-2">
          <div className="flex h-11 items-center border-b border-[#424754]/50 px-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Open positions</h3>
          </div>
          {data.openPositions.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">No open positions</p>
          ) : (
            <table className="av2-mono w-full text-[13px]">
              <tbody className="divide-y divide-[#27272a]">
                {data.openPositions.map((p) => (
                  <tr key={p.id} className="hover:bg-[#1c1b1c]">
                    <td className="px-4 py-2.5 text-[#e5e2e3]">@{p.user}</td>
                    <td className="px-4 py-2.5 text-[#c2c6d6]">{p.label}</td>
                    <td className="px-4 py-2.5 text-right text-[#ffb786]">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="av2-card overflow-hidden rounded-lg">
            <div className="flex h-11 items-center gap-2 border-b border-[#424754]/50 px-4">
              <Icon name="emoji_events" size={14} className="text-[#c2c6d6]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Top players (net)</h3>
            </div>
            {data.topPlayers.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">No data</p>
            ) : (
              <div className="divide-y divide-[#27272a]">
                {data.topPlayers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                    <span className="truncate font-semibold text-[#e5e2e3]">@{p.user}</span>
                    <span className={`av2-mono ml-3 shrink-0 ${p.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{money(p.net)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="av2-card overflow-hidden rounded-lg">
            <div className="flex h-11 items-center gap-2 border-b border-[#424754]/50 px-4">
              <Icon name="sensors" size={14} className="text-[#c2c6d6]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Health</h3>
            </div>
            {data.health.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">Nominal</p>
            ) : (
              <div className="divide-y divide-[#27272a]">
                {data.health.map((h, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className={`text-[12px] font-semibold ${TONE[h.tone]}`}>{h.label}</div>
                    <p className="mt-0.5 text-[10px] text-[#8c909f]">{h.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
