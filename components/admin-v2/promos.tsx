"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

type Promo = {
  id: string;
  code: string;
  amountKes: string | number;
  redemptionCount: number;
  maxRedemptions: number | null;
  isActive: boolean;
  description: string | null;
};

type Redemption = {
  id: string;
  code: string;
  amountKes: number;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    walletBalance: number;
    joinedAt: string;
  };
};

const money = (v: number) =>
  `${CURRENCY_SYMBOL} ${Number(v).toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;

export function AdminV2Promos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (code?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = code ? `?code=${encodeURIComponent(code)}` : "";
      const res = await fetch(`/api/admin/promo${qs}`);
      if (!res.ok) throw new Error("Failed to load promos");
      const data = await res.json();
      setPromos(data.promos ?? []);
      setRedemptions(data.redemptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {promos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setFilter(p.code);
              void load(p.code);
            }}
            className={`av2-card rounded-lg p-4 text-left transition hover:ring-1 hover:ring-[#adc6ff]/40 ${
              filter === p.code ? "ring-1 ring-[#adc6ff]" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="av2-mono text-[16px] font-bold text-[#e5e2e3]">{p.code}</span>
              <span className={`text-[10px] font-bold uppercase ${p.isActive ? "text-emerald-400" : "text-slate-500"}`}>
                {p.isActive ? "Active" : "Off"}
              </span>
            </div>
            <p className="mt-2 av2-mono text-[22px] font-bold text-[#adc6ff]">{money(Number(p.amountKes))}</p>
            <p className="mt-1 text-[11px] text-[#8c909f]">
              {p.redemptionCount} redeemed
              {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ""}
            </p>
          </button>
        ))}
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#424754]/50 px-4 py-3">
          <h3 className="text-[13px] font-semibold text-[#e5e2e3]">Players who used promo codes</h3>
          <div className="ml-auto flex items-center gap-2">
            {filter && (
              <button
                type="button"
                onClick={() => { setFilter(""); void load(); }}
                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-[#c2c6d6]"
              >
                Clear {filter}
              </button>
            )}
            <button
              type="button"
              onClick={() => void load(filter || undefined)}
              className="grid h-8 w-8 place-items-center rounded-full text-[#c2c6d6] hover:bg-white/[0.06]"
              aria-label="Refresh"
            >
              <Icon name="refresh" className="text-[16px]" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-10 text-center text-[12px] text-[#8c909f]">Loading…</p>
        ) : error ? (
          <p className="px-4 py-10 text-center text-[12px] text-red-400">{error}</p>
        ) : redemptions.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-[#8c909f]">No redemptions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-[#27272a] text-[10px] uppercase tracking-wider text-[#8c909f]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Code</th>
                  <th className="px-4 py-2.5 font-semibold">Player</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Credit</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {redemptions.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#8c909f]">
                      {new Date(r.createdAt).toLocaleString("en-KE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="av2-mono font-bold text-[#adc6ff]">{r.code}</span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#e5e2e3]">
                      @{r.user.username ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-[#8c909f]">
                      {r.user.phone || r.user.email || "—"}
                    </td>
                    <td className="av2-mono px-4 py-2.5 text-right text-emerald-400">{money(r.amountKes)}</td>
                    <td className="av2-mono px-4 py-2.5 text-right text-[#e5e2e3]">{money(r.user.walletBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
