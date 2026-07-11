/**
 * In-tab pub/sub for live fixture patches.
 * SportsLiveRefresh polls a cacheable JSON endpoint and publishes here;
 * MatchRow / scoreboard subscribe so scores update without a full RSC refresh.
 */
import type { Match } from "@/lib/theoddsapi";

export type LiveFixturePatch = Pick<
  Match,
  "id" | "home" | "away" | "period" | "isLive" | "odds" | "listMarkets" | "extraMarkets"
>;

type Listener = (patch: LiveFixturePatch) => void;

const listeners = new Map<number, Set<Listener>>();

export function publishLivePatches(matches: LiveFixturePatch[]): void {
  for (const m of matches) {
    const set = listeners.get(m.id);
    if (!set) continue;
    for (const fn of set) {
      try {
        fn(m);
      } catch {
        /* ignore subscriber errors */
      }
    }
  }
}

export function subscribeLivePatch(id: number, fn: Listener): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(id);
  };
}

/** Merge a live poll patch onto an existing Match without dropping logos/meta. */
export function mergeLivePatch(prev: Match, patch: LiveFixturePatch): Match {
  return {
    ...prev,
    period: patch.period,
    isLive: patch.isLive,
    odds: patch.odds.length > 0 ? patch.odds : prev.odds,
    listMarkets: patch.listMarkets ?? prev.listMarkets,
    extraMarkets: patch.extraMarkets > 0 ? patch.extraMarkets : prev.extraMarkets,
    home: {
      ...prev.home,
      score: patch.home.score,
      logo: prev.home.logo ?? patch.home.logo,
    },
    away: {
      ...prev.away,
      score: patch.away.score,
      logo: prev.away.logo ?? patch.away.logo,
    },
  };
}
