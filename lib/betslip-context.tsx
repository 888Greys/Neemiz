"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type BetSelection = {
  id: string;
  matchName: string;
  market: string;
  label: string;
  value: string;
};

type BetslipContextValue = {
  bets: BetSelection[];
  addBet: (bet: BetSelection) => void;
  removeBet: (id: string) => void;
  clearBets: () => void;
  toggleBet: (bet: BetSelection) => void;
  hasBet: (id: string) => boolean;
};

export const BetslipContext = createContext<BetslipContextValue>({
  bets: [],
  addBet: () => {},
  removeBet: () => {},
  clearBets: () => {},
  toggleBet: () => {},
  hasBet: () => false,
});

export function BetslipProvider({ children }: { children: React.ReactNode }) {
  const [bets, setBets] = useState<BetSelection[]>([]);

  const hasBet = useCallback((id: string) => bets.some((b) => b.id === id), [bets]);

  const addBet = useCallback((bet: BetSelection) => {
    setBets((prev) => {
      if (prev.some((b) => b.id === bet.id)) return prev;
      return [...prev, bet];
    });
  }, []);

  const removeBet = useCallback((id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBets = useCallback(() => setBets([]), []);

  const toggleBet = useCallback((bet: BetSelection) => {
    setBets((prev) => {
      if (prev.some((b) => b.id === bet.id)) return prev.filter((b) => b.id !== bet.id);
      return [...prev, bet];
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
