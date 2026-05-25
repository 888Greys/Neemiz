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
      .channel("aviator")
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
    tickRef.current = setInterval(tick, 5000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleBet = useCallback(async (amount: number, panelIndex: 0 | 1, autoCashout?: number) => {
    // Optimistic update — UI responds instantly; rollback if server rejects
    const tempBet: AviatorBetPublic = {
      id: `temp-${Date.now()}`, roundId: roundRef.current?.id ?? "",
      userId: userId ?? "", username: username ?? null, panelIndex,
      betAmount: amount, autoCashout: autoCashout ?? null,
      cashoutAt: null, winAmount: null, status: "ACTIVE",
      placedAt: new Date().toISOString(),
    };
    setMyBets((prev) => ({ ...prev, [panelIndex]: tempBet }));
    setBalance((b) => b - amount);

    try {
      const res  = await fetch("/api/aviator/bet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount: amount, panelIndex, autoCashout }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMyBets((prev) => { const next = { ...prev }; delete next[panelIndex]; return next; });
        setBalance((b) => b + amount);
        throw new Error(data.error ?? "Failed to place bet");
      }
      setMyBets((prev) => ({ ...prev, [panelIndex]: { ...tempBet, id: data.betId, roundId: data.roundId } }));
      window.dispatchEvent(new Event("wallet-refresh"));
    } catch (e) {
      throw e;
    }
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
    window.dispatchEvent(new Event("wallet-refresh"));
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
          myCurrentBets={Object.values(myBets)}
          userId={userId}
        />
      </aside>

      <section className="grid min-w-0 grid-rows-[auto_auto_auto_auto] lg:min-h-0 lg:overflow-hidden lg:grid-rows-[auto_auto_minmax(0,1fr)_auto]">
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#101010] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="font-[var(--font-pacifico)] text-xl text-[#ff1838] sm:text-2xl">Aviator</span>
            <span className="hidden text-[11px] font-black uppercase tracking-widest text-white/35 sm:inline">
              Round #{round?.roundNumber ?? "--"}
            </span>
            {round && (
              <span className="hidden font-mono text-[10px] text-white/20 md:inline">
                {round.serverSeedHash.slice(0, 18)}...
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-[#f6a400] px-2.5 py-1 text-[11px] font-black text-black sm:px-3 sm:text-xs">How to play?</span>
            <span className="hidden text-xs font-black text-[#20d15a] sm:inline">Provably fair</span>
          </div>
        </div>

        <div className="mb-2 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] px-2 py-1">
          <AviatorHistory rounds={history} onVerify={setVerifyRound} />
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-black lg:min-h-0">
          <div className="h-[220px] sm:h-[280px] lg:h-full">
            <AviatorCanvas
              state={round?.state ?? "WAITING"}
              multiplier={displayMult}
              crashPoint={round?.crashPoint ?? undefined}
              bettingEndsAt={round?.bettingEndsAt ?? null}
              flyingStartedAt={round?.flyingStartedAt ?? null}
            />
          </div>
        </div>

        <div className="mt-2 grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
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
            myCurrentBets={Object.values(myBets)}
            userId={userId}
          />
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#080d16] xl:block">
        <AviatorChatPanel liveBets={liveBets} roundNumber={round?.roundNumber ?? null} userId={userId} username={username} />
      </aside>

      {verifyRound && (
        <VerifyModal round={verifyRound} onClose={() => setVerifyRound(null)} />
      )}

    </div>
  );
}

interface ChatMessage {
  id:       string;
  userId:   string;
  username: string;
  text:     string;
  ts:       number;
}

function AviatorChatPanel({
  liveBets, roundNumber, userId, username,
}: {
  liveBets: AviatorBetPublic[];
  roundNumber: number | null;
  userId?: string;
  username?: string;
}) {
  const supabase   = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft,    setDraft]    = useState("");
  const [sending,  setSending]  = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const chRef      = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel("aviator-chat", { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "chat:message" }, ({ payload }: { payload: ChatMessage }) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.id)) return prev;
          return [...prev.slice(-199), payload];
        });
      })
      .subscribe();
    chRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !userId || !username || sending) return;
    setSending(true);
    const msg: ChatMessage = {
      id: `${userId}-${Date.now()}`,
      userId, username, text,
      ts: Date.now(),
    };
    await chRef.current?.send({ type: "broadcast", event: "chat:message", payload: msg });
    setDraft("");
    setSending(false);
  }, [draft, userId, username, sending]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0b0b0c] px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-white/70">Chat</span>
          <span className="flex items-center gap-1 text-xs font-bold text-white/35">
            <span className="h-2 w-2 rounded-full bg-[#24d463]" />
            {Math.max(2, liveBets.length + 2)} online
          </span>
        </div>
        <span className="font-mono text-xs text-white/25">#{roundNumber ?? "--"}</span>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#07101f] p-3">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-xs text-white/25">No messages yet — say hi!</p>
        ) : messages.map((m) => (
          <div key={m.id} className={`mb-2 flex items-start gap-2 ${m.userId === userId ? "flex-row-reverse" : ""}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${avatarColor(m.username)}`}>
              {m.username.slice(0, 1).toUpperCase()}
            </span>
            <div className={`max-w-[75%] ${m.userId === userId ? "items-end" : "items-start"} flex flex-col`}>
              <span className="mb-0.5 text-[10px] text-white/35">{m.username}</span>
              <span className={`rounded-2xl px-3 py-2 text-xs text-white ${m.userId === userId ? "rounded-tr-sm bg-[#0d47a1]" : "rounded-tl-sm bg-[#11356c]"}`}>
                {m.text}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 bg-[#0b0b0c] p-3">
        {userId ? (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Say something…"
              maxLength={200}
              className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-xs text-white placeholder-white/30 outline-none focus:bg-white/[0.15]"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              className="shrink-0 rounded-full bg-[#0d47a1] px-4 py-2 text-[11px] font-black text-white disabled:opacity-40 hover:bg-[#1565c0]"
            >
              Send
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-white/30">Sign in to chat</p>
        )}
      </div>
    </div>
  );
}

function avatarColor(name: string) {
  const colors = ["bg-violet-600","bg-blue-600","bg-green-600","bg-orange-500","bg-pink-600","bg-teal-600","bg-rose-600","bg-indigo-600"];
  return colors[name.charCodeAt(0) % colors.length];
}
