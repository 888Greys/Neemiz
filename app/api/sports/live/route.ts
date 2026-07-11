import { NextResponse } from "next/server";
import { readLivescores } from "@/lib/fixtures-cache";
import { getDisplayLiveMatches } from "@/lib/apisports";

export const revalidate = 60;

const CACHE = "public, s-maxage=10, stale-while-revalidate=30";

export async function GET() {
  try {
    // Prefer Odds cache (real bookmaker odds) when cron has filled it.
    if (process.env.ODDS_API_KEY) {
      const cached = await readLivescores(8);
      if (cached.length > 0) {
        return NextResponse.json(cached.slice(0, 8), {
          headers: { "Cache-Control": CACHE },
        });
      }
    }

    // Free API-Football: live / today's fixtures (may lack odds).
    const free = await getDisplayLiveMatches(8);
    if (free.length > 0) {
      return NextResponse.json(free, {
        headers: { "Cache-Control": CACHE },
      });
    }

    return NextResponse.json([], { headers: { "Cache-Control": CACHE } });
  } catch {
    return NextResponse.json([], { headers: { "Cache-Control": CACHE } });
  }
}
