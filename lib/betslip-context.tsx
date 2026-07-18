"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type BetSelection = {
  id: string;
  matchName: string;
  market: string;
  label: string;
  value: string;
  /** Client timestamp — used to avoid pruning freshly added display-feed picks. */
  addedAt?: number;
};

type BetslipContextValue = {
  bets: BetSelection[];
  addBet: (bet: BetSelection) => void;
  removeBet: (id: string) => void;
  clearBets: () => void;
  toggleBet: (bet: BetSelection) => void;
  hasBet: (id: string) => boolean;
};

const STORAGE_KEY = "nezeem_betslip";
/** Only drop missing-fixture picks after this age (keeps AF-only display ids). */
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

function loadFromStorage(): BetSelection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BetSelection[]) : [];
  } catch {
    return [];
  }
}

export const BetslipContext = createContext<BetslipContextValue>({
  bets: [],
  addBet: () => {},
  removeBet: () => {},
  clearBets: () => {},
  toggleBet: () => {},
  hasBet: () => false,
});

function fixtureIdFromSelectionId(id: string): string | null {
  // Selection ids look like `{matchId}-{market}-{key}` (see sports-match-row).
  const matchId = id.split("-")[0];
  return matchId && /^\d+$/.test(matchId) ? matchId : null;
}

function withAddedAt(bet: BetSelection): BetSelection {
  return { ...bet, addedAt: bet.addedAt ?? Date.now() };
}

export function BetslipProvider({ children }: { children: React.ReactNode }) {
  const [bets, setBets] = useState<BetSelection[]>(loadFromStorage);

  // Persist every change to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
  }, [bets]);

  // Drop aged picks whose fixture is gone from live/upcoming (finished / ghosts).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sports/fixtures?scope=ids");
        if (!res.ok) return;
        const data = (await res.json()) as { ids?: number[] };
        if (!Array.isArray(data.ids) || data.ids.length === 0 || cancelled) return;
        const ok = new Set(data.ids.map(String));
        const cutoff = Date.now() - PRUNE_AFTER_MS;
        setBets((prev) => {
          const next = prev.filter((b) => {
            const fid = fixtureIdFromSelectionId(b.id);
            if (!fid || ok.has(fid)) return true;
            // Legacy slips (no addedAt) and picks older than 24h get pruned.
            const added = b.addedAt ?? 0;
            return added > cutoff;
          });
          return next.length === prev.length ? prev : next;
        });
      } catch {
        // Ignore network/prune errors — slip stays as-is.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasBet = useCallback((id: string) => bets.some((b) => b.id === id), [bets]);

  const addBet = useCallback((bet: BetSelection) => {
    setBets((prev) => {
      if (prev.some((b) => b.id === bet.id)) return prev;
      return [...prev, withAddedAt(bet)];
    });
  }, []);

  const removeBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBets = useCallback(() => setBets([]), []);

  const toggleBet = useCallback((bet: BetSelection) => {
    setBets((prev) => {
      if (prev.some((b) => b.id === bet.id)) return prev.filter((b) => b.id !== bet.id);
      return [...prev, withAddedAt(bet)];
    });
  }, []);

  return (
    <BetslipContext.Provider value={{ bets, addBet, removeBet, clearBets, toggleBet, hasBet }}>
      {children}
    </BetslipContext.Provider>
  );
}

export function useBetslip() {
  return useContext(BetslipContext);
}
