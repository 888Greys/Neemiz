"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { Icon } from "@/components/icon";

type Promo = {
  id: string;
  code: string;
  amountKes: number;
  redemptionCount: number;
  maxRedemptions: number | null;
  isActive: boolean;
  description: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  totalPaidKes: number;
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

type Totals = {
  codes: number;
  active: number;
  redemptions: number;
  paidKes: number;
};

const money = (v: number) =>
  `${CURRENCY_SYMBOL} ${Number(v).toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 0 })}`;

function KpiTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="av2-card flex flex-col justify-between rounded-lg p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8c909f]">{label}</p>
      <p className={`mt-2 av2-mono text-[22px] font-bold ${tone ?? "text-[#e5e2e3]"}`}>{value}</p>
    </div>
  );
}

export function AdminV2Promos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [totals, setTotals] = useState<Totals>({ codes: 0, active: 0, redemptions: 0, paidKes: 0 });
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [amountKes, setAmountKes] = useState("50");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (codeFilter?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = codeFilter ? `?code=${encodeURIComponent(codeFilter)}` : "";
      const res = await fetch(`/api/admin/promo${qs}`);
      if (!res.ok) throw new Error("Failed to load promos");
      const data = await res.json();
      setPromos(data.promos ?? []);
      setRedemptions(data.redemptions ?? []);
      if (data.totals) setTotals(data.totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createPromo() {
    setFormError("");
    const amt = Number(amountKes);
    if (!code.trim() || code.trim().length < 3) {
      setFormError("Code must be at least 3 characters");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          amountKes: amt,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          description: description.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Could not create promo");
        return;
      }
      setCode("");
      setAmountKes("50");
      setMaxRedemptions("");
      setExpiresAt("");
      setDescription("");
      await load(filter || undefined);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promo) {
    setActing(p.id);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
      });
      if (res.ok) {
        setPromos((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x)),
        );
        setTotals((t) => ({
          ...t,
          active: t.active + (p.isActive ? -1 : 1),
        }));
      }
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Codes" value={String(totals.codes)} />
        <KpiTile label="Active" value={String(totals.active)} tone="text-emerald-400" />
        <KpiTile label="Redemptions" value={totals.redemptions.toLocaleString()} />
        <KpiTile label="Total paid out" value={money(totals.paidKes)} tone="text-[#adc6ff]" />
      </div>

      <div className="av2-card rounded-lg p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-[#e5e2e3]">Create promo code</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8c909f]">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME50"
              className="h-10 w-full rounded-md bg-white/[0.04] px-3 av2-mono text-[13px] font-bold text-[#e5e2e3] outline-none ring-1 ring-[#424754] focus:ring-[#adc6ff]/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8c909f]">Amount (KES)</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={amountKes}
              onChange={(e) => setAmountKes(e.target.value)}
              className="h-10 w-full rounded-md bg-white/[0.04] px-3 av2-mono text-[13px] text-[#e5e2e3] outline-none ring-1 ring-[#424754] focus:ring-[#adc6ff]/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8c909f]">Max uses</span>
            <input
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
              className="h-10 w-full rounded-md bg-white/[0.04] px-3 text-[13px] text-[#e5e2e3] outline-none ring-1 ring-[#424754] focus:ring-[#adc6ff]/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8c909f]">Expires</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-10 w-full rounded-md bg-white/[0.04] px-3 text-[12px] text-[#e5e2e3] outline-none ring-1 ring-[#424754] focus:ring-[#adc6ff]/50"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8c909f]">Note</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="h-10 w-full rounded-md bg-white/[0.04] px-3 text-[13px] text-[#e5e2e3] outline-none ring-1 ring-[#424754] focus:ring-[#adc6ff]/50"
            />
          </label>
        </div>
        {formError && <p className="mt-2 text-[12px] font-semibold text-red-400">{formError}</p>}
        <button
          type="button"
          onClick={() => void createPromo()}
          disabled={saving}
          className="mt-4 h-10 rounded-md bg-[#adc6ff] px-4 text-[12px] font-bold text-[#0a0e17] transition hover:bg-[#c2d4ff] disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create code"}
        </button>
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#424754]/50 px-4 py-3">
          <h3 className="text-[13px] font-semibold text-[#e5e2e3]">All promo codes</h3>
          <button
            type="button"
            onClick={() => void load(filter || undefined)}
            className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[#c2c6d6] hover:bg-white/[0.06]"
            aria-label="Refresh"
          >
            <Icon name="refresh" className="text-[16px]" />
          </button>
        </div>
        {loading && promos.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-[#8c909f]">Loading…</p>
        ) : error ? (
          <p className="px-4 py-10 text-center text-[12px] text-red-400">{error}</p>
        ) : promos.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-[#8c909f]">No promo codes yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-[#27272a] text-[10px] uppercase tracking-wider text-[#8c909f]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Code</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Credit</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Redeemed</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Paid out</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Expires</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {promos.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-white/[0.02] ${filter === p.code ? "bg-[#adc6ff]/5" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setFilter(p.code);
                          void load(p.code);
                        }}
                        className="text-left"
                      >
                        <span className="av2-mono block font-bold text-[#adc6ff]">{p.code}</span>
                        {p.description && (
                          <span className="mt-0.5 block max-w-[160px] truncate text-[10px] text-[#8c909f]">
                            {p.description}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="av2-mono px-4 py-2.5 text-right text-[#e5e2e3]">{money(p.amountKes)}</td>
                    <td className="av2-mono px-4 py-2.5 text-right text-[#c2c6d6]">
                      {p.redemptionCount}
                      {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ""}
                    </td>
                    <td className="av2-mono px-4 py-2.5 text-right text-emerald-400">{money(p.totalPaidKes)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold uppercase ${p.isActive ? "text-emerald-400" : "text-slate-500"}`}>
                        {p.isActive ? "Active" : "Off"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#8c909f]">
                      {p.expiresAt
                        ? new Date(p.expiresAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFilter(p.code);
                            void load(p.code);
                          }}
                          className="rounded px-2 py-1 text-[10px] font-bold text-[#c2c6d6] hover:bg-white/[0.06]"
                        >
                          Users
                        </button>
                        <button
                          type="button"
                          disabled={acting === p.id}
                          onClick={() => void toggleActive(p)}
                          className={`rounded px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-50 ${
                            p.isActive
                              ? "bg-[#ffb786]/10 text-[#ffb786] hover:bg-[#ffb786]/20"
                              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          }`}
                        >
                          {acting === p.id ? "…" : p.isActive ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="av2-card overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#424754]/50 px-4 py-3">
          <h3 className="text-[13px] font-semibold text-[#e5e2e3]">
            {filter ? `Players who used ${filter}` : "Recent redemptions"}
          </h3>
          <div className="ml-auto flex items-center gap-2">
            {filter && (
              <button
                type="button"
                onClick={() => { setFilter(""); void load(); }}
                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-[#c2c6d6]"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-10 text-center text-[12px] text-[#8c909f]">Loading…</p>
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
