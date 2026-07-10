"use client";

import { useEffect, useState } from "react";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// Risk dashboard, built in the Stitch design language, wired to /api/admin/risk.

interface MarketExposure { key: string; label: string; openLiability: number; openContracts: number; exact: boolean }
interface StuckSettlement { market: string; stuck: number; note: string }
interface CryptoLiability { crypto: string; amount: number }
interface Risk {
  exposure: MarketExposure[];
  totalExposure: number;
  settlement: StuckSettlement[];
  settlementStuck: number;
  voids24h: number;
  cryptoLiability: CryptoLiability[];
  flags: { suspended: number; negativeBalances: number; pendingWithdrawals: { count: number; amount: number } };
}

const money = (v: number) => v >= 1_000_000
  ? `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(1)}K` : `${CURRENCY_SYMBOL} ${Math.round(v).toLocaleString(MONEY_LOCALE)}`;
const cryptoAmt = (v: number) => v.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 4 });

function Bento({ label, value, icon, tone, note }: { label: string; value: string; icon: string; tone: string; note: string }) {
  return (
    <div className="av2-card relative flex h-32 flex-col justify-between overflow-hidden rounded-lg p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
        <Icon name={icon} size={20} className={tone} />
      </div>
      <div>
        <span className={`av2-mono text-[32px] font-semibold ${tone}`}>{value}</span>
        <div className="mt-1 text-[13px] text-[#c2c6d6]">{note}</div>
      </div>
    </div>
  );
}

export function AdminV2Risk() {
  const [data, setData] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/risk").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setData(d); }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Risk data could not be loaded.</div>;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffb786]">Exposure &amp; safety</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Risk</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">House worst-case exposure, stuck settlements, and account flags.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Bento label="Open Exposure" value={money(data.totalExposure)} icon="warning" tone={data.totalExposure > 0 ? "text-[#ffb786]" : "text-[#e5e2e3]"} note="house worst-case" />
        <Bento label="Stuck Settlements" value={String(data.settlementStuck)} icon="hourglass_top" tone={data.settlementStuck > 0 ? "text-red-400" : "text-[#e5e2e3]"} note="> 24h unsettled" />
        <Bento label="Voids (24h)" value={String(data.voids24h)} icon="undo" tone="text-[#c2c6d6]" note="contracts voided" />
        <Bento label="Flagged Accounts" value={String(data.flags.suspended + data.flags.negativeBalances)} icon="gpp_maybe" tone={data.flags.suspended + data.flags.negativeBalances > 0 ? "text-red-400" : "text-[#e5e2e3]"} note={`${data.flags.suspended} suspended · ${data.flags.negativeBalances} negative`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Exposure by market */}
        <div className="av2-card overflow-hidden rounded-lg lg:col-span-2">
          <div className="flex h-11 items-center border-b border-[#424754]/50 px-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Exposure by market</h3>
          </div>
          <table className="av2-mono w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#27272a] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                <th className="px-4 py-2.5 text-left font-semibold">Market</th>
                <th className="px-4 py-2.5 text-right font-semibold">Open contracts</th>
                <th className="px-4 py-2.5 text-right font-semibold">Open liability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {data.exposure.map((m) => (
                <tr key={m.key} className="hover:bg-[#1c1b1c]">
                  <td className="px-4 py-2.5 text-[#e5e2e3]">{m.label}</td>
                  <td className="px-4 py-2.5 text-right text-[#c2c6d6]">{m.openContracts.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-[#ffb786]">{m.openLiability > 0 ? `${m.exact ? "" : "~"}${money(m.openLiability)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Crypto liability + settlement alerts */}
        <div className="space-y-4">
          <div className="av2-card overflow-hidden rounded-lg">
            <div className="flex h-11 items-center gap-2 border-b border-[#424754]/50 px-4">
              <Icon name="currency_bitcoin" size={14} className="text-[#c2c6d6]" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Crypto liability</h3>
            </div>
            {data.cryptoLiability.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">None</p>
            ) : (
              <div className="divide-y divide-[#27272a]">
                {data.cryptoLiability.map((c) => (
                  <div key={c.crypto} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                    <span className="font-semibold text-[#e5e2e3]">{c.crypto}</span>
                    <span className="av2-mono text-[#ffb786]">{cryptoAmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="av2-card overflow-hidden rounded-lg">
            <div className="flex h-11 items-center gap-2 border-b border-[#424754]/50 px-4">
              <Icon name="warning" size={14} className="text-red-400" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Settlement alerts</h3>
            </div>
            {data.settlement.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-[#8c909f]">All settlements current</p>
            ) : (
              <div className="divide-y divide-[#27272a]">
                {data.settlement.map((s) => (
                  <div key={s.market} className="px-4 py-2.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold capitalize text-[#e5e2e3]">{s.market}</span>
                      <span className="av2-mono text-red-400">{s.stuck}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#8c909f]">{s.note}</p>
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
