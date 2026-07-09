import { NextResponse } from "next/server";
import { MOCK_LIVE } from "@/lib/theoddsapi";
import { readLivescores } from "@/lib/fixtures-cache";
import { getDisplayLiveMatches } from "@/lib/apisports";

export const revalidate = 60;

export async function GET() {
  try {
    // 1) Free API-Football: real live + today's World Cup / major fixtures
    const free = await getDisplayLiveMatches(8);
    if (free.length > 0) {
      return NextResponse.json(free);
    }

    // 2) Odds API cache (when cron has filled it)
    if (process.env.ODDS_API_KEY) {
      const cached = await readLivescores(8);
      if (cached.length > 0) return NextResponse.json(cached.slice(0, 8));
    }

    // 3) Last resort mock (logos attached)
    return NextResponse.json(MOCK_LIVE.slice(0, 8));
  } catch {
    return NextResponse.json(MOCK_LIVE.slice(0, 8));
  }
}
