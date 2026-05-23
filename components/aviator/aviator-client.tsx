"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AviatorCanvas }   from "./aviator-canvas";
import { AviatorBetPanel } from "./aviator-bet-panel";
import { AviatorHistory, VerifyModal } from "./aviator-history";
import { AviatorLiveBets } from "./aviator-live-bets";
import type {
  AviatorGameState,
  AviatorRound,
  AviatorBetPublic,
  MyBets,
} from "@/lib/aviator/types";

interface HistoryRound {
  roundId:        string;
  roundNumber:    number;
  crashPoint:     number;
  crashedAt:      string | null;
  serverSeed:     string;
  serverSeedHash: string;
}

interface MyHistoryBet {
  id:          string;
  panelIndex:  number;
  betAmount:   number;
  cashoutAt:   number | null;
  winAmount:   number | null;
  status:      string;
  placedAt:    string;
  roundNumber: number;
  crashPoint:  number;
}

interface Props {
  userId?:   string;
  username?: string;
  balance:   number;
}

const GROWTH_RATE = 0.00006;
function computeMultiplier(flyingStartedAt: string | null): number {
  if (!flyingStartedAt) return 1.0;
  const elapsed = Date.now() - new Date(flyingStartedAt).getTime();
  return Math.round(Math.exp(GROWTH_RATE * elapsed) * 100) / 100;
}

export function AviatorClient({ userId, username, balance: initialBalance }: Props) {
  const [round,       setRound]       = useState<AviatorRound | null>(null);
  const [liveBets,    setLiveBets]    = useState<AviatorBetPublic[]>([]);
  const [myBets,      setMyBets]      = useState<MyBets>({});
  const [multiplier,  setMultiplier]  = useState(1.0);
  const [history,     setHistory]     = useState<HistoryRound[]>([]);
  const [myHistory,   setMyHistory]   = useState<MyHistoryBet[]>([]);
  const [balance,     setBalance]     = useState(initialBalance);
  const [verifyRound, setVerifyRound] = useState<HistoryRound | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const tickRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef    = useRef<number>(0);
  const roundRef  = useRef<AviatorRound | null>(null);
  const supabase  = createClient();

  useEffect(() => { roundRef.current = round; }, [round]);

  // ── Fetch state ────────────────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const res  = await fetch("/api/aviator/state");
      if (!res.ok) throw new Error("Failed to load game state");
      const data: AviatorGameState = await res.json();
      setRound(data.round);
      setLiveBets(data.bets);
      if (userId) {
        const mine: MyBets = {};
        data.bets.filter((b) => b.userId === userId).forEach((b) => { mine[b.panelIndex as 0 | 1] = b; });
        setMyBets(mine);
      }
      setLoading(false);
    } catch (e: unknown) {
      setError((e as Error).message);
      setLoading(false);
    }
  }, [userId]);

  // ── Fetch history ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    const url = userId ? `/api/aviator/history?userId=${userId}` : "/api/aviator/history";
    const res  = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as Array<{
      roundId: string; roundNumber: number; crashPoint: number;
      crashedAt: string | null; serverSeed: string; serverSeedHash: string;
      myBets?: Array<{ id: string; panelIndex: number; betAmount: number; cashoutAt: number | null; winAmount: number | null; status: string; placedAt: string }>;
    }>;
    setHistory(data);
    if (userId) {
      const flat: MyHistoryBet[] = [];
      data.forEach((r) => (r.myBets ?? []).forEach((b) => flat.push({ ...b, roundNumber: r.roundNumber, crashPoint: r.crashPoint })));
      flat.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
      setMyHistory(flat);
    }
  }, [userId]);

  // ── Fetch balance ──────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    const res  = await fetch("/api/wallet/balance");
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.balance === "number") setBalance(data.balance);
  }, [userId]);

  // ── Multiplier RAF ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const r = roundRef.current;
      if (r?.state === "FLYING" && r.flyingStartedAt) setMultiplier(computeMultiplier(r.flyingStartedAt));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Tick ───────────────────────────────────────────────────────────────────
  const tick = useCallback(async () => {
    try {
      const res  = await fetch("/api/aviator/tick", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.state !== roundRef.current?.state) await fetchState();
    } catch { /* non-critical */ }
  }, [fetchState]);

  // ── Supabase realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel("aviator-game")
      .on("broadcast", { event: "round:state" }, ({ payload }) => {
        setRound((prev) => prev ? { ...prev, ...payload } : prev);
        if (payload.state === "FLYING") setMultiplier(1.0);
        if (payload.state === "WAITING" || payload.state === "BETTING") {
          setLiveBets([]); setMyBets({}); fetchState();
        }
      })
      .on("broadcast", { event: "round:crashed" }, ({ payload }) => {
        setRound((prev) => prev ? { ...prev, state: "CRASHED", crashPoint: payload.crashPoint, serverSeed: payload.serverSeed, crashedAt: payload.crashedAt } : prev);
        setTimeout(fetchHistory, 500);
        setTimeout(fetchBalance, 1000);
      })
      .on("broadcast", { event: "bet:placed" }, ({ payload }: { payload: AviatorBetPublic }) => {
        setLiveBets((prev) => {
          const filtered = prev.filter((b) => !(b.userId === payload.userId && b.panelIndex === payload.panelIndex));
          return [...filtered, payload];
        });
        if (payload.userId === userId) { setMyBets((prev) => ({ ...prev, [payload.panelIndex as 0 | 1]: payload })); fetchBalance(); }
      })
      .on("broadcast", { event: "bet:cashedout" }, ({ payload }) => {
        setLiveBets((prev) => prev.map((b) =>
          b.userId === payload.userId && b.panelIndex === payload.panelIndex
            ? { ...b, status: "CASHEDOUT", cashoutAt: payload.cashoutAt, winAmount: payload.winAmount } : b,
        ));
        if (payload.userId === userId) {
          setMyBets((prev) => {
            const existing = prev[payload.panelIndex as 0 | 1];
            if (!existing) return prev;
            return { ...prev, [payload.panelIndex as 0 | 1]: { ...existing, status: "CASHEDOUT", cashoutAt: payload.cashoutAt, winAmount: payload.winAmount } };
          });
          fetchBalance();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchState();
    fetchHistory();
    tickRef.current = setInterval(tick, 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleBet = useCallback(async (amount: number, panelIndex: 0 | 1, autoCashout?: number) => {
    const res  = await fetch("/api/aviator/bet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betAmount: amount, panelIndex, autoCashout }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to place bet");
    setMyBets((prev) => ({
      ...prev,
      [panelIndex]: { id: data.betId, roundId: data.roundId, userId: userId ?? "", username: username ?? null, panelIndex, betAmount: amount, autoCashout: autoCashout ?? null, cashoutAt: null, winAmount: null, status: "ACTIVE", placedAt: new Date().toISOString() },
    }));
    setBalance((b) => b - amount);
  }, [userId, username]);

  const handleCashout = useCallback(async (panelIndex: 0 | 1) => {
    const res  = await fetch("/api/aviator/cashout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Cashout failed");
    setMyBets((prev) => {
      const existing = prev[panelIndex];
      if (!existing) return prev;
      return { ...prev, [panelIndex]: { ...existing, status: "CASHEDOUT", cashoutAt: data.cashoutAt, winAmount: data.winAmount } };
    });
    setBalance((b) => b + data.winAmount);
  }, []);

  const displayMult = round?.state === "CRASHED" ? (round.crashPoint ?? multiplier) : multiplier;

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#31c45d]" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchState} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">Retry</button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid min-w-0 gap-2 lg:h-full lg:min-h-0 lg:overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)_320px] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="hidden min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#141414] xl:block">
        <AviatorLiveBets
          liveBets={liveBets}
          myHistory={myHistory}
          userId={userId}
        />
      </aside>

      <section className="grid min-w-0 grid-rows-[auto_auto_auto_auto] lg:min-h-0 lg:overflow-hidden lg:grid-rows-[auto_auto_minmax(0,1fr)_auto]">
        <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-[#101010] px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="font-[var(--font-pacifico)] text-2xl text-[#ff1838]">Aviator</span>
            <span className="hidden text-[11px] font-black uppercase tracking-widest text-white/35 sm:inline">
              Round #{round?.roundNumber ?? "--"}
            </span>
            {round && (
              <span className="hidden font-mono text-[10px] text-white/20 md:inline">
                {round.serverSeedHash.slice(0, 18)}...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f6a400] px-3 py-1 text-xs font-black text-black">How to play?</span>
            <span className="hidden text-xs font-black text-[#20d15a] sm:inline">Provably fair</span>
          </div>
        </div>

        <div className="mb-2 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] px-2 py-1">
          <AviatorHistory rounds={history} onVerify={setVerifyRound} />
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-black lg:min-h-0">
          <div className="h-[240px] lg:h-full">
            <AviatorCanvas
              state={round?.state ?? "WAITING"}
              multiplier={displayMult}
              crashPoint={round?.crashPoint ?? undefined}
              bettingEndsAt={round?.bettingEndsAt ?? null}
              flyingStartedAt={round?.flyingStartedAt ?? null}
            />
          </div>
        </div>

        <div className="mt-2 grid min-w-0 shrink-0 grid-cols-2 gap-2">
          {([0, 1] as const).map((pi) => (
            <div key={pi} className="min-w-0">
              <AviatorBetPanel
                panelIndex={pi}
                round={round}
                myBet={myBets[pi]}
                currentMultiplier={displayMult}
                balance={balance}
                onBet={handleBet}
                onCashout={handleCashout}
              />
            </div>
          ))}
        </div>

        <div className="mt-2 xl:hidden">
          <AviatorLiveBets
            liveBets={liveBets}
            myHistory={myHistory}
            userId={userId}
          />
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#080d16] xl:block">
        <AviatorChatPanel liveBets={liveBets} roundNumber={round?.roundNumber ?? null} />
      </aside>

      {verifyRound && (
        <VerifyModal round={verifyRound} onClose={() => setVerifyRound(null)} />
      )}

    </div>
  );
}

function AviatorChatPanel({ liveBets, roundNumber }: { liveBets: AviatorBetPublic[]; roundNumber: number | null }) {
  const winners = liveBets.filter((b) => b.status === "CASHEDOUT").slice(-6).reverse();
  const feed = winners.length > 0 ? winners : liveBets.slice(-6).reverse();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0b0b0c] px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-white/70">Chat</span>
          <span className="flex items-center gap-1 text-xs font-bold text-white/35">
            Online <span className="h-2 w-2 rounded-full bg-[#24d463]" /> {Math.max(2, liveBets.length + 2)}
          </span>
        </div>
        <span className="text-lg text-white/35">x</span>
      </div>

      <div className="border-b border-white/10 bg-[#102f60] px-4 py-3">
        <div className="grid grid-cols-2 text-xs font-bold text-blue-100">
          <span>Round</span>
          <span className="text-right">Bet</span>
          <span className="font-mono text-white">{roundNumber ? `#${roundNumber}` : "--"}</span>
          <span className="text-right font-mono text-white">{liveBets.length.toLocaleString()} active</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#07101f] p-3">
        {feed.length === 0 ? (
          <ChatCard username="robo" message="Waiting for the next cashout..." mult="--" win="--" />
        ) : feed.map((bet, index) => (
          <ChatCard
            key={bet.id}
            username={bet.username ?? `demo${4100 + index}`}
            message={bet.status === "CASHEDOUT" ? "Awesome cashout!" : "Good luck!"}
            mult={bet.cashoutAt ? `${bet.cashoutAt.toFixed(2)}x` : "Flying"}
            win={bet.winAmount ? `KSh ${bet.winAmount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}` : `KSh ${bet.betAmount.toLocaleString("en-KE")}`}
          />
        ))}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0b0b0c] p-3">
        <div className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-xs text-white/35">
          <span>Reply</span>
          <span className="ml-auto rounded-full bg-[#0d47a1] px-2 py-0.5 text-[10px] font-black text-blue-100">Rain</span>
        </div>
      </div>
    </div>
  );
}

function ChatCard({ username, message, mult, win }: { username: string; message: string; mult: string; win: string }) {
  return (
    <div className="overflow-hidden rounded-lg bg-[#11356c] shadow-lg shadow-black/20">
      <div className="flex items-center gap-2 bg-[#0f4fa2] px-3 py-2 text-sm font-bold text-blue-100">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1478ff] text-xs text-white">B</span>
        <span className="truncate">{username}</span>
        <span className="rounded bg-[#1478ff] px-1 text-[10px]">Bot</span>
      </div>
      <div className="px-4 py-3">
        <p className="mb-2 text-xs font-bold text-blue-100/85">{message}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-blue-200/40">Cashed out</p>
            <span className="inline-flex rounded-md bg-fuchsia-600 px-2 py-1 font-black text-white">{mult}</span>
          </div>
          <div>
            <p className="text-blue-200/40">Win</p>
            <p className="font-black text-white">{win}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
