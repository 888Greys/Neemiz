"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AviatorCanvas }   from "./aviator-canvas";
import { AviatorBetPanel } from "./aviator-bet-panel";
import { AviatorHistory, VerifyModal } from "./aviator-history";
import { AviatorLiveBets } from "./aviator-live-bets";
import { toast } from "@/lib/toast";
import type {
  AviatorRoundState,
  AviatorRound,
  AviatorBetPublic,
  MyBets,
} from "@/lib/aviator/types";

const WS_URL = process.env.NEXT_PUBLIC_AVIATOR_WS_URL ?? "wss://aviator.nezeem.com/ws";

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

function mapStatus(s: string): AviatorRoundState {
  if (s === "RUNNING") return "FLYING";
  if (s === "CRASHED") return "CRASHED";
  if (s === "BETTING") return "BETTING";
  return "WAITING";
}

export function AviatorClient({ userId, username, balance: initialBalance }: Props) {
  const [round,      setRound]      = useState<AviatorRound | null>(null);
  const [liveBets,   setLiveBets]   = useState<AviatorBetPublic[]>([]);
  const [myBets,     setMyBets]     = useState<MyBets>({});
  const [multiplier, setMultiplier] = useState(1.0);
  const [history,    setHistory]    = useState<HistoryRound[]>([]);
  const [myHistory,  setMyHistory]  = useState<MyHistoryBet[]>([]);
  const [balance,    setBalance]    = useState(initialBalance);
  const [verifyRound, setVerifyRound] = useState<HistoryRound | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activePanel, setActivePanel] = useState<0 | 1>(0);

  const wsRef          = useRef<WebSocket | null>(null);
  const rafRef         = useRef<number>(0);
  const roundRef       = useRef<AviatorRound | null>(null);
  const roundCountRef  = useRef(0);
  // tracks which panel index has a pending bet awaiting a bet_id response
  const pendingBetRef  = useRef<{ panelIndex: 0 | 1; amount: number } | null>(null);
  const supabase       = createClient();

  useEffect(() => { roundRef.current = round; }, [round]);

  // ── Balance ────────────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const res  = await fetch("/api/wallet/balance");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.balance === "number") setBalance(data.balance);
    } catch { /* ignore */ }
  }, [userId]);

  // ── History ────────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const res  = await fetch("/api/aviator/history");
      if (!res.ok) return;
      const data = await res.json() as MyHistoryBet[];
      // Only overwrite if we got real records
      if (Array.isArray(data) && data.length > 0) {
        setMyHistory(data);
      }
    } catch { /* ignore */ }
  }, [userId]);

  // ── WS message handler ─────────────────────────────────────────────────────
  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string | undefined;

    // ── Bet response (no type field, has success + bet_id) ──────────────────
    if (!type && typeof msg.success === "boolean" && msg.bet_id) {
      if (msg.success) {
        const betId     = msg.bet_id as string;
        const pending   = pendingBetRef.current;
        if (pending) {
          setMyBets((prev) => {
            const existing = prev[pending.panelIndex];
            if (!existing) return prev;
            return { ...prev, [pending.panelIndex]: { ...existing, id: betId, roundId: roundRef.current?.id ?? "" } };
          });
          pendingBetRef.current = null;
        }
      } else {
        // Bet rejected — roll back optimistic update
        const pending = pendingBetRef.current;
        if (pending) {
          setMyBets((prev) => { const next = { ...prev }; delete next[pending.panelIndex]; return next; });
          setBalance((b) => b + pending.amount);
          pendingBetRef.current = null;
        }
      }
      return;
    }

    // ── Cashout response ───────────────────────────────────────────────────
    if (!type && typeof msg.success === "boolean" && msg.payout !== undefined) {
      if (msg.success) {
        const payout = msg.payout as number;
        setBalance((b) => b + payout);
        window.dispatchEvent(new Event("wallet-refresh"));
      }
      return;
    }

    switch (type) {
      case "initial_state": {
        const d = msg.data as Record<string, unknown> | undefined;
        if (!d) break;
        roundCountRef.current++;
        const status  = mapStatus((d.status as string) ?? "BETTING");
        const now     = new Date().toISOString();
        setRound({
          id:              (d.round_id as string) ?? "",
          roundNumber:     roundCountRef.current,
          serverSeedHash:  (d.hash_commitment as string) ?? "",
          state:           status,
          bettingEndsAt:   status === "BETTING" ? new Date(Date.now() + 5000).toISOString() : null,
          flyingStartedAt: status === "FLYING"  ? now : null,
          crashedAt:       null,
          createdAt:       (d.start_time as string) ?? now,
        });
        if (status === "FLYING") setMultiplier((d.current_multiplier as number) ?? 1.0);
        setLoading(false);
        break;
      }

      case "round_start": {
        roundCountRef.current++;
        setLiveBets([]);
        setMyBets({});
        pendingBetRef.current = null;
        setMultiplier(1.0);
        setRound({
          id:              (msg.round_id as string) ?? "",
          roundNumber:     roundCountRef.current,
          serverSeedHash:  (msg.commitment as string) ?? "",
          state:           "BETTING",
          bettingEndsAt:   new Date(Date.now() + 5000).toISOString(),
          flyingStartedAt: null,
          crashedAt:       null,
          createdAt:       new Date().toISOString(),
        });
        break;
      }

      case "round_running": {
        const flyingStartedAt = new Date().toISOString();
        setRound((prev) => prev ? { ...prev, state: "FLYING", flyingStartedAt, bettingEndsAt: null } : prev);
        setMultiplier(1.0);
        break;
      }

      case "update":
        setMultiplier((msg.multiplier as number) ?? 1.0);
        break;

      case "crash": {
        const crashPoint = (msg.multiplier as number) ?? 1.0;
        const serverSeed = (msg.server_seed as string) ?? "";
        const crashedAt  = new Date().toISOString();
        setRound((prev) => {
          if (!prev) return prev;
          // Append to round-history chips
          setHistory((h) => {
            const entry: HistoryRound = {
              roundId:        prev.id,
              roundNumber:    prev.roundNumber ?? 0,
              crashPoint,
              crashedAt,
              serverSeed,
              serverSeedHash: prev.serverSeedHash ?? "",
            };
            return [...h, entry].slice(-80);
          });
          return { ...prev, state: "CRASHED", crashPoint, serverSeed, crashedAt };
        });
        setMultiplier(crashPoint);
        setMyBets((prev) => {
          const next = { ...prev } as MyBets;
          (Object.keys(next) as unknown as Array<0 | 1>).forEach((k) => {
            if (next[k]?.status === "ACTIVE") next[k] = { ...next[k]!, status: "LOST" };
          });
          return next;
        });
        setTimeout(fetchHistory, 1000);
        setTimeout(fetchBalance, 800);
        break;
      }

      case "bet_placed": {
        const d = msg.data as Record<string, unknown> | undefined;
        if (!d) break;
        const bet: AviatorBetPublic = {
          id:          (d.bet_id as string) ?? `${d.user_id}-${Date.now()}`,
          roundId:     roundRef.current?.id ?? "",
          userId:      (d.user_id as string) ?? "",
          username:    (d.user_id as string) ?? null,
          panelIndex:  0,
          betAmount:   (d.amount as number) ?? 0,
          autoCashout: null,
          cashoutAt:   null,
          winAmount:   null,
          status:      "ACTIVE",
          placedAt:    new Date().toISOString(),
        };
        setLiveBets((prev) => [...prev.filter((b) => b.userId !== bet.userId || b.roundId !== bet.roundId), bet]);
        break;
      }

      case "cashout": {
        const d = msg.data as Record<string, unknown> | undefined;
        if (!d) break;
        setLiveBets((prev) => prev.map((b) =>
          b.userId === (d.user_id as string)
            ? { ...b, status: "CASHEDOUT", cashoutAt: d.multiplier as number, winAmount: d.payout as number }
            : b,
        ));
        break;
      }
    }
  }, [fetchHistory, fetchBalance]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    const uid = encodeURIComponent(userId ?? "guest");
    let closed = false;

    function connect() {
      if (closed) return;
      const ws = new WebSocket(`${WS_URL}?user_id=${uid}`);
      wsRef.current = ws;

      ws.onopen = () => setLoading(false);

      ws.onmessage = (e) => {
        try { handleMessage(JSON.parse(e.data as string)); } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!closed) setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    fetchHistory();

    return () => {
      closed = true;
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Multiplier RAF ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      const r = roundRef.current;
      if (r?.state === "FLYING" && r.flyingStartedAt) {
        const elapsed = Math.max(0, Date.now() - new Date(r.flyingStartedAt).getTime()) / 1000;
        const value = 1 + elapsed / 1.5 + elapsed * elapsed * 0.005;
        setMultiplier(Math.floor(value * 100) / 100);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleBet = useCallback(async (amount: number, panelIndex: 0 | 1, autoCashout?: number) => {
    const tempBet: AviatorBetPublic = {
      id:          `temp-${panelIndex}-${Date.now()}`,
      roundId:     roundRef.current?.id ?? "",
      userId:      userId ?? "",
      username:    username ?? null,
      panelIndex,
      betAmount:   amount,
      autoCashout: autoCashout ?? null,
      cashoutAt:   null,
      winAmount:   null,
      status:      "ACTIVE",
      placedAt:    new Date().toISOString(),
    };

    setMyBets((prev) => ({ ...prev, [panelIndex]: tempBet }));
    setBalance((b) => b - amount);

    const res = await fetch("/api/aviator/bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betAmount: amount, panelIndex, autoCashout }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMyBets((prev) => { const next = { ...prev }; delete next[panelIndex]; return next; });
      setBalance((b) => b + amount);
      throw new Error(data.error ?? "Failed to place bet");
    }

    setMyBets((prev) => ({
      ...prev,
      [panelIndex]: {
        ...tempBet,
        id: data.betId,
        roundId: data.roundId,
        autoCashout: data.autoCashout,
      },
    }));
    await fetchBalance();
    window.dispatchEvent(new Event("wallet-refresh"));
  }, [userId, username]);

  const handleCashout = useCallback(async (panelIndex: 0 | 1) => {
    const bet = myBets[panelIndex];
    if (!bet) return;

    const clickedMultiplier = Math.max(1, multiplier);
    const pendingWin = Number((bet.betAmount * clickedMultiplier).toFixed(2));
    setMyBets((prev) => {
      const existing = prev[panelIndex];
      if (!existing || existing.status !== "ACTIVE") return prev;
      return {
        ...prev,
        [panelIndex]: {
          ...existing,
          status: "CASHING_OUT",
          cashoutAt: clickedMultiplier,
          winAmount: pendingWin,
        },
      };
    });

    try {
      const res = await fetch("/api/aviator/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelIndex, betId: bet.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Cashout failed");
      }

      setMyBets((prev) => {
        const existing = prev[panelIndex];
        if (!existing) return prev;
        return {
          ...prev,
          [panelIndex]: {
            ...existing,
            status: "CASHEDOUT",
            cashoutAt: data.cashoutAt,
            winAmount: data.winAmount,
          },
        };
      });
      toast.cashout(
        `Cashed out at ${(data.cashoutAt as number).toFixed(2)}×`,
        `+KSh ${Number(data.winAmount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      );
      await fetchBalance();
      window.dispatchEvent(new Event("wallet-refresh"));
    } catch (err) {
      toast.error("Cashout failed", (err as Error).message);
      setMyBets((prev) => {
        const existing = prev[panelIndex];
        if (!existing || existing.status !== "CASHING_OUT") return prev;
        return {
          ...prev,
          [panelIndex]: {
            ...existing,
            status: roundRef.current?.state === "FLYING" ? "ACTIVE" : "LOST",
            cashoutAt: null,
            winAmount: null,
          },
        };
      });
      throw err;
    }
  }, [fetchBalance, multiplier, myBets]);

  const displayMult = round?.state === "CRASHED" ? (round.crashPoint ?? multiplier) : multiplier;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#31c45d]" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[1680px] gap-2 lg:h-full lg:min-h-0 lg:overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_300px] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="hidden min-h-0 overflow-hidden rounded-lg border border-white/10 bg-[#141414] xl:block">
        <AviatorLiveBets
          liveBets={liveBets}
          myHistory={myHistory}
          myCurrentBets={Object.values(myBets)}
          userId={userId}
        />
      </aside>

      <section className="grid min-w-0 grid-rows-[auto_auto_auto_auto] lg:min-h-0 lg:overflow-hidden lg:grid-rows-[auto_auto_minmax(0,1fr)_auto]">
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#101010] px-2.5 py-2 sm:px-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="font-[var(--font-pacifico)] text-lg text-[#ff1838] sm:text-2xl">Aviator</span>
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
            <span className="hidden rounded-full bg-[#f6a400] px-2.5 py-1 text-[11px] font-black text-black sm:inline sm:px-3 sm:text-xs">How to play?</span>
            <span className="hidden text-xs font-black text-[#20d15a] sm:inline">Provably fair</span>
          </div>
        </div>

        <div className="mb-2 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] px-2 py-1">
          <AviatorHistory rounds={history} onVerify={setVerifyRound} />
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-black lg:min-h-0">
          <div className="h-[240px] sm:h-[300px] md:h-[380px] lg:h-full">
            <AviatorCanvas
              state={round?.state ?? "WAITING"}
              multiplier={displayMult}
              crashPoint={round?.crashPoint ?? undefined}
              bettingEndsAt={round?.bettingEndsAt ?? null}
              flyingStartedAt={round?.flyingStartedAt ?? null}
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-[#0b0c0f] p-1 md:hidden">
          {([0, 1] as const).map((pi) => (
            <button
              key={pi}
              type="button"
              onClick={() => setActivePanel(pi)}
              className={`rounded-lg py-2 text-[11px] font-black uppercase tracking-widest transition ${
                activePanel === pi
                  ? "bg-[#087cff] text-white shadow-[0_8px_22px_rgba(8,124,255,.25)]"
                  : "text-white/35"
              }`}
            >
              Bet {pi + 1}
            </button>
          ))}
        </div>

        <div className="mt-2 grid min-w-0 shrink-0 grid-cols-1 gap-2 md:grid-cols-2">
          {([0, 1] as const).map((pi) => (
            <div key={pi} className={`${activePanel === pi ? "block" : "hidden"} min-w-0 md:block`}>
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
    const msg: ChatMessage = { id: `${userId}-${Date.now()}`, userId, username, text, ts: Date.now() };
    await chRef.current?.send({ type: "broadcast", event: "chat:message", payload: msg });
    setDraft("");
    setSending(false);
  }, [draft, userId, username, sending]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
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

      <div className="shrink-0 border-t border-white/10 bg-[#0b0b0c] p-3">
        {userId ? (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Say something..."
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
