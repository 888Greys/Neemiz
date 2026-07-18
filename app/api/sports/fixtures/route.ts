import { NextResponse } from "next/server";
import { readLivescores, readUpcoming } from "@/lib/fixtures-cache";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=10, stale-while-revalidate=30";

/**
 * Compact fixture snapshot for client soft-refresh / betslip prune.
 * Served from fixtures_cache (cron-filled) — zero Odds API credits.
 *
 * Default: live fixtures array (sports soft-refresh).
 * ?scope=ids: { ids: number[] } of live + upcoming (betslip prune).
 */
export async function GET(req: Request) {
  try {
    const scope = new URL(req.url).searchParams.get("scope");
    if (scope === "ids") {
      const [live, upcoming] = await Promise.all([
        readLivescores(200),
        readUpcoming(300),
      ]);
      const ids = Array.from(
        new Set([...live, ...upcoming].map((m) => m.id).filter((id) => Number.isFinite(id))),
      );
      return NextResponse.json(
        { ids },
        { headers: { "Cache-Control": CACHE } },
      );
    }

    const live = await readLivescores(200);
    return NextResponse.json(live, {
      headers: { "Cache-Control": CACHE },
    });
  } catch {
    const scope = new URL(req.url).searchParams.get("scope");
    if (scope === "ids") {
      return NextResponse.json(
        { ids: [] },
        { headers: { "Cache-Control": CACHE } },
      );
    }
    return NextResponse.json([], {
      headers: { "Cache-Control": CACHE },
    });
  }
}
