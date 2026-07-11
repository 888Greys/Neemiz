"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Match } from "@/lib/theoddsapi";

type Scoreboard = {
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number | null;
  awayScore: number | null;
  period: string;
  isLive: boolean;
  homePeriodScores: (number | null)[];
  awayPeriodScores: (number | null)[];
};

function TeamCrest({ name, logo, size = 36 }: { name: string; logo?: string; size?: number }) {
  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-black tracking-wide text-white/55 ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

const POLL_MS = 30_000;

/**
 * Live fixture scoreboard: polls a cacheable JSON snapshot instead of
 * router.refresh() every 30s. Full RSC refresh only when the match leaves live.
 */
export function LiveFixtureRefresh({
  active,
  fixtureId,
  initial,
}: {
  active: boolean;
  fixtureId: number;
  initial: Scoreboard;
}) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  const applyMatch = useCallback((match: Match, periods?: {
    homePeriodScores?: (number | null)[];
    awayPeriodScores?: (number | null)[];
  }) => {
    setBoard((prev) => ({
      ...prev,
      homeScore: match.home.score,
      awayScore: match.away.score,
      period: match.period,
      isLive: match.isLive,
      homePeriodScores: periods?.homePeriodScores ?? prev.homePeriodScores,
      awayPeriodScores: periods?.awayPeriodScores ?? prev.awayPeriodScores,
    }));
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/sports/fixtures/${fixtureId}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json() as {
          match?: Match;
          homePeriodScores?: (number | null)[];
          awayPeriodScores?: (number | null)[];
        };
        if (!data.match || cancelled) return;
        applyMatch(data.match, data);
        if (!data.match.isLive) router.refresh();
      } catch {
        /* keep SSR scoreboard */
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
  }, [active, applyMatch, fixtureId, router]);

  const { homeName, awayName, homeLogo, awayLogo, homeScore, awayScore, period, isLive, homePeriodScores, awayPeriodScores } = board;

  return (
    <div className="sticky top-[52px] z-20 border-b border-white/[0.06] bg-[#151518]/95 px-4 py-3.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TeamCrest name={homeName} logo={homeLogo} size={36} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-black text-white">{homeName}</span>
          {(isLive || homeScore !== null) && (
            <span className="font-mono text-[20px] font-black tabular-nums text-white">
              {homeScore ?? 0}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 px-1">
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded bg-[#ff1979]/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#ff1979]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff1979]" />
              {period && period.toLowerCase() !== "live" ? period : "Live"}
            </span>
          ) : homeScore !== null ? (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">FT</span>
          ) : (
            <span className="text-[11px] font-black text-slate-600">VS</span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {(isLive || awayScore !== null) && (
            <span className="font-mono text-[20px] font-black tabular-nums text-white">
              {awayScore ?? 0}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-right text-[14px] font-black text-white">
            {awayName}
          </span>
          <TeamCrest name={awayName} logo={awayLogo} size={36} />
        </div>
      </div>

      {(homePeriodScores[0] !== null || homePeriodScores[1] !== null) && (
        <div className="mx-auto mt-2.5 flex max-w-xs justify-center gap-6 text-[11px] font-bold text-slate-500">
          <span>
            1H {homePeriodScores[0] ?? "-"}–{awayPeriodScores[0] ?? "-"}
          </span>
          <span>
            2H {homePeriodScores[1] ?? "-"}–{awayPeriodScores[1] ?? "-"}
          </span>
        </div>
      )}
    </div>
  );
}
