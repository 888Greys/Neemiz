"use client";

import { useState, useEffect, useCallback } from "react";
import { MarketCard } from "./market-card";
import { BetModal }   from "./bet-modal";
import { toast }      from "@/lib/toast";
import type { PolymarketMarket } from "@/lib/polymarket";

const TAGS = ["All", "Politics", "Sports", "Crypto", "Business", "Science", "World"];

interface MyBet {
  id:          string;
  marketId:    string;
  question:    string;
  outcome:     string;
  price:       number;
  stake:       number;
  potentialWin:number;
  status:      string;
  winAmount:   number | null;
  settledAt:   string | null;
  createdAt:   string;
}

interface Props {
  userId?:  string;
  balance:  number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    WON:     "bg-[#31c45d]/10 text-[#31c45d] border-[#31c45d]/20",
    LOST:    "bg-red-500/10 text-red-400 border-red-500/20",
    VOID:    "bg-white/10 text-white/40 border-white/10",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
  );
}

export function PolymarketClient({ userId, balance: initialBalance }: Props) {
  const [markets,  setMarkets]  = useState<PolymarketMarket[]>([]);
  const [myBets,   setMyBets]   = useState<MyBet[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"browse" | "my-bets">("browse");
  const [tag,      setTag]      = useState("All");
  const [selected, setSelected] = useState<PolymarketMarket | null>(null);
  const [balance,  setBalance]  = useState(initialBalance);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const url = tag === "All" ? "/api/polymarket/markets" : `/api/polymarket/markets?tag=${encodeURIComponent(tag)}`;
    const res = await fetch(url);
    if (res.ok) setMarkets(await res.json());
    setLoading(false);
  }, [tag]);

  const fetchMyBets = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/polymarket/my-bets");
    if (res.ok) setMyBets(await res.json());
  }, [userId]);

  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/wallet/balance");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.balance === "number") setBalance(data.balance);
    }
  }, [userId]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);
  useEffect(() => { if (tab === "my-bets") fetchMyBets(); }, [tab, fetchMyBets]);

  function handleBetSuccess() {
    toast.success("Bet placed!");
    fetchBalance();
    if (tab === "my-bets") fetchMyBets();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
        {(["browse", "my-bets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-xs font-black uppercase tracking-wide transition ${
              tab === t ? "bg-[#087cff] text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "browse" ? "Markets" : "My Bets"}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <>
          {/* Tag filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  tag === t
                    ? "border-[#087cff] bg-[#087cff]/20 text-[#087cff]"
                    : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Market grid */}
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : markets.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/30">No markets found</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {markets.map((m) => (
                <MarketCard key={m.conditionId} market={m} onBet={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "my-bets" && (
        <>
          {!userId ? (
            <p className="py-16 text-center text-sm text-white/40">Sign in to see your bets</p>
          ) : myBets.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/30">No bets yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myBets.map((b) => (
                <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm font-semibold leading-snug text-white line-clamp-2">
                      {b.question}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                    <span>
                      <span className={b.outcome.toLowerCase() === "yes" ? "text-[#31c45d]" : "text-red-400"}>
                        {b.outcome}
                      </span>
                      {" "}@ {(b.price * 100).toFixed(0)}¢ ({(1/b.price).toFixed(2)}x)
                    </span>
                    <span>Stake: <span className="text-white">KSh {b.stake.toLocaleString()}</span></span>
                    <span>
                      {b.status === "WON"
                        ? <span className="text-[#31c45d]">Won KSh {b.winAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        : b.status === "LOST"
                        ? <span className="text-red-400">Lost</span>
                        : <span>To win: KSh {b.potentialWin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bet modal */}
      {selected && (
        <BetModal
          market={selected}
          balance={balance}
          onClose={() => setSelected(null)}
          onSuccess={handleBetSuccess}
        />
      )}
    </div>
  );
}
