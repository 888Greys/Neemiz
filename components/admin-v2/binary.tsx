"use client";

import { useCallback, useEffect, useState } from "react";

type Period = "today" | "yesterday";

type Summary = {
  users: number;
  depositsToday: { count: number; amount: number };
  withdrawalsToday: { count: number; amount: number };
  pendingDeposits: number;
  failedDepositsToday: number;
  tradesToday: { count: number; staked: number };
  winsToday: { count: number; paidOut: number };
  ggrToday: number;
  netCashToday: number;
};

type DepositRow = {
  id: string;
  user: string;
  email: string;
  amount: number;
  status: string;
  reference: string | null;
  at: string;
};

type TradeRow = {
  id: string;
  user: string;
  email: string;
  stake: number;
  payout: number | null;
  status: string;
  market: string;
  side: string;
  at: string;
};

type Payload = {
  configured: boolean;
  period?: string;
  asOf?: string;
  dayStartEAT?: string;
  summary?: Summary;
  recentDeposits?: DepositRow[];
  recentTrades?: TradeRow[];
  error?: string;
};

function kes(n: number) {
  return `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED" || s === "WON") return "text-emerald-300";
  if (s === "PENDING") return "text-amber-300";
  if (s === "FAILED" || s === "LOST") return "text-rose-300";
  if (s === "VOID") return "text-[#8c909f]";
  return "text-[#c2c6d6]";
}

export function AdminV2Binary() {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/binary?period=${period}`, { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok) {
        setErr(json.error || "Failed to load");
      } else {
        setData(json);
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">
            Nezeem binary
          </p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">
            Binary options
          </h2>
          <p className="mt-1 text-[13px] text-[#8c909f]">
            Nezeem.com digit contracts — real-time money and trade metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-[#424754] bg-[#2a292a] overflow-hidden">
            {(["today", "yesterday"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[12px] font-semibold transition ${
                  period === p
                    ? "bg-[#3a4a5f]/60 text-[#e5e2e3]"
                    : "text-[#8c909f] hover:text-[#c2c6d6]"
                }`}
              >
                {p === "today" ? "Today" : "Yesterday"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-[#424754] bg-[#2a292a] px-3 py-1.5 text-[12px] font-semibold text-[#c2c6d6] hover:bg-[#353436]"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[18px] font-semibold text-[#e5e2e3]">Nezeem Binary</h3>
        {data?.period ? (
          <span className="rounded bg-[#3a4a5f]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#adc6ff]">
            {data.period === "yesterday" ? "Yesterday" : "Today"}
          </span>
        ) : null}
      </div>

      {err ? (
        <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          {err}
        </div>
      ) : null}

      {!s && !loading ? (
        <p className="text-[13px] text-[#8c909f]">No metrics yet.</p>
      ) : null}

      {s ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Users", value: String(s.users) },
              { label: "Deposits", value: `${kes(s.depositsToday.amount)} (${s.depositsToday.count})` },
              { label: "Net cash", value: kes(s.netCashToday) },
              { label: "GGR", value: kes(s.ggrToday) },
              { label: "Staked", value: `${kes(s.tradesToday.staked)} (${s.tradesToday.count})` },
              { label: "Paid wins", value: `${kes(s.winsToday.paidOut)} (${s.winsToday.count})` },
              { label: "Pending deposits", value: String(s.pendingDeposits) },
              { label: "Failed deposits", value: String(s.failedDepositsToday) },
            ].map((card) => (
              <div key={card.label} className="rounded border border-[#424754] bg-[#2a292a] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c909f]">{card.label}</p>
                <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#e5e2e3]">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#e5e2e3]">
                Deposits {data?.period === "yesterday" ? "(yesterday)" : "(today)"}
              </h3>
              <div className="overflow-x-auto rounded border border-[#424754]">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[#201f20] text-[#8c909f]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">User</th>
                      <th className="px-3 py-2 font-semibold">Amount</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentDeposits ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-[#8c909f]">No deposits for this period</td>
                      </tr>
                    ) : (
                      (data?.recentDeposits ?? []).map((row) => (
                        <tr key={row.id} className="border-t border-[#353436]">
                          <td className="px-3 py-2 text-[#c2c6d6]">
                            <div className="font-medium text-[#e5e2e3]">{row.user}</div>
                            <div className="text-[11px] text-[#8c909f]">{row.email}</div>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-[#e5e2e3]">{kes(row.amount)}</td>
                          <td className={`px-3 py-2 font-semibold ${statusTone(row.status)}`}>{row.status}</td>
                          <td className="px-3 py-2 text-[#8c909f]">{new Date(row.at).toLocaleString("en-KE")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#e5e2e3]">
                Trades {data?.period === "yesterday" ? "(yesterday)" : "(today)"}
              </h3>
              <div className="overflow-x-auto rounded border border-[#424754]">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[#201f20] text-[#8c909f]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">User</th>
                      <th className="px-3 py-2 font-semibold">Contract</th>
                      <th className="px-3 py-2 font-semibold">Stake</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentTrades ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-[#8c909f]">No trades for this period</td>
                      </tr>
                    ) : (
                      (data?.recentTrades ?? []).map((row) => (
                        <tr key={row.id} className="border-t border-[#353436]">
                          <td className="px-3 py-2 text-[#c2c6d6]">
                            <div className="font-medium text-[#e5e2e3]">{row.user}</div>
                          </td>
                          <td className="px-3 py-2 text-[#c2c6d6]">{row.market} · {row.side}</td>
                          <td className="px-3 py-2 tabular-nums text-[#e5e2e3]">{kes(row.stake)}</td>
                          <td className={`px-3 py-2 font-semibold ${statusTone(row.status)}`}>{row.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {data?.asOf ? (
            <p className="mt-4 text-[11px] text-[#8c909f]">
              {data.period === "yesterday" ? "Yesterday" : "Today"} EAT window from{" "}
              {new Date(data.dayStartEAT!).toLocaleString("en-KE")} · refreshed{" "}
              {new Date(data.asOf).toLocaleString("en-KE")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}