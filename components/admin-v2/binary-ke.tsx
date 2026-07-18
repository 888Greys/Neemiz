"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SISTER_BINARY_BRANDS,
  sisterBinarySiteUrl,
  type SisterBinaryBrand,
} from "@/lib/sister-binary-brands";

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
  brand?: string;
  siteUrl?: string;
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

export function AdminV2BinaryKe() {
  const [selectedId, setSelectedId] = useState(SISTER_BINARY_BRANDS[0]!.id);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const selected = SISTER_BINARY_BRANDS.find((b) => b.id === selectedId) ?? SISTER_BINARY_BRANDS[0]!;
  const siteUrl = sisterBinarySiteUrl(selected);

  const load = useCallback(async () => {
    // Metrics API is wired for BinaryOptionsKE today; other slots are labels until live.
    if (selected.status !== "live" || selected.id !== "binaryoptionske") {
      setData(null);
      setErr("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/binary-ke", { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok && !json.configured) {
        setData(json);
        setErr(json.error || "Unavailable");
      } else if (!res.ok) {
        setErr(json.error || "Failed to load");
      } else {
        setData(json);
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [selected.id, selected.status]);

  useEffect(() => {
    void load();
    if (selected.status !== "live") return;
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load, selected.status]);

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#adc6ff]">
            Sister binary sites
          </p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">
            Binary brands
          </h2>
          <p className="mt-1 text-[13px] text-[#8c909f]">
            Four binary-only sites — pick one to view today’s money and trades
          </p>
        </div>
        {selected.status === "live" ? (
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-[#424754] bg-[#2a292a] px-3 py-1.5 text-[12px] font-semibold text-[#c2c6d6] hover:bg-[#353436]"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SISTER_BINARY_BRANDS.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            active={brand.id === selected.id}
            onSelect={() => setSelectedId(brand.id)}
          />
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[18px] font-semibold text-[#e5e2e3]">{selected.name}</h3>
        {siteUrl ? (
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-[#adc6ff] underline-offset-2 hover:underline"
          >
            {selected.domain}
          </a>
        ) : (
          <span className="text-[13px] text-[#8c909f]">Domain not set yet</span>
        )}
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            selected.status === "live"
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-white/5 text-[#8c909f]"
          }`}
        >
          {selected.status === "live" ? "Live" : "Planned"}
        </span>
      </div>

      {selected.status !== "live" ? (
        <p className="rounded border border-[#424754] bg-[#2a292a] px-4 py-3 text-[13px] text-[#8c909f]">
          This slot is reserved for the next binary-only domain. Metrics will show here once it is live.
        </p>
      ) : null}

      {err ? (
        <div className="mb-4 rounded border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          {err}
        </div>
      ) : null}

      {!s && !loading && selected.status === "live" ? (
        <p className="text-[13px] text-[#8c909f]">No metrics yet for this site.</p>
      ) : null}

      {s ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Users", value: String(s.users) },
              { label: "Deposits today", value: `${kes(s.depositsToday.amount)} (${s.depositsToday.count})` },
              { label: "Net cash today", value: kes(s.netCashToday) },
              { label: "Binary GGR today", value: kes(s.ggrToday) },
              { label: "Staked today", value: `${kes(s.tradesToday.staked)} (${s.tradesToday.count})` },
              { label: "Paid wins today", value: `${kes(s.winsToday.paidOut)} (${s.winsToday.count})` },
              { label: "Pending deposits", value: String(s.pendingDeposits) },
              { label: "Failed deposits today", value: String(s.failedDepositsToday) },
            ].map((card) => (
              <div key={card.label} className="rounded border border-[#424754] bg-[#2a292a] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c909f]">{card.label}</p>
                <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#e5e2e3]">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-[#e5e2e3]">Deposits today</h3>
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
                        <td colSpan={4} className="px-3 py-4 text-[#8c909f]">No deposits yet today</td>
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
              <h3 className="mb-2 text-[14px] font-semibold text-[#e5e2e3]">Trades today</h3>
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
                        <td colSpan={4} className="px-3 py-4 text-[#8c909f]">No trades yet today</td>
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
              Day window EAT from {new Date(data.dayStartEAT!).toLocaleString("en-KE")} · refreshed{" "}
              {new Date(data.asOf).toLocaleString("en-KE")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function BrandCard({
  brand,
  active,
  onSelect,
}: {
  brand: SisterBinaryBrand;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded border px-3 py-3 text-left transition ${
        active
          ? "border-[#adc6ff]/50 bg-[#3a4a5f]/40"
          : "border-[#424754] bg-[#2a292a] hover:border-[#5a5d66]"
      }`}
    >
      <p className="truncate text-[13px] font-semibold text-[#e5e2e3]">{brand.name}</p>
      <p className="mt-0.5 truncate text-[11px] text-[#8c909f]">
        {brand.domain ?? "Domain TBD"}
      </p>
      <p
        className={`mt-2 text-[10px] font-bold uppercase tracking-wide ${
          brand.status === "live" ? "text-emerald-300" : "text-[#8c909f]"
        }`}
      >
        {brand.status === "live" ? "Live" : "Planned"}
      </p>
    </button>
  );
}
