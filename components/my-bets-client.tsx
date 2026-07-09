"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCached, cachedFetch } from "@/lib/client-cache";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { Icon } from "@/components/icon";
import { MONEY_LOCALE } from "@/lib/currency";
import { useMoney } from "@/lib/currency-context";

type Selection = {
  matchName: string;
  market: string;
  label: string;
  odds: number;
  result: string;
  kickoff: string | null;
};

function formatKickoffEAT(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(MONEY_LOCALE, {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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

function statusTone(s: string) {
  if (s === "WON") return "text-emerald-400";
  if (s === "LOST") return "text-red-400";
  if (s === "VOID") return "text-slate-400";
  if (s === "CASHED_OUT") return "text-[#75b8ff]";
  return "text-amber-400";
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    WON: "bg-emerald-500/15 text-emerald-400",
    LOST: "bg-red-500/15 text-red-400",
    VOID: "bg-white/[0.06] text-slate-400",
    PENDING: "bg-amber-500/15 text-amber-400",
    CASHED_OUT: "bg-[#087cff]/15 text-[#75b8ff]",
  };
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${map[status] ?? map.PENDING}`}>
      {status === "PENDING" ? "Running" : status.replace("_", " ")}
    </span>
  );
}

function BetTicket({ bet }: { bet: Bet }) {
  const [open, setOpen] = useState(false);
  const { format: fmt } = useMoney();
  const shown = open ? bet.selections : bet.selections.slice(0, 2);
  const hidden = bet.selections.length - shown.length;

  return (
    <article className="border-b border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-3 py-3 text-left transition active:bg-white/[0.02] sm:px-4"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {bet.status === "PENDING" && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
            )}
            <StatusPill status={bet.status} />
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-600">{bet.type}</span>
            {bet.selections.length > 1 && (
              <span className="text-[9px] font-black text-slate-500">{bet.selections.length} legs</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-slate-600">
              {new Date(bet.createdAt).toLocaleString(MONEY_LOCALE, {
                timeZone: "Africa/Nairobi",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <Icon
              name="expand_more"
              className={`h-4 w-4 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          {shown.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-slate-500">{s.matchName}</p>
                <p className="truncate text-[13px] font-black text-white">
                  {s.label}
                  <span className="ml-1.5 text-[10px] font-bold text-slate-500">{s.market}</span>
                </p>
                {formatKickoffEAT(s.kickoff) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                    <Icon name="schedule" className="h-3 w-3" />
                    {formatKickoffEAT(s.kickoff)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="rounded-lg bg-[#1c2433] px-2 py-1 text-[12px] font-black tabular-nums text-white">
                  {s.odds.toFixed(2)}
                </span>
                {s.result !== "PENDING" && (
                  <span className={`text-[9px] font-black uppercase ${statusTone(s.result)}`}>{s.result}</span>
                )}
              </div>
            </div>
          ))}
          {hidden > 0 && (
            <p className="text-[11px] font-bold text-[#75b8ff]">+{hidden} more · tap to expand</p>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[11px]">
          <span className="text-slate-500">
            Stake <span className="font-black tabular-nums text-white">{fmt(bet.stake)}</span>
            <span className="mx-1.5 text-slate-700">·</span>
            @{bet.totalOdds.toFixed(2)}
          </span>
          {bet.status === "WON" && bet.winAmount ? (
            <span className="font-black tabular-nums text-emerald-400">+{fmt(bet.winAmount)}</span>
          ) : bet.status === "LOST" ? (
            <span className="font-black tabular-nums text-red-400">-{fmt(bet.stake)}</span>
          ) : (
            <span className="text-slate-500">
              To win <span className="font-black tabular-nums text-white">{fmt(bet.potentialWin)}</span>
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.04] bg-[#0a0b0e] px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>
              Bet ID <span className="font-mono text-slate-400">#{bet.id.slice(-8).toUpperCase()}</span>
            </span>
            <span>
              {new Date(bet.createdAt).toLocaleString(MONEY_LOCALE, {
                timeZone: "Africa/Nairobi",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export function MyBetsClient() {
  const { isSignedIn } = useSupabaseAuth();
  const { openLogin } = useAuthModal();
  const router = useRouter();
  const { format: fmt } = useMoney();
  const [filter, setFilter] = useState<Filter>("ALL");

  const BETS_KEY = "/api/bets/mine?limit=50";
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBets = useCallback(
    async (force = false) => {
      if (!isSignedIn) return;
      const data = await cachedFetch<Bet[]>(BETS_KEY, force);
      if (data) setBets(data);
      setLoading(false);
    },
    [isSignedIn],
  );

  useEffect(() => {
    const cached = getCached<Bet[]>(BETS_KEY);
    if (cached?.length) {
      setBets(cached);
      setLoading(false);
    }
    fetchBets();
  }, [fetchBets]);

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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Icon name="lock" fill className="text-[36px] text-slate-600" />
        <p className="text-[15px] font-black text-white">Sign in to see your bets</p>
        <button
          type="button"
          onClick={openLogin}
          className="mt-1 rounded-xl bg-[#087cff] px-6 py-2.5 text-[13px] font-black text-white transition hover:bg-[#0570e8]"
        >
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Sticky chrome — matches sports page */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0e0f14]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400 transition hover:bg-white/[0.1] hover:text-white"
            aria-label="Back"
          >
            <Icon name="arrow_back" className="text-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-black leading-none text-white">My Bets</h1>
            <p className="mt-1 text-[11px] text-slate-500">
              {stats.total} placed
              {stats.pending > 0 && (
                <span className="text-amber-400"> · {stats.pending} running</span>
              )}
              {stats.totalStaked > 0 && (
                <span className="text-slate-600"> · {fmt(stats.totalStaked)} staked</span>
              )}
            </p>
          </div>
          <Link
            href="/sports"
            className="shrink-0 rounded-lg bg-[#087cff] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#0570e8]"
          >
            Place bet
          </Link>
        </div>

        {/* Filter strip */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2.5 sm:px-4">
          {STATUS_FILTERS.map((f) => {
            const count =
              f === "ALL"
                ? stats.total
                : f === "PENDING"
                  ? stats.pending
                  : f === "WON"
                    ? stats.won
                    : stats.lost;
            const label =
              f === "ALL" ? "All" : f === "PENDING" ? "Running" : f === "WON" ? "Won" : "Lost";
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                  active
                    ? "bg-[#087cff] text-white"
                    : "bg-[#1c2433] text-slate-400 hover:text-white"
                }`}
              >
                {label}
                <span className={`ml-1 tabular-nums ${active ? "text-white/70" : "text-slate-600"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip — one line, not a card grid */}
      {(stats.won > 0 || stats.totalWon > 0) && (
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#141820] px-3 py-2 text-[11px] sm:px-4">
          <span className="text-slate-500">
            Won <span className="font-black text-emerald-400">{stats.won}</span>
          </span>
          <span className="text-slate-500">
            Returns <span className="font-black tabular-nums text-emerald-400">{fmt(stats.totalWon)}</span>
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#087cff]/25 border-t-[#087cff]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <Icon name="receipt_long" className="mb-3 text-[36px] text-slate-700" />
          <p className="text-[14px] font-black text-slate-400">
            No {filter !== "ALL" ? filter.toLowerCase() : ""} bets yet
          </p>
          <Link
            href="/sports"
            className="mt-4 rounded-xl bg-[#087cff] px-5 py-2.5 text-[12px] font-black text-white transition hover:bg-[#0570e8]"
          >
            Browse sports
          </Link>
        </div>
      ) : (
        <div className="bg-[#0d0e11]">
          {filtered.map((bet) => (
            <BetTicket key={bet.id} bet={bet} />
          ))}
        </div>
      )}
    </div>
  );
}
