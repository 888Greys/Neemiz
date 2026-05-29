"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

export type CryptoBalance = {
  crypto:    string;
  network:   string;
  available: number;
  locked:    number;
};

type WalletState = {
  balance:        number;
  currency:       string;
  cryptoBalances: CryptoBalance[];
  loading:        boolean;
};

export function useWalletBalance() {
  const { isSignedIn } = useSupabaseAuth();
  const [state, setState] = useState<WalletState>({ balance: 0, currency: "KES", cryptoBalances: [], loading: false });

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        setState({
          balance:        data.balance,
          currency:       data.currency,
          cryptoBalances: data.cryptoBalances ?? [],
          loading:        false,
        });
      }
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [isSignedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any component can dispatch this event to make every balance display re-fetch
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("wallet-refresh", handler);
    return () => window.removeEventListener("wallet-refresh", handler);
  }, [refresh]);

  return { ...state, refresh };
}
