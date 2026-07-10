"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// Crypto treasury/exposure, built in the Stitch design language, wired to
// /api/admin/crypto/exposure.

interface Row {
  address: string; crypto: string; network: string; derivationPath: string;
  onChain: number; kesDeposited: number; depositCount: number; hasDeposited: boolean;
  owner: { id: string; email: string | null; username: string | null }; createdAt: string;
}
interface Exposure {
  rows: Row[];
  summary: { addresses: number; depositors: number; withFunds: number; totalKesDeposited: number };
}
type Filter = "funds" | "depositors" | "all";

const kes = (n: number) => `${CURRENCY_SYMBOL} ${n.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;
const coin = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
const short = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

function Bento({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="av2-card relative flex h-32 flex-col justify-between overflow-hidden rounded-lg p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{label}</span>
        <Icon name={icon} size={20} className="text-[#adc6ff]" />
      </div>
      <span className="av2-mono text-[32px] font-semibold text-[#e5e2e3]">{value}</span>
    </div>
  );
}

export function AdminV2Crypto() {
  const [data, setData] = useState<Exposure | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("funds");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/crypto/exposure", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function copy(addr: string) {
    navigator.clipboard?.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied((c) => (c === addr ? null : c)), 1500);
    }).catch(() => {});
  }

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Crypto data could not be loaded.</div>;

  const rows = data.rows.filter((r) => (filter === "funds" ? r.onChain > 0 : filter === "depositors" ? r.hasDeposited : true));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Treasury</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Crypto</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">On-chain deposit exposure across every derived address.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bento label="Addresses" value={data.summary.addresses.toLocaleString()} icon="account_balance_wallet" />
        <Bento label="Depositors" value={data.summary.depositors.toLocaleString()} icon="groups" />
        <Bento label="With Funds" value={data.summary.withFunds.toLocaleString()} icon="paid" />
        <Bento label="Total Deposited" value={kes(data.summary.totalKesDeposited)} icon="south_america" />
      </div>

      <div className="mb-4 flex gap-1.5">
        {(["funds", "depositors", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-2 text-[12px] font-semibold capitalize transition ${filter === f ? "bg-[#3a4a5f] text-[#adc6ff]" : "bg-[#161618] text-[#c2c6d6] hover:text-[#e5e2e3]"}`}
          >
            {f === "funds" ? "With funds" : f}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-[#8c909f]">{rows.length} address{rows.length !== 1 ? "es" : ""}</span>
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8c909f]">No addresses match this filter</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="av2-mono w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                  <th className="px-4 py-3 font-semibold">Address</th>
                  <th className="px-4 py-3 font-semibold">Asset</th>
                  <th className="px-4 py-3 text-right font-semibold">On-chain</th>
                  <th className="px-4 py-3 text-right font-semibold">KES deposited</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {rows.map((r) => (
                  <tr key={r.address} className="hover:bg-[#1c1b1c]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#e5e2e3]">{short(r.address)}</span>
                        <button onClick={() => copy(r.address)} title="Copy address" className="text-[#8c909f] transition-colors hover:text-[#adc6ff]">
                          <Icon name={copied === r.address ? "check" : "content_copy"} size={13} className={copied === r.address ? "text-emerald-400" : ""} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#c2c6d6]">{r.crypto} <span className="text-[#8c909f]">{r.network}</span></td>
                    <td className="px-4 py-3 text-right text-[#e5e2e3]">{r.onChain > 0 ? coin(r.onChain) : "—"}</td>
                    <td className="px-4 py-3 text-right text-[#c2c6d6]">{r.kesDeposited > 0 ? kes(r.kesDeposited) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-[#e5e2e3]">{r.owner.username ?? "—"}</div>
                      <div className="text-[11px] text-[#8c909f]">{r.owner.email ?? ""}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[#ffb786]/15 bg-[#ffb786]/[0.05] px-5 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#ffb786]"><Icon name="shield" size={14} /> Security-controlled register</p>
          <p className="mt-1 text-[11px] text-[#8c909f]">Investigation only. Signing keys remain outside the application and admin console.</p>
        </div>
      </div>
    </div>
  );
}
