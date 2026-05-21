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
  const [round,      setRound]      = useState<AviatorRound | null>(null);
  const [liveBets,   setLiveBets]   = useState<AviatorBetPublic[]>([]);
  const [myBets,     setMyBets]     = useState<MyBets>({});
  const [multiplier, setMultiplier] = useState(1.0);
  const [history,    setHistory]    = useState<HistoryRound[]>([]);
  const [myHistory,  setMyHistory]  = useState<MyHistoryBet[]>([]);
  const [balance,    setBalance]    = useState(initialBalance);
  const [verifyRound,setVerifyRound]= useState<HistoryRound | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef       = useRef<number>(0);
  const roundRef     = useRef<AviatorRound | null>(null);
  const supabase     = createClient();

  // Keep roundRef in sync so the RAF loop can access latest round
  useEffect(() => { roundRef.current = round; }, [round]);

  // ── Fetch initial state ────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const res  = await fetch("/api/aviator/state");
      if (!res.ok) throw new Error("Failed to load game state");
      const data: AviatorGameState = await res.json();
      setRound(data.round);
      setLiveBets(data.bets);

      // Populate myBets from live bets list
      if (userId) {
        const mine: MyBets = {};
        data.bets
          .filter((b) => b.userId === userId)
          .forEach((b) => { mine[b.panelIndex as 0 | 1] = b; });
        setMyBets(mine);
      }
      setLoading(false);
    } catch (e: unknown) {
      setError((e as Error).message);
      setLoading(false);
    }
  }, [userId]);

  // ── Fetch round history ────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    const url = userId ? `/api/aviator/history?userId=${userId}` : "/api/aviator/history";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as Array<{
      roundId: string; roundNumber: number; crashPoint: number;
      crashedAt: string | null; serverSeed: string; serverSeedHash: string;
      myBets?: Array<{ id: string; panelIndex: number; betAmount: number; cashoutAt: number | null; winAmount: number | null; status: string; placedAt: string }>;
    }>;
    setHistory(data);

    if (userId) {
      const flat: MyHistoryBet[] = [];
      data.forEach((r) => {
        (r.myBets ?? []).forEach((b) => {
          flat.push({ ...b, roundNumber: r.roundNumber, crashPoint: r.crashPoint });
        });
      });
      flat.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
      setMyHistory(flat);
    }
  }, [userId]);

  // ── Fetch current wallet balance ───────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/wallet/balance");
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.balance === "number") setBalance(data.balance);
  }, [userId]);

  // ── Multiplier RAF loop ────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const r = roundRef.current;
      if (r?.state === "FLYING" && r.flyingStartedAt) {
        setMultiplier(computeMultiplier(r.flyingStartedAt));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Tick — advance game state ──────────────────────────────────────────
  const tick = useCallback(async () => {
    try {
      const res  = await fetch("/api/aviator/tick", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();

      // Re-fetch full state whenever server state differs from our local state
      // This covers all transitions: WAITING→BETTING, BETTING→FLYING, FLYING→CRASHED, etc.
      if (data.state !== roundRef.current?.state) {
        await fetchState();
      }
    } catch { /* non-critical */ }
  }, [fetchState]);

  // ── Supabase Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("aviator-game")
      // Round state changes
      .on("broadcast", { event: "round:state" }, ({ payload }) => {
        setRound((prev) => prev ? { ...prev, ...payload } : prev);
        if (payload.state === "FLYING") {
          setMultiplier(1.0);
        }
        if (payload.state === "WAITING" || payload.state === "BETTING") {
          // New round started — clear live bets and refresh
          setLiveBets([]);
          setMyBets({});
          fetchState();
        }
      })
      // Round crashed
      .on("broadcast", { event: "round:crashed" }, ({ payload }) => {
        setRound((prev) =>
          prev ? {
            ...prev,
            state:      "CRASHED",
            crashPoint: payload.crashPoint,
            serverSeed: payload.serverSeed,
            crashedAt:  payload.crashedAt,
          } : prev
        );
        // Refresh history after crash
        setTimeout(fetchHistory, 500);
        // Refresh balance (lost bets already deducted, wins credited)
        setTimeout(fetchBalance, 1000);
      })
      // Bet placed
      .on("broadcast", { event: "bet:placed" }, ({ payload }: { payload: AviatorBetPublic }) => {
        setLiveBets((prev) => {
          const filtered = prev.filter(
            (b) => !(b.userId === payload.userId && b.panelIndex === payload.panelIndex)
          );
          return [...filtered, payload];
        });
        if (payload.userId === userId) {
          setMyBets((prev) => ({ ...prev, [payload.panelIndex as 0 | 1]: payload }));
          fetchBalance();
        }
      })
      // Bet cashed out
      .on("broadcast", { event: "bet:cashedout" }, ({ payload }) => {
        setLiveBets((prev) =>
          prev.map((b) =>
            b.userId === payload.userId && b.panelIndex === payload.panelIndex
              ? { ...b, status: "CASHEDOUT", cashoutAt: payload.cashoutAt, winAmount: payload.winAmount }
              : b
          )
        );
        if (payload.userId === userId) {
          setMyBets((prev) => {
            const existing = prev[payload.panelIndex as 0 | 1];
            if (!existing) return prev;
            return {
              ...prev,
              [payload.panelIndex as 0 | 1]: {
                ...existing,
                status:    "CASHEDOUT",
                cashoutAt: payload.cashoutAt,
                winAmount: payload.winAmount,
              },
            };
          });
          fetchBalance();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Bootstrap ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchState();
    fetchHistory();
    // Tick interval
    tickRef.current = setInterval(tick, 500);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleBet = useCallback(async (
    amount: number,
    panelIndex: 0 | 1,
    autoCashout?: number,
  ) => {
    const res = await fetch("/api/aviator/bet", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ betAmount: amount, panelIndex, autoCashout }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to place bet");
    // Optimistic update — realtime will confirm
    setMyBets((prev) => ({
      ...prev,
      [panelIndex]: {
        id:          data.betId,
        roundId:     data.roundId,
        userId:      userId ?? "",
        username:    username ?? null,
        panelIndex,
        betAmount:   amount,
        autoCashout: autoCashout ?? null,
        cashoutAt:   null,
        winAmount:   null,
        status:      "ACTIVE",
        placedAt:    new Date().toISOString(),
      },
    }));
    setBalance((b) => b - amount);
  }, [userId, username]);

  const handleCashout = useCallback(async (panelIndex: 0 | 1) => {
    const res = await fetch("/api/aviator/cashout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ panelIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Cashout failed");
    // Optimistic update
    setMyBets((prev) => {
      const existing = prev[panelIndex];
      if (!existing) return prev;
      return {
        ...prev,
        [panelIndex]: {
          ...existing,
          status:    "CASHEDOUT",
          cashoutAt: data.cashoutAt,
          winAmount: data.winAmount,
        },
      };
    });
    setBalance((b) => b + data.winAmount);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-green-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchState} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
          Retry
        </button>
      </div>
    );
  }

  const displayMult = round?.state === "CRASHED"
    ? (round.crashPoint ?? multiplier)
    : multiplier;

  return (
    <div className="flex flex-col gap-3">
      {/* Provably fair info strip */}
      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-white/40">
        <span>
          {round ? `Round #${round.roundNumber}` : "—"}
          {round && (
            <span className="ml-2 font-mono text-[10px] text-white/20">
              {round.serverSeedHash.slice(0, 16)}…
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Provably Fair
        </span>
      </div>

      {/* History strip */}
      <AviatorHistory rounds={history} onVerify={setVerifyRound} />

      {/* Main game area */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Canvas — 3/5 */}
        <div className="h-72 overflow-hidden rounded-xl border border-white/10 sm:h-80 md:h-96 lg:col-span-3">
          <AviatorCanvas
            state={round?.state ?? "WAITING"}
            multiplier={displayMult}
            crashPoint={round?.crashPoint ?? undefined}
            bettingEndsAt={round?.bettingEndsAt ?? null}
            flyingStartedAt={round?.flyingStartedAt ?? null}
          />
        </div>

        {/* Live bets — 2/5 */}
        <div className="h-72 sm:h-80 md:h-96 lg:col-span-2">
          <AviatorLiveBets
            liveBets={liveBets}
            myHistory={myHistory}
            userId={userId}
          />
        </div>
      </div>

      {/* Bet panels */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {([0, 1] as const).map((pi) => (
          <AviatorBetPanel
            key={pi}
            panelIndex={pi}
            round={round}
            myBet={myBets[pi]}
            currentMultiplier={displayMult}
            balance={balance}
            onBet={handleBet}
            onCashout={handleCashout}
          />
        ))}
      </div>

      {/* Verify modal */}
      {verifyRound && (
        <VerifyModal
          round={verifyRound}
          onClose={() => setVerifyRound(null)}
        />
      )}
    </div>
  );
}
