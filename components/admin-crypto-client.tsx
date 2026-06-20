"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface Row {
  address: string;
  crypto: string;
  network: string;
  derivationPath: string;
  onChain: number;
  kesDeposited: number;
  depositCount: number;
  hasDeposited: boolean;
  owner: { id: string; email: string | null; username: string | null };
  createdAt: string;
}

interface Exposure {
  rows: Row[];
  summary: { addresses: number; depositors: number; withFunds: number; totalKesDeposited: number };
}

type Filter = "funds" | "depositors" | "all";

const kes = (n: number) => `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const coin = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
const short = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" />;
}

export function AdminCryptoClient() {
  const [data, setData]       = useState<Exposure | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("funds");
  const [copied, setCopied]   = useState<string | null>(null);

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

  const rows = (data?.rows ?? []).filter((r) =>
    filter === "funds" ? r.onChain > 0 : filter === "depositors" ? r.hasDeposited : true,
  );

  return (
    <div className="admin-page">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Incident response</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Crypto exposure</h1>
        <p className="mt-1 max-w-3xl text-[11px] text-slate-500">
          Live on-chain balances at each user&rsquo;s deposit address (derived from the master seed). Use this to see which
          addresses still hold recoverable crypto and which users deposited. Balances are read live, so this can take a few seconds.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Depositors", value: (data?.summary.depositors ?? 0).toLocaleString(), color: "#087cff", icon: "groups" },
          { label: "Addresses with funds", value: (data?.summary.withFunds ?? 0).toLocaleString(), color: "#f59e0b", icon: "account_balance_wallet" },
          { label: "Deposit addresses", value: (data?.summary.addresses ?? 0).toLocaleString(), color: "#64748b", icon: "qr_code" },
          { label: "Total KES deposited", value: kes(data?.summary.totalKesDeposited ?? 0), color: "#22c55e", icon: "south_america" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-[#121419] p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}1f`, color: s.color }}>
              <Icon name={s.icon} fill className="text-[16px]" />
            </span>
            <p className="mt-2.5 text-xl font-black text-white">{s.value}</p>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] p-1">
          {([["funds", "With funds"], ["depositors", "Depositors"], ["all", "All addresses"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-md px-3 py-2 text-[11px] font-black transition ${filter === v ? "bg-[#087cff] text-white" : "text-slate-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-black text-slate-400 hover:text-white">
          <Icon name="refresh" className="text-[13px]" /> Refresh balances
        </button>
      </div>

      <div className="admin-panel overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Spinner />
            <p className="text-[11px] text-slate-600">Reading live on-chain balances…</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-600">
            {filter === "funds" ? "No deposit addresses currently hold funds." : "No matching addresses."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["User", "Address", "Coin", "On-chain balance", "KES deposited", "Derivation", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.address}-${r.crypto}-${r.network}`} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${r.owner.id}`} className="font-bold text-slate-200 hover:text-blue-400 text-[13px]">
                        {r.owner.username ? `@${r.owner.username}` : r.owner.email ?? "Unnamed"}
                      </Link>
                      {r.owner.email && r.owner.username && <p className="text-[10px] text-slate-600">{r.owner.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => copy(r.address)} className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 transition hover:text-white" title="Copy address">
                        {short(r.address)}
                        <Icon name={copied === r.address ? "check" : "content_copy"} className={`text-[12px] ${copied === r.address ? "text-emerald-400" : "text-slate-600"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-black text-white">{r.crypto}</span>
                      <span className="ml-1 text-[10px] text-slate-600">{r.network}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.onChain > 0 ? (
                        <span className="font-mono text-[13px] font-black text-amber-300">{coin(r.onChain)} {r.crypto}</span>
                      ) : (
                        <span className="text-[12px] text-slate-700">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.kesDeposited > 0 ? (
                        <span className="text-[12px] font-bold text-emerald-400">{kes(r.kesDeposited)} <span className="text-[10px] text-slate-600">· {r.depositCount}×</span></span>
                      ) : (
                        <span className="text-[12px] text-slate-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className="font-mono text-[10px] text-slate-600">{r.derivationPath}</span></td>
                    <td className="px-4 py-3 text-right">
                      {r.onChain > 0 && <span className="rounded-md bg-amber-500/12 px-2 py-1 text-[9px] font-black text-amber-400">RECOVERABLE</span>}
                    </td>
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
