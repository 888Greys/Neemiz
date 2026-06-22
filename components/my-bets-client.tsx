"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCached, cachedFetch } from "@/lib/client-cache";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";

type Selection = {
  matchName: string;
  market: string;
  label: string;
  odds: number;
  result: string;
  kickoff: string | null;
};

// Format a kickoff time in East Africa Time (Nairobi) regardless of the user's
// device timezone, e.g. "Thu 12 Jun, 5:00 AM".
function formatKickoffEAT(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(MONEY_LOCALE, {
    timeZone: "Africa/Nairobi",
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

type Bet = {
  id: string;
  type: string;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  winAmount: number | null;
  status: string;
  createdAt: string;
  selections: Selection[];
};

const STATUS_FILTERS = ["ALL", "PENDING", "WON", "LOST"] as const;
type Filter = (typeof STATUS_FILTERS)[number];

function statusColors(s: string) {
  if (s === "WON") return { badge: "bg-emerald-500/15 text-emerald-400", text: "text-emerald-400" };
  if (s === "LOST") return { badge: "bg-red-500/15 text-red-400", text: "text-red-400" };
  if (s === "VOID") return { badge: "bg-white/[0.07] text-slate-400", text: "text-slate-400" };
  return { badge: "bg-emerald-500/15 text-emerald-400", text: "text-emerald-400" };
}

function fmt(n: number) {
  return `${CURRENCY_SYMBOL} ${n.toLocaleString(MONEY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BetCard({ bet }: { bet: Bet }) {
  const [open, setOpen] = useState(false);
  const c = statusColors(bet.status);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12141c]">
      {/* Top row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
      >
        {/* Pulsing dot for pending */}
        {bet.status === "PENDING" ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
        ) : (
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${bet.status === "WON" ? "bg-emerald-400" : bet.status === "LOST" ? "bg-red-400" : "bg-slate-500"}`} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${c.badge}`}>
              {bet.status}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-600">{bet.type}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-black text-white">
            {bet.selections[0]?.matchName}
            {bet.selections.length > 1 && <span className="ml-1 text-slate-500">+{bet.selections.length - 1} more</span>}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] text-slate-500">{new Date(bet.createdAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short" })}</p>
          <p className="text-[12px] font-black text-white tabular-nums">{fmt(bet.stake)}</p>
        </div>

        <Icon
          name={open ? "expand_less" : "expand_more"}
          className="shrink-0 text-[20px] text-slate-600"
        />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
          {bet.selections.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-slate-500">{s.matchName}</p>
                <p className="text-[13px] font-black text-white">{s.label}</p>
                <p className="text-[11px] text-slate-500">{s.market}</p>
                {formatKickoffEAT(s.kickoff) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                    <Icon name="schedule" className="h-3 w-3" />
                    {formatKickoffEAT(s.kickoff)}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="rounded-lg bg-[#087cff]/15 px-2 py-0.5 text-[12px] font-black text-[#75b8ff]">
                  {s.odds.toFixed(2)}
                </span>
                {s.result !== "PENDING" && (
                  <p className={`mt-1 text-[10px] font-black uppercase ${statusColors(s.result).text}`}>{s.result}</p>
                )}
              </div>
            </div>
          ))}

          {/* Summary row */}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5">
            <div className="text-[11px]">
              <span className="text-slate-500">Odds </span>
              <span className="font-black text-white">{bet.totalOdds.toFixed(2)}</span>
              <span className="mx-2 text-slate-700">·</span>
              <span className="text-slate-500">Stake </span>
              <span className="font-black text-white">{fmt(bet.stake)}</span>
            </div>
            <div className="text-right text-[11px]">
              {bet.status === "WON" && bet.winAmount ? (
                <span className="font-black text-emerald-400">+{fmt(bet.winAmount)}</span>
              ) : bet.status === "LOST" ? (
                <span className="font-black text-red-400">-{fmt(bet.stake)}</span>
              ) : (
                <span className="text-slate-500">To win <span className="font-black text-amber-400">{fmt(bet.potentialWin)}</span></span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MyBetsClient() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");

  const BETS_KEY = "/api/bets/mine?limit=50";
  const [bets, setBets]       = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBets = useCallback(async (force = false) => {
    if (!isSignedIn) return;
    const data = await cachedFetch<Bet[]>(BETS_KEY, force);
    if (data) setBets(data);
    setLoading(false);
  }, [isSignedIn]);

  // Seed from the client cache after mount (not during render) to avoid a
  // server/client hydration mismatch from sessionStorage-backed data.
  useEffect(() => {
    const cached = getCached<Bet[]>(BETS_KEY);
    if (cached?.length) { setBets(cached); setLoading(false); }
    fetchBets();
  }, [fetchBets]);

  // Auto-refresh every 30 s while any bet is still PENDING
  const hasPending = bets.some((b) => b.status === "PENDING");
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => fetchBets(true), 30_000);
    return () => clearInterval(id);
  }, [hasPending, fetchBets]);

  const filtered = filter === "ALL" ? bets : bets.filter((b) => b.status === filter);

  const stats = {
    total: bets.length,
    pending: bets.filter((b) => b.status === "PENDING").length,
    won: bets.filter((b) => b.status === "WON").length,
    lost: bets.filter((b) => b.status === "LOST").length,
    totalStaked: bets.reduce((s, b) => s + b.stake, 0),
    totalWon: bets.filter((b) => b.status === "WON").reduce((s, b) => s + (b.winAmount ?? 0), 0),
  };

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Icon name="lock" fill className="text-[48px] text-slate-600" />
        <p className="text-lg font-black text-white">Sign in to see your bets</p>
        <button
          type="button"
          onClick={openLogin}
          className="rounded-2xl bg-[#087cff] px-8 py-3 text-sm font-black text-white"
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 transition hover:bg-white/[0.10] hover:text-white"
        >
          <Icon name="arrow_back" className="text-[18px]" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white">My Bets</h1>
          <p className="mt-0.5 text-sm text-slate-500">{stats.total} bets placed</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Running", value: stats.pending, color: "text-emerald-400" },
          { label: "Won", value: stats.won, color: "text-emerald-400" },
          { label: "Lost", value: stats.lost, color: "text-red-400" },
          { label: "Total staked", value: `${CURRENCY_SYMBOL} ${stats.totalStaked.toLocaleString()}`, color: "text-white", small: true },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.06]">
            <p className="text-[11px] font-bold text-slate-500">{s.label}</p>
            <p className={`mt-0.5 ${s.small ? "text-base" : "text-2xl"} font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1.5 rounded-2xl bg-white/[0.04] p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-xl py-2 text-[11px] font-black transition ${
              filter === f ? "bg-[#087cff] text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-white"
            }`}
          >
            {f === "ALL" ? `All (${stats.total})` : f === "PENDING" ? `Running (${stats.pending})` : f === "WON" ? `Won (${stats.won})` : `Lost (${stats.lost})`}
          </button>
        ))}
      </div>

      {/* Bet list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#087cff]/20 border-t-[#087cff]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Icon name="receipt_long" className="mb-3 text-[40px] text-slate-700" />
          <p className="font-black text-slate-500">No {filter !== "ALL" ? filter.toLowerCase() : ""} bets yet</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bet) => <BetCard key={bet.id} bet={bet} />)}
        </div>
      )}
    </div>
  );
}
