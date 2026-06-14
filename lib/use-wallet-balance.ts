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

const CACHE_TTL_MS = 15_000;
const EMPTY_STATE: WalletState = {
  balance: 0,
  currency: "KES",
  cryptoBalances: [],
  loading: false,
};
let walletCache: { state: WalletState; fetchedAt: number } | null = null;
let walletRequest: Promise<WalletState> | null = null;
const walletSubscribers = new Set<(state: WalletState) => void>();

function publishWalletState(state: WalletState) {
  walletCache = { state, fetchedAt: Date.now() };
  walletSubscribers.forEach((subscriber) => subscriber(state));
}

async function fetchWalletState(force = false) {
  if (!force && walletCache && Date.now() - walletCache.fetchedAt < CACHE_TTL_MS) {
    return walletCache.state;
  }
  if (walletRequest) return walletRequest;

  walletRequest = fetch("/api/wallet/balance", force ? { cache: "no-store" } : undefined)
    .then(async (res) => {
      if (!res.ok) throw new Error("Wallet request failed");
      const data = await res.json();
      const state: WalletState = {
        balance: data.balance,
        currency: data.currency,
        cryptoBalances: data.cryptoBalances ?? [],
        loading: false,
      };
      publishWalletState(state);
      return state;
    })
    .finally(() => {
      walletRequest = null;
    });

  return walletRequest;
}

export function useWalletBalance() {
  const { isSignedIn } = useSupabaseAuth();
  const [state, setState] = useState<WalletState>(() => walletCache?.state ?? EMPTY_STATE);

  const refresh = useCallback(async (force = true) => {
    if (!isSignedIn) return;
    if (!walletCache) setState((s) => ({ ...s, loading: true }));
    try {
      setState(await fetchWalletState(force));
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setState(EMPTY_STATE);
      return;
    }
    const subscriber = (next: WalletState) => setState(next);
    walletSubscribers.add(subscriber);
    void refresh(false);
    return () => {
      walletSubscribers.delete(subscriber);
    };
  }, [isSignedIn, refresh]);

  // Any component can dispatch this event to make every balance display re-fetch
  useEffect(() => {
    const handler = () => void refresh(true);
    window.addEventListener("wallet-refresh", handler);
    return () => window.removeEventListener("wallet-refresh", handler);
  }, [refresh]);

  return { ...state, refresh };
}
