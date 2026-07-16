"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

// System-wide crypto ledger, built in the Stitch design language, wired to
// /api/admin/crypto/balances. Shows how much of each coin the platform holds
// on-platform (available + locked), plus the fiat-backed KES Coin total.

interface Coin {
  crypto: string;
  available: number;
  locked: number;
  total: number;
  holders: number;
}
interface Balances {
  coins: Coin[];
  generatedAt: string;
}

const kes = (n: number) => `${CURRENCY_SYMBOL} ${n.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;
const coinFmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 8 });

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

export function AdminV2CryptoBalances() {
  const [data, setData] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/crypto/balances", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>;
  if (!data) return <div className="p-8 text-sm text-red-400">Balances could not be loaded.</div>;

  const coins = data.coins;
  const kesCoin = coins.find((c) => c.crypto === "KES");
  const lockedPositions = coins.reduce((s, c) => s + c.locked, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">Treasury</p>
        <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Crypto balances</h2>
        <p className="mt-1 text-[14px] text-[#c2c6d6]">Crypto held on-platform per coin. Total = available + locked across all users.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Bento label="Distinct coins" value={coins.length.toLocaleString()} icon="toll" />
        <Bento label="Locked positions" value={coinFmt(lockedPositions)} icon="lock" />
        <Bento label="KES Coin total" value={kes(kesCoin?.total ?? 0)} icon="account_balance" />
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        {coins.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#8c909f]">No crypto balances on the system</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="av2-mono w-full min-w-[680px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#27272a] bg-[#161618] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
                  <th className="px-4 py-3 font-semibold">Coin</th>
                  <th className="px-4 py-3 text-right font-semibold">Available</th>
                  <th className="px-4 py-3 text-right font-semibold">Locked</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Holders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {coins.map((c) => (
                  <tr key={c.crypto} className="hover:bg-[#1c1b1c]">
                    <td className="px-4 py-3 font-semibold text-[#e5e2e3]">{c.crypto}</td>
                    <td className="px-4 py-3 text-right text-[#c2c6d6]">{coinFmt(c.available)}</td>
                    <td className="px-4 py-3 text-right text-[#c2c6d6]">{coinFmt(c.locked)}</td>
                    <td className="px-4 py-3 text-right text-[#e5e2e3]">{coinFmt(c.total)}</td>
                    <td className="px-4 py-3 text-right text-[#8c909f]">{c.holders || "—"}</td>
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
