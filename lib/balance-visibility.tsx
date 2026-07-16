"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "balance-hidden";
const EVENT = "nezeem:balance-hidden";

function readHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(hidden));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { hidden } }));
}

type BalanceVisibilityContextValue = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  toggle: () => void;
};

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);

/** Shared show/hide for wallet amounts (header, profile, menu). Visible by default. */
export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    setHiddenState(readHidden());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ hidden?: boolean }>).detail;
      if (typeof detail?.hidden === "boolean") setHiddenState(detail.hidden);
      else setHiddenState(readHidden());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setHiddenState(e.newValue === "true");
    };
    window.addEventListener(EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    writeHidden(next);
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      writeHidden(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hidden, setHidden, toggle }), [hidden, setHidden, toggle]);

  return (
    <BalanceVisibilityContext.Provider value={value}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) {
    throw new Error("useBalanceVisibility must be used within BalanceVisibilityProvider");
  }
  return ctx;
}
