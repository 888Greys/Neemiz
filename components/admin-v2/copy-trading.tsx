"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";

type LeaderRow = {
  id: string;
  userId: string;
  username: string | null;
  email: string | null;
  isAdmin: boolean;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  isPublic: boolean;
  followers: number;
  signals: number;
  allowedFamilies: string;
  updatedAt: string;
};

type Payload = {
  enabled: boolean;
  last24h: {
    signals: number;
    copied: number;
    skipped: number;
    failed: number;
    copiedStakeKes: number;
    copiedFills: number;
  };
  leaders: LeaderRow[];
};

function kes(n: number) {
  return `KSh ${Math.round(n).toLocaleString("en-KE")}`;
}

export function AdminV2CopyTrading() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/copy-trading", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Failed to load");
        setData(null);
      } else {
        setData(json as Payload);
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function patch(body: { enabled?: boolean; leaderProfileId?: string; status?: "ACTIVE" | "SUSPENDED" | "PENDING" }) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/copy-trading", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || "Update failed");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-sm text-red-400">{err || "Copy trading data could not be loaded."}</div>;
  }

  const h = data.last24h;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffb786]">Binary</p>
          <h2 className="mt-1 text-[32px] font-semibold tracking-[-0.02em] text-[#e5e2e3]">Copy trading</h2>
          <p className="mt-1 text-[14px] text-[#c2c6d6]">
            Leader opt-in mirrors for Even/Odd and Rise/Fall. Suspend leaders or kill the feature flag.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ enabled: !data.enabled })}
          className={`rounded-lg px-4 py-2 text-[12px] font-bold ${
            data.enabled
              ? "bg-emerald-700/40 text-emerald-200 ring-1 ring-emerald-500/40"
              : "bg-rose-700/40 text-rose-200 ring-1 ring-rose-500/40"
          }`}
        >
          {data.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
        </button>
      </div>

      {err && <p className="mb-4 text-sm text-red-400">{err}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Signals (24h)", value: String(h.signals), note: "leader places enqueued", icon: "campaign" },
          { label: "Copied fills", value: String(h.copied), note: `${h.skipped} skipped · ${h.failed} failed`, icon: "content_copy" },
          { label: "Copy volume", value: kes(h.copiedStakeKes), note: `${h.copiedFills} fills`, icon: "payments" },
          { label: "Leaders", value: String(data.leaders.length), note: "profiles loaded", icon: "groups" },
        ].map((card) => (
          <div key={card.label} className="av2-card relative flex h-32 flex-col justify-between overflow-hidden rounded-lg p-4">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">{card.label}</span>
              <Icon name={card.icon} size={20} className="text-[#adc6ff]" />
            </div>
            <div>
              <span className="av2-mono text-[28px] font-semibold text-[#e5e2e3]">{card.value}</span>
              <div className="mt-1 text-[13px] text-[#c2c6d6]">{card.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex h-11 items-center border-b border-[#424754]/50 px-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#c2c6d6]">Leaders</h3>
        </div>
        <table className="av2-mono w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#27272a] text-[11px] uppercase tracking-wider text-[#c2c6d6]">
              <th className="px-4 py-2.5 text-left font-semibold">Leader</th>
              <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th className="px-4 py-2.5 text-right font-semibold">Followers</th>
              <th className="px-4 py-2.5 text-right font-semibold">Signals</th>
              <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.leaders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#8c909f]">No leader profiles yet.</td>
              </tr>
            )}
            {data.leaders.map((L) => (
              <tr key={L.id} className="border-b border-[#27272a]/80 text-[#e5e2e3]">
                <td className="px-4 py-3">
                  <div className="font-semibold">@{L.username || "trader"}</div>
                  <div className="text-[11px] text-[#8c909f]">{L.email}{L.isAdmin ? " · admin" : ""}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={
                    L.status === "ACTIVE" ? "text-emerald-300"
                      : L.status === "SUSPENDED" ? "text-rose-300"
                        : "text-amber-300"
                  }>
                    {L.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{L.followers}</td>
                <td className="px-4 py-3 text-right">{L.signals}</td>
                <td className="px-4 py-3 text-right">
                  {L.status === "SUSPENDED" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch({ leaderProfileId: L.id, status: "ACTIVE" })}
                      className="rounded px-2 py-1 text-[11px] font-bold text-emerald-200 ring-1 ring-emerald-500/30"
                    >
                      Reinstate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch({ leaderProfileId: L.id, status: "SUSPENDED" })}
                      className="rounded px-2 py-1 text-[11px] font-bold text-rose-200 ring-1 ring-rose-500/30"
                    >
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
