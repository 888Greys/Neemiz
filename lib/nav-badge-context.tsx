"use client";

import { createContext, useContext } from "react";

// Lets deep descendants (e.g. the binary trader) publish a count for a
// bottom-nav tab — used to badge "Positions" with the number of open positions.
// Keyed by the nav item's panel/label (e.g. "positions").
export type NavBadgeCtx = {
  badges: Record<string, number>;
  setBadge: (key: string, count: number) => void;
};

export const NavBadgeContext = createContext<NavBadgeCtx | null>(null);

export function useNavBadge() {
  return useContext(NavBadgeContext);
}
