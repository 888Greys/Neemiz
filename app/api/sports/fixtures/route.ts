import { NextResponse } from "next/server";
import { readLivescores } from "@/lib/fixtures-cache";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=10, stale-while-revalidate=30";

/**
 * Compact live-fixture snapshot for client soft-refresh.
 * Served from fixtures_cache (cron-filled) — zero Odds API credits.
 */
export async function GET() {
  try {
    const live = await readLivescores(200);
    return NextResponse.json(live, {
      headers: { "Cache-Control": CACHE },
    });
  } catch {
    return NextResponse.json([], {
      headers: { "Cache-Control": CACHE },
    });
  }
}
