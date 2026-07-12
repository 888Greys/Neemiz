"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AviatorCanvas }   from "./aviator-canvas";
import { AviatorBetPanel } from "./aviator-bet-panel";
import { AviatorHistory, VerifyModal } from "./aviator-history";
import { AviatorLiveBets } from "./aviator-live-bets";
import { RollingBalance } from "./win-celebration";
import { toast } from "@/lib/toast";
import { placed, isSoundEnabled, setSoundEnabled as setGameSound } from "@/lib/game-feel";
import { Icon } from "@/components/icon";
import { useMoney, useCurrency } from "@/lib/currency-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import type {
  AviatorRoundState,
  AviatorRound,
  AviatorBetPublic,
  MyBets,
} from "@/lib/aviator/types";
import { maskName } from "@/lib/aviator/types";

const WS_URL = process.env.NEXT_PUBLIC_AVIATOR_WS_URL ?? "wss://aviator.nezeem.com/ws";
const HISTORY_STORAGE_KEY = "nezeem_aviator_rounds";
// Background music (music.mp3) — OFF by default. Distinct from game "sound"
// (the synthesized win/cash-out cues in lib/game-feel), which is ON by default.
const MUSIC_STORAGE_KEY = "nezeem_aviator_music_enabled";

function loadStoredHistory(): HistoryRound[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryRound[]) : [];
  } catch { return []; }
}

function appendStoredHistory(entry: HistoryRound) {
  try {
    const existing = loadStoredHistory();
    if (existing.some((e) => e.roundId === entry.roundId)) return; // never store a round twice
    const updated = [...existing, entry].slice(-80);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch { /* non-critical */ }
}

function loadMusicEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Default OFF: only on when explicitly enabled.
    return localStorage.getItem(MUSIC_STORAGE_KEY) === "1";
  } catch { return false; }
}

interface HistoryRound {
  roundId:        string;
  roundNumber:    number;
  crashPoint:     number;
  crashedAt:      string | null;
  serverSeed:     string;
  serverSeedHash: string;
  clientSeed?:    string;
  nonce?:         number;
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
  const { format } = useMoney();
  const { convert, currency, code } = useCurrency();
  // Spribe-style balance: bare number + currency code, e.g. "7,733.87 USD".
  const spribeBalance = (kes: number) =>
    `${convert(kes).toLocaleString(currency.locale, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    })} ${code}`;
  const router = useRouter();
  const { openWallet } = useAuthModal();
  const [round,      setRound]      = useState<AviatorRound | null>(null);
  const [liveBets,   setLiveBets]   = useState<AviatorBetPublic[]>([]);
  const [myBets,     setMyBets]     = useState<MyBets>({});
  const [multiplier, setMultiplier] = useState(1.0);
  const [history,    setHistory]    = useState<HistoryRound[]>(() => loadStoredHistory());
  const [myHistory,  setMyHistory]  = useState<MyHistoryBet[]>([]);
  const [balance,    setBalance]    = useState(initialBalance);
  const [verifyRound,    setVerifyRound]    = useState<HistoryRound | null>(null);
  const [prevRoundBets,  setPrevRoundBets]  = useState<AviatorBetPublic[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [musicEnabled,   setMusicEnabled]   = useState(loadMusicEnabled);
  // Game "sound" = synthesized win/cash-out cues (lib/game-feel), ON by default.
  const [soundOn,        setSoundOn]        = useState(isSoundEnabled);
  const toggleGameSound = useCallback(() => {
    setSoundOn((v) => { const next = !v; setGameSound(next); return next; });
  }, []);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [infoModal,      setInfoModal]      = useState<null | "how" | "rules" | "fair" | "limits">(null);
  const [cashingOut,     setCashingOut]     = useState<{ 0?: boolean; 1?: boolean }>({});
  // Mobile bottom-nav: players / mine open the players sheet on the matching tab.
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [playersOpen, setPlayersOpen] = useState(false);
  const [playersTab, setPlayersTab] = useState<"live" | "mine" | "prev">("live");
  useEffect(() => {
    if (urlTab === "mine") {
      setPlayersOpen(true);
      setPlayersTab("mine");
    } else if (urlTab === "players") {
      setPlayersOpen(true);
      setPlayersTab("live");
    } else {
      setPlayersOpen(false);
      setPlayersTab("live");
    }
  }, [urlTab]);

  const closePlayersSheet = useCallback(() => {
    setPlayersOpen(false);
    router.replace("/aviator", { scroll: false });
  }, [router]);

  const wsRef          = useRef<WebSocket | null>(null);
  const rafRef         = useRef<number>(0);
  const roundRef       = useRef<AviatorRound | null>(null);
  const liveBetsRef    = useRef<AviatorBetPublic[]>([]);
  const roundCountRef  = useRef(0);
  const bgMusicRef     = useRef<HTMLAudioElement | null>(null);
  const musicEnabledRef = useRef(musicEnabled);
  // tracks which panel index has a pending bet awaiting a bet_id response
  const pendingBetRef  = useRef<{ panelIndex: 0 | 1; amount: number } | null>(null);
  const supabase       = createClient();

  useEffect(() => { roundRef.current  = round;     }, [round]);
  useEffect(() => { liveBetsRef.current = liveBets; }, [liveBets]);
  useEffect(() => { musicEnabledRef.current = musicEnabled; }, [musicEnabled]);

  // Mirror of myBets for reading current state inside the WS crash handler.
  const myBetsRef = useRef<MyBets>({});
  useEffect(() => { myBetsRef.current = myBets; }, [myBets]);

  // One sound only: looping background music that plays for the whole session.
  // No synth, no crash sound.
  useEffect(() => {
    const music = new Audio("/aviator/music.mp3");
    music.loop = true;
    music.volume = 0.35;
    bgMusicRef.current = music;

    const unlockAudio = () => {
      // Browsers block autoplay until a gesture — kick off music here if enabled.
      if (musicEnabledRef.current) music.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      music.pause();
      bgMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(MUSIC_STORAGE_KEY, musicEnabled ? "1" : "0"); } catch { /* non-critical */ }
    if (!musicEnabled) {
      bgMusicRef.current?.pause();
    } else {
      bgMusicRef.current?.play().catch(() => undefined);
    }
  }, [musicEnabled]);

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
        const status   = mapStatus((d.status as string) ?? "BETTING");
        const now      = new Date().toISOString();
        // Use the server's authoritative start_time so every tab/refresh
        // calculates the same elapsed time regardless of when they connect.
        const startTime    = (d.start_time as string) ?? now;
        const BETTING_MS   = 5_000;
        const bettingEndMs = new Date(startTime).getTime() + BETTING_MS;
        setRound({
          id:              (d.round_id as string) ?? "",
          roundNumber:     roundCountRef.current,
          serverSeedHash:  (d.hash_commitment as string) ?? "",
          state:           status,
          // If still in BETTING phase, deadline = server start + 5 s (may already be in the past if >5 s ago)
          bettingEndsAt:   status === "BETTING" ? new Date(bettingEndMs).toISOString() : null,
          // flyingStartedAt drives the canvas multiplier — must equal bettingEnd, not "now"
          flyingStartedAt: status === "FLYING"  ? new Date(bettingEndMs).toISOString() : null,
          crashedAt:       null,
          createdAt:       startTime,
        });
        if (status === "FLYING") setMultiplier((d.current_multiplier as number) ?? 1.0);
        setLoading(false);
        break;
      }

      case "round_start": {
        roundCountRef.current++;
        setPrevRoundBets(liveBetsRef.current);
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
        // Derive flyingStartedAt from the already-established bettingEndsAt so all tabs
        // that received the same round_start event share an identical reference time.
        // Fall back to now only if bettingEndsAt was somehow not set.
        setRound((prev) => {
          const flyingStartedAt = prev?.bettingEndsAt ?? new Date().toISOString();
          return prev ? { ...prev, state: "FLYING", flyingStartedAt, bettingEndsAt: null } : prev;
        });
        setMultiplier(1.0);
        break;
      }

      case "update":
        setMultiplier((msg.multiplier as number) ?? 1.0);
        break;

      case "crash": {
        const crashPoint = (msg.multiplier as number) ?? 1.0;
        const serverSeed = (msg.server_seed as string) ?? "";
        const clientSeed = (msg.client_seed as string) ?? "";
        const nonce      = (msg.nonce as number) ?? Number(String(msg.round_id ?? "").split("-").at(-1));
        const crashedAt  = new Date().toISOString();
        const crashed    = roundRef.current;
        setRound((prev) => (prev ? { ...prev, state: "CRASHED", crashPoint, serverSeed, crashedAt } : prev));

        // Append to round-history chips — outside the setRound updater (which can
        // run more than once) and deduped by roundId so a round is never recorded
        // twice (e.g. a re-delivered crash message).
        if (crashed) {
          const entry: HistoryRound = {
            roundId:        crashed.id,
            roundNumber:    crashed.roundNumber ?? 0,
            crashPoint,
            crashedAt,
            serverSeed,
            serverSeedHash: crashed.serverSeedHash ?? "",
            clientSeed,
            nonce: Number.isFinite(nonce) ? nonce : undefined,
          };
          setHistory((h) => {
            if (h.some((e) => e.roundId === entry.roundId)) return h;
            appendStoredHistory(entry);
            return [...h, entry].slice(-80);
          });
        }
        setMultiplier(crashPoint);
        // Did the user still have skin in the game when it flew away? Read the
        // ref (reliable inside this WS handler) so we can fire the loss cue once.
        const hadActiveBet = Object.values(myBetsRef.current).some((b) => b?.status === "ACTIVE");
        setMyBets((prev) => {
          const next = { ...prev } as MyBets;
          (Object.keys(next) as unknown as Array<0 | 1>).forEach((k) => {
            if (next[k]?.status === "ACTIVE") next[k] = { ...next[k]!, status: "LOST" };
          });
          return next;
        });
        if (hadActiveBet) toast.loss(`Flew away ${crashPoint.toFixed(2)}×`, "Bet lost — cash out earlier next time");
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
          username:    (d.username as string) ?? null,
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
    const uid   = encodeURIComponent(userId ?? "guest");
    const uname = encodeURIComponent(username ?? "Guest");
    let closed = false;

    function connect() {
      if (closed) return;
      const ws = new WebSocket(`${WS_URL}?user_id=${uid}&username=${uname}`);
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
  // Throttled to ~10 fps — the canvas has its own RAF loop and doesn't need
  // state updates; React state is only used by the bet-panel & UI labels.
  useEffect(() => {
    let lastTick = 0;
    const loop = (now: number) => {
      const r = roundRef.current;
      if (r?.state === "FLYING" && r.flyingStartedAt && now - lastTick >= 100) {
        const elapsed = Math.max(0, Date.now() - new Date(r.flyingStartedAt).getTime()) / 1000;
        const value   = 1 + elapsed / 1.5 + elapsed * elapsed * 0.005;
        setMultiplier(Math.floor(value * 100) / 100);
        lastTick = now;
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
    placed(); // instant tactile feedback the moment the bet is tapped

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
  }, [userId, username, fetchBalance]);

  const handleCashout = useCallback(async (panelIndex: 0 | 1) => {
    const bet = myBets[panelIndex];
    if (!bet || bet.status !== "ACTIVE") return;

    // Capture multiplier at the exact tap moment
    const clickedMultiplier = Math.max(1, multiplier);
    const pendingWin = Number((bet.betAmount * clickedMultiplier).toFixed(2));

    // ── INSTANT: remove cashout button so user can't double-tap ──────────────
    // Show a brief "cashing out…" shimmer until the server confirms.
    // Do NOT celebrate yet — wait for server confirmation.
    setMyBets((prev) => { const n = { ...prev }; delete n[panelIndex]; return n; });
    setCashingOut((prev) => ({ ...prev, [panelIndex]: true }));
    setBalance((b) => b + pendingWin);

    // ── INSTANT feedback: fire the cashout toast now, don't wait for the server.
    // The win celebration still fires on confirm; a rare rejection replaces this
    // with an error toast.
    toast.cashout(`Cashed out ${clickedMultiplier.toFixed(2)}×`, `+${format(pendingWin)}`);

    // ── Confirm with server (keepalive so the request isn't dropped on nav) ──
    try {
      const res = await fetch("/api/aviator/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panelIndex, betId: bet.id }),
        keepalive: true,
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Cashout failed");

      // Server confirmed — reconcile the balance to the authoritative amount.
      // The instant cashout toast already gave the user feedback (no overlay).
      const serverWin = Number((data as { winAmount: number }).winAmount);
      if (serverWin !== pendingWin) setBalance((b) => b - pendingWin + serverWin);
      window.dispatchEvent(new Event("wallet-refresh"));
    } catch (err) {
      // Server rejected — revert balance
      setBalance((b) => b - pendingWin);
      const msg = (err as Error).message ?? "Cashout failed";
      const isTimeout = /timeout|ended|too late|expired/i.test(msg);
      if (isTimeout) {
        toast.error("Too late", "Plane flew away before your cashout was processed");
      } else if (roundRef.current?.state === "FLYING") {
        setMyBets((prev) => ({ ...prev, [panelIndex]: { ...bet, status: "ACTIVE" } }));
        toast.error("Cashout failed", msg);
      } else {
        toast.error("Cashout failed", "Round ended before cashout was processed");
      }
    } finally {
      setCashingOut((prev) => {
        const next = { ...prev };
        delete next[panelIndex];
        return next;
      });
    }
  }, [multiplier, myBets]);

  const displayMult = round?.state === "CRASHED" ? (round.crashPoint ?? multiplier) : multiplier;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#31c45d]" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#151518]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-3 lg:p-3">
        <section className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {/* Mobile Top Header: Back, Balance (Spribe-style), Menu */}
          <div className="flex shrink-0 items-center justify-between px-2 py-1.5 sm:hidden">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              aria-label="Back to home"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.04] text-white/60 ring-1 ring-white/[0.06] transition active:scale-95"
            >
              <Icon name="arrow_back" className="text-[18px]" />
            </button>
            {userId && (
              <button
                type="button"
                onClick={() => openWallet()}
                aria-label="Open wallet"
                className="flex items-baseline gap-1 font-sans tracking-tight transition active:scale-95"
              >
                <RollingBalance
                  value={balance}
                  className="text-[15px] font-bold tabular-nums text-[#31c45d]"
                  format={spribeBalance}
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/[0.06] transition active:scale-95 hover:text-white"
            >
              <Icon name="menu" className="text-[18px]" />
            </button>
          </div>

          <AviatorTicker liveBets={liveBets} />

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 px-2 pb-1">
            <div className="min-w-0 flex-1 overflow-hidden">
              <AviatorHistory rounds={history} onVerify={setVerifyRound} />
            </div>
            {userId && (
              <button
                type="button"
                onClick={() => openWallet()}
                className="hidden sm:flex shrink-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 ring-1 ring-white/[0.06] transition active:scale-95 hover:bg-white/[0.1] sm:px-2.5"
              >
                <Icon name="account_balance_wallet" className="text-[13px] text-[#31c45d] sm:text-[14px]" />
                <RollingBalance
                  value={balance}
                  className="text-[10px] font-black tabular-nums text-white sm:text-[11px]"
                  format={(n) => format(n)}
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMusicEnabled((v) => !v)}
              className={`hidden sm:grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ring-white/[0.06] transition-colors ${
                musicEnabled ? "bg-white/[0.06] text-[#31c45d]" : "bg-white/[0.06] text-white/35"
              }`}
              aria-label={musicEnabled ? "Turn music off" : "Turn music on"}
              title={musicEnabled ? "Music on" : "Music off"}
            >
              <Icon name={musicEnabled ? "music_note" : "music_off"} className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mx-2 min-h-[42vh] max-h-[42vh] shrink-0 overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#151518] lg:mx-0 lg:min-h-0 lg:max-h-none lg:flex-1">
            <div className="h-full min-h-[180px]">
              <AviatorCanvas
                state={round?.state ?? "WAITING"}
                multiplier={displayMult}
                crashPoint={round?.crashPoint ?? undefined}
                bettingEndsAt={round?.bettingEndsAt ?? null}
                flyingStartedAt={round?.flyingStartedAt ?? null}
              />
            </div>
            <RoundPlayersBadge liveBets={liveBets} />
          </div>

          <div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 pb-2 lg:gap-3 lg:p-3 lg:pb-3">
            <div className="relative min-w-0">
              <AviatorBetPanel
                panelIndex={0}
                round={round}
                myBet={myBets[0]}
                currentMultiplier={displayMult}
                balance={balance}
                cashingOut={!!cashingOut[0]}
                onBet={handleBet}
                onCashout={handleCashout}
              />
            </div>
            <div className="relative min-w-0">
              <AviatorBetPanel
                panelIndex={1}
                round={round}
                myBet={myBets[1]}
                currentMultiplier={displayMult}
                balance={balance}
                cashingOut={!!cashingOut[1]}
                onBet={handleBet}
                onCashout={handleCashout}
              />
            </div>
          </div>

          {/* Spribe-style inline live-bets table (mobile only) — fills the space
              between the bet panels and the bottom nav. Desktop uses the aside. */}
          <div className="min-h-[360px] flex-1 px-1.5 pb-2 lg:hidden">
            <AviatorLiveBets
              liveBets={liveBets}
              prevBets={prevRoundBets}
              myHistory={myHistory}
              myCurrentBets={Object.values(myBets)}
              userId={userId}
            />
          </div>

          <AviatorBottomNav urlTab={urlTab} router={router} />
        </section>

        <aside className="hidden min-w-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:rounded-[10px] lg:border lg:border-white/[0.06] lg:bg-[#18191f]">
          <AviatorPlayersTable
            liveBets={liveBets}
            prevRoundBets={prevRoundBets}
            myHistory={myHistory}
            myCurrentBets={Object.values(myBets)}
            userId={userId}
            tab={playersTab}
            onTabChange={setPlayersTab}
          />
        </aside>
      </div>

      <MobilePlayersSheet
        open={playersOpen}
        onClose={closePlayersSheet}
        liveBets={liveBets}
        prevRoundBets={prevRoundBets}
        myHistory={myHistory}
        myCurrentBets={Object.values(myBets)}
        userId={userId}
        tab={playersTab}
        onTabChange={setPlayersTab}
      />

      <AviatorMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        username={username}
        musicEnabled={musicEnabled}
        onToggleMusic={() => setMusicEnabled((v) => !v)}
        soundOn={soundOn}
        onToggleSound={toggleGameSound}
        onInfo={(k) => { setInfoModal(k); setMenuOpen(false); }}
        onHistory={() => { setMenuOpen(false); router.push("/aviator?tab=mine", { scroll: false }); }}
        onHome={() => { setMenuOpen(false); router.push("/dashboard"); }}
      />

      {infoModal && (
        <AviatorInfoModal kind={infoModal} onClose={() => setInfoModal(null)} />
      )}

      {verifyRound && (
        <VerifyModal round={verifyRound} onClose={() => setVerifyRound(null)} />
      )}
    </div>
  );
}

// ─── Spribe-style hamburger menu ───────────────────────────────────────────────

function AviatorMenu({
  open, onClose, username, musicEnabled, onToggleMusic, soundOn, onToggleSound, onInfo, onHistory, onHome,
}: {
  open: boolean;
  onClose: () => void;
  username?: string;
  musicEnabled: boolean;
  onToggleMusic: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onInfo: (k: "how" | "rules" | "fair" | "limits") => void;
  onHistory: () => void;
  onHome: () => void;
}) {
  if (!open) return null;

  const links: { icon: string; label: string; onClick: () => void }[] = [
    { icon: "history",       label: "My Bet History",         onClick: onHistory },
    { icon: "verified_user", label: "Provably Fair Settings", onClick: () => onInfo("fair") },
    { icon: "speed",         label: "Game Limits",            onClick: () => onInfo("limits") },
    { icon: "help",          label: "How To Play",            onClick: () => onInfo("how") },
    { icon: "menu_book",     label: "Game Rules",             onClick: () => onInfo("rules") },
  ];

  return (
    <div className="absolute inset-0 z-[60] flex flex-col">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aviator menu"
        className="relative z-10 ml-auto mt-12 mr-2 w-[240px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1d23] shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#087cff]/20 text-[13px] font-black text-[#087cff]">
            {(username ?? "G").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-black text-white">{username ?? "Guest"}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">Aviator</p>
          </div>
        </div>

        {/* Sound toggle — win / cash-out cues (on by default) */}
        <button
          type="button"
          onClick={onToggleSound}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <span className="flex items-center gap-2.5 text-[12px] font-bold text-white/80">
            <Icon name={soundOn ? "volume_up" : "volume_off"} className="text-[18px] text-white/50" />
            Sound
          </span>
          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${soundOn ? "bg-[#31c45d]" : "bg-white/15"}`}>
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${soundOn ? "translate-x-4" : "translate-x-0.5"}`} />
          </span>
        </button>

        {/* Music toggle — looping background track (off by default) */}
        <button
          type="button"
          onClick={onToggleMusic}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <span className="flex items-center gap-2.5 text-[12px] font-bold text-white/80">
            <Icon name={musicEnabled ? "music_note" : "music_off"} className="text-[18px] text-white/50" />
            Music
          </span>
          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${musicEnabled ? "bg-[#31c45d]" : "bg-white/15"}`}>
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${musicEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </span>
        </button>

        <div className="h-px bg-white/[0.06]" />

        {/* Links */}
        {links.map((l) => (
          <button
            key={l.label}
            type="button"
            onClick={l.onClick}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] font-bold text-white/80 transition-colors hover:bg-white/[0.04]"
          >
            <Icon name={l.icon} className="text-[18px] text-white/50" />
            {l.label}
          </button>
        ))}

        <div className="h-px bg-white/[0.06]" />

        <button
          type="button"
          onClick={onHome}
          className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-[12px] font-black text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <Icon name="home" className="text-[18px]" />
          Home
        </button>
      </div>
    </div>
  );
}

const INFO_CONTENT: Record<"how" | "rules" | "fair" | "limits", { title: string; body: string[] }> = {
  how: {
    title: "How To Play",
    body: [
      "1. Place a bet before the round starts — you can run two bets at once.",
      "2. Watch the multiplier climb as the plane flies.",
      "3. Cash out before it flies away to lock in your winnings (bet × multiplier).",
      "4. If the plane flies away before you cash out, the bet is lost.",
      "Tip: use Auto Cashout to exit automatically at a target multiplier.",
    ],
  },
  rules: {
    title: "Game Rules",
    body: [
      "Each round the plane takes off and the multiplier grows from 1.00×.",
      "The round ends when the plane flies away at a random crash point.",
      "A winning payout = your stake × the multiplier at cashout.",
      "Winnings are subject to the house margin applied at cashout.",
      "Only bets placed during the betting window are accepted.",
    ],
  },
  fair: {
    title: "Provably Fair",
    body: [
      "Every crash point is generated from a server seed committed before the round.",
      "The seed hash is shown before the round; the seed is revealed after the crash.",
      "You can verify any past round from the round-history chips → Verify.",
      "This guarantees no result can be altered once betting opens.",
    ],
  },
  limits: {
    title: "Game Limits",
    body: [
      "Minimum bet: KES 10 per panel.",
      "Maximum bet: KES 50,000 per panel.",
      "Up to two simultaneous bets per round.",
      "Maximum win is capped per round per the house payout policy.",
    ],
  },
};

function AviatorInfoModal({ kind, onClose }: { kind: "how" | "rules" | "fair" | "limits"; onClose: () => void }) {
  const { title, body } = INFO_CONTENT[kind];
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1d23] shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[13px] font-black text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-white/55 transition-colors hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4 py-3.5">
          {body.map((line, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-white/70">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function AviatorBottomNav({ urlTab, router }: { urlTab: string | null; router: ReturnType<typeof useRouter> }) {
  const tabs = [
    { key: "menu",    label: "Menu",    icon: "menu",          href: null as string | null },
    { key: "play",    label: "Play",    icon: "rocket_launch", href: "/aviator" },
    { key: "players", label: "Players", icon: "groups",        href: "/aviator?tab=players" },
    { key: "mine",    label: "My Bets", icon: "receipt_long",  href: "/aviator?tab=mine" },
  ] as const;

  return (
    <nav className="fixed bottom-[max(0.6rem,env(safe-area-inset-bottom))] left-3 right-3 z-50 flex h-14 items-center justify-around gap-1 rounded-2xl border border-white/[0.08] bg-[#1c1c1e]/92 px-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden">
      {tabs.map((tab) => {
        const active =
          tab.key === "play"    ? !urlTab :
          tab.key === "players" ? urlTab === "players" :
          tab.key === "mine"    ? urlTab === "mine" :
          false;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (tab.key === "menu") window.dispatchEvent(new Event("neemiz:open-menu"));
              else router.push(tab.href!, { scroll: false });
            }}
            className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center rounded text-[9px] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087cff]/70 focus-visible:ring-inset ${
              active ? "text-[#087cff]" : "text-on-surface-variant"
            }`}
          >
            <span className="relative">
              <Icon name={tab.icon} fill={active} className="text-[20px]" />
            </span>
            <span className="mt-0.5 font-bold leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AviatorTicker({ liveBets }: { liveBets: AviatorBetPublic[] }) {
  const winners = liveBets.filter((bet) => bet.status === "CASHEDOUT" && bet.winAmount);

  return (
    <div className="shrink-0 px-2 py-1">
      <div className="flex min-w-0 gap-2 overflow-hidden rounded-full bg-[#18191a] px-2 py-0.5">
        {winners.length === 0 ? (
          <span className="px-2 py-0.5 text-[9px] font-bold text-white/30">Waiting for cashouts…</span>
        ) : (
          winners.slice(-4).map((bet) => (
            <span key={bet.id} className="shrink-0 rounded-full bg-[#242526] px-2 py-0.5 text-[9px] font-bold text-white/60">
              {maskName(bet.username)} won {(bet.winAmount ?? 0).toFixed(2)} KES{" "}
              <span className="text-[#28a909]">at {(bet.cashoutAt ?? 1).toFixed(2)}×</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// Spribe-style avatar cluster + player count, overlaid on the canvas bottom-right.
// Cashed-out players are ringed green. Shows how many are in the current round.
function RoundPlayersBadge({ liveBets }: { liveBets: AviatorBetPublic[] }) {
  if (liveBets.length === 0) return null;

  // Prioritise cashed-out players in the visible stack, then the rest.
  const ordered = [...liveBets].sort((a, b) => {
    const aCashed = a.status === "CASHEDOUT" ? 0 : 1;
    const bCashed = b.status === "CASHEDOUT" ? 0 : 1;
    return aCashed - bCashed;
  });
  const shown = ordered.slice(0, 3);

  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/45 py-0.5 pl-1 pr-2 backdrop-blur-sm">
      <div className="flex items-center">
        {shown.map((bet, i) => {
          const cashed = bet.status === "CASHEDOUT";
          return (
            <span
              key={bet.id}
              className={`grid h-5 w-5 place-items-center overflow-hidden rounded-full text-[8px] font-black text-white ring-2 ${
                cashed ? "ring-[#28a909]" : "ring-[#17181d]"
              } ${avatarColor(bet.username ?? "?")}`}
              style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shown.length - i }}
            >
              {bet.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bet.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (bet.username ?? "?").slice(0, 1).toUpperCase()
              )}
            </span>
          );
        })}
      </div>
      <span className="text-[11px] font-black tabular-nums text-white/85">{liveBets.length}</span>
    </div>
  );
}

function AviatorPlayersTable({
  liveBets, prevRoundBets, myHistory, myCurrentBets, userId,
  tab: controlledTab,
  onTabChange,
}: {
  liveBets:      AviatorBetPublic[];
  prevRoundBets: AviatorBetPublic[];
  myHistory:     MyHistoryBet[];
  myCurrentBets: AviatorBetPublic[];
  userId?: string;
  tab?: "live" | "mine" | "prev";
  onTabChange?: (t: "live" | "mine" | "prev") => void;
}) {
  const [internalTab, setInternalTab] = useState<"live" | "mine" | "prev">("live");
  const tab = controlledTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;

  // Deduplicate live bets — my current bets override any WS entry for same userId
  const myIds = new Set(myCurrentBets.map((b) => b.userId));
  const allLive = [
    ...myCurrentBets,
    ...liveBets.filter((b) => !myIds.has(b.userId)),
  ].slice(0, 30);

  const TABS = [
    { key: "live" as const, label: "Live", count: allLive.length },
    { key: "mine" as const, label: "Mine",  count: myCurrentBets.length + myHistory.length },
    { key: "prev" as const, label: "Prev",  count: prevRoundBets.length },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Tab bar */}
      <div className="grid shrink-0 grid-cols-3 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`py-2.5 text-[10px] font-black uppercase tracking-wide transition ${tab === t.key ? "border-b-2 border-[#28a909] text-[#28a909]" : "text-white/35 hover:text-white/60"}`}
          >
            {t.label} {t.count > 0 && <span className="opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid shrink-0 grid-cols-3 px-4 py-1.5 text-[9px] font-black uppercase tracking-wide text-white/25">
        <span>Player</span>
        <span className="text-center">Bet (KES)</span>
        <span className="text-right">Win (KES)</span>
      </div>

      {/* Rows */}
      <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab === "live" && (
          allLive.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-white/25">Waiting for bets…</p>
          ) : allLive.map((bet) => (
            <BetRow key={bet.id} bet={bet} isMe={bet.userId === userId} />
          ))
        )}

        {tab === "mine" && (
          <>
            {myCurrentBets.length === 0 && myHistory.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-white/25">No bets placed yet</p>
            ) : (
              <>
                {myCurrentBets.map((bet) => <BetRow key={bet.id} bet={bet} isMe />)}
                {myHistory.map((bet) => (
                  <div key={bet.id} className="grid grid-cols-3 rounded bg-white/[0.035] px-2 py-1.5 text-[11px] font-bold text-white/55">
                    <span className="truncate text-white/70">#{bet.roundNumber}</span>
                    <span className="text-center">{bet.betAmount.toFixed(2)}</span>
                    <span className="text-right">
                      {bet.winAmount ? (
                        <span className="text-[#28a909]">{bet.winAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-red-400/70">Lost</span>
                      )}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === "prev" && (
          prevRoundBets.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-white/25">No data for previous round</p>
          ) : prevRoundBets.map((bet) => (
            <BetRow key={bet.id} bet={bet} isMe={bet.userId === userId} />
          ))
        )}
      </div>
    </div>
  );
}

function BetRow({ bet, isMe }: { bet: AviatorBetPublic; isMe?: boolean }) {
  return (
    <div className={`grid grid-cols-3 rounded px-2 py-1.5 text-[11px] font-bold ${isMe ? "bg-[#3b5bdb]/15 text-white" : "bg-white/[0.035] text-white/55"}`}>
      <span className="truncate">
        {isMe ? "You" : maskName(bet.username)}
      </span>
      <span className="text-center">{bet.betAmount.toFixed(2)}</span>
      <span className="text-right">
        {bet.status === "CASHEDOUT" && bet.winAmount ? (
          <span className="rounded bg-[#28a909]/20 px-1.5 py-0.5 text-[10px] text-[#28a909]">{bet.winAmount.toFixed(2)}</span>
        ) : bet.status === "LOST" ? (
          <span className="text-red-400/70">Lost</span>
        ) : "—"}
      </span>
    </div>
  );
}

function MobilePlayersSheet({
  open,
  onClose,
  liveBets,
  prevRoundBets,
  myHistory,
  myCurrentBets,
  userId,
  tab,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  liveBets: AviatorBetPublic[];
  prevRoundBets: AviatorBetPublic[];
  myHistory: MyHistoryBet[];
  myCurrentBets: AviatorBetPublic[];
  userId?: string;
  tab?: "live" | "mine" | "prev";
  onTabChange?: (t: "live" | "mine" | "prev") => void;
}) {
  if (!open) return null;

  return (
    <div className="lg:hidden absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close players"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[70dvh] flex-col overflow-hidden rounded-t-2xl border border-white/[0.08] border-b-0 bg-[#18191f] shadow-[0_-8px_32px_rgba(0,0,0,.45)]"
        role="dialog"
        aria-modal="true"
        aria-label="Players"
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/55 ring-1 ring-white/[0.06] transition-colors hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden pb-2">
          <AviatorPlayersTable
            liveBets={liveBets}
            prevRoundBets={prevRoundBets}
            myHistory={myHistory}
            myCurrentBets={myCurrentBets}
            userId={userId}
            tab={tab}
            onTabChange={onTabChange}
          />
        </div>
      </div>
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
