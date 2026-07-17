"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// Ops Action Queue — consolidated triage from /api/admin/ops. Replaces the
// cockpit landing queue after /admin/new started redirecting to Money.

interface Queue { key: string; label: string; icon: string; href: string; count: number; amount: number; oldest: string | null; detail: string }
interface Ops { queues: Queue[]; totalPending: number }

const money = (v: number) => v >= 1_000_000
  ? `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K` : `${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;

function waited(iso: string | null) {
  if (!iso) return "—";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function AdminV2Ops() {
  const [data, setData] = useState<Ops | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/ops").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setData(d); }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Ops data could not be loaded.</div>;

  const active = data.queues.filter((q) => q.count > 0);

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-[16px] font-semibold text-[#e5e2e3]">Action Queue</h3>
        <p className="mt-1 text-[13px] text-[#c2c6d6]">Every queue that needs a human decision — open a row to act.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="av2-card relative flex h-32 flex-col justify-between overflow-hidden rounded-lg p-4">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Total Pending</span>
            <Icon name="pending" size={20} className={data.totalPending > 0 ? "text-[#ffb786]" : "text-[#c2c6d6]"} />
          </div>
          <div>
            <span className={`av2-mono text-[32px] font-semibold ${data.totalPending > 0 ? "text-[#ffb786]" : "text-[#e5e2e3]"}`}>{data.totalPending}</span>
            <div className="mt-1 text-[13px] text-[#c2c6d6]">items awaiting action</div>
          </div>
        </div>
        {active.slice(0, 3).map((q) => (
          <Link key={q.key} href={q.href} className="av2-card relative flex h-32 flex-col justify-between overflow-hidden rounded-lg p-4 transition-colors hover:border-[#3b82f6]/40">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{q.label}</span>
              <Icon name={q.icon} size={20} className="text-[#adc6ff]" />
            </div>
            <div>
              <span className="av2-mono text-[32px] font-semibold text-[#e5e2e3]">{q.count}</span>
              <div className="mt-1 text-[13px] text-[#c2c6d6]">oldest {waited(q.oldest)}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex h-11 items-center border-b border-[#424754]/50 px-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">All queues</h3>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#27272a] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
              <th className="px-4 py-2.5 text-left font-semibold">Queue</th>
              <th className="px-4 py-2.5 text-right font-semibold">Count</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-4 py-2.5 text-right font-semibold">Oldest</th>
              <th className="px-4 py-2.5 text-right font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272a]">
            {data.queues.map((q) => (
              <tr key={q.key} className={`hover:bg-[#1c1b1c] ${q.count > 0 ? "bg-red-500/[0.03]" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon name={q.icon} size={18} className={q.count > 0 ? "text-red-400" : "text-[#8c909f]"} />
                    <div>
                      <div className="font-semibold text-[#e5e2e3]">{q.label}</div>
                      <div className={`text-[11px] ${q.count > 0 ? "text-red-400/80" : "text-[#8c909f]"}`}>{q.detail}</div>
                    </div>
                  </div>
                </td>
                <td className="av2-mono px-4 py-3 text-right text-[#e5e2e3]">{q.count}</td>
                <td className="av2-mono px-4 py-3 text-right text-[#c2c6d6]">{q.amount > 0 ? money(q.amount) : "—"}</td>
                <td className="av2-mono px-4 py-3 text-right text-[#c2c6d6]">{waited(q.oldest)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={q.href} className="rounded border border-[#4d8eff]/30 bg-[#4d8eff]/10 px-3 py-1.5 text-[10px] font-bold text-[#adc6ff] hover:bg-[#4d8eff]/20">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
