"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/theoddsapi";
import { publishLivePatches } from "@/lib/sports-live-store";

const POLL_MS = 30_000;

function idsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Soft-refresh live sports list via cacheable JSON.
 * Score/odds patches go to MatchRow through the live store; a full RSC
 * refresh runs only when the live fixture set changes (appear/disappear).
 */
export function SportsLiveRefresh({
  active,
  initialIds = [],
}: {
  active: boolean;
  initialIds?: number[];
}) {
  const router = useRouter();
  const idsRef = useRef(new Set(initialIds));

  useEffect(() => {
    idsRef.current = new Set(initialIds);
  }, [initialIds]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/sports/fixtures", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        const data: unknown = await res.json();
        if (!Array.isArray(data) || cancelled) return;
        const matches = data as Match[];
        const nextIds = new Set(matches.map((m) => m.id));
        const structural = !idsEqual(idsRef.current, nextIds);

        publishLivePatches(matches);
        idsRef.current = nextIds;

        if (structural) router.refresh();
      } catch {
        /* keep last known UI */
      }
    }

    void tick();
    const id = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, router]);

  return null;
}
