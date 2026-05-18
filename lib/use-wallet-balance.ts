"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

type WalletState = {
  balance: number;
  currency: string;
  loading: boolean;
};

export function useWalletBalance() {
  const { isSignedIn } = useAuth();
  const [state, setState] = useState<WalletState>({ balance: 0, currency: "KES", loading: false });

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        setState({ balance: data.balance, currency: data.currency, loading: false });
      }
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [isSignedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
