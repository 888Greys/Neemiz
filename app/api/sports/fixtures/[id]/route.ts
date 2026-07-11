import { NextResponse } from "next/server";
import { readFixtureDetail } from "@/lib/fixtures-cache";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=10, stale-while-revalidate=30";

type Ctx = { params: { id: string } };

/**
 * Single-fixture live snapshot (score / period / markets) for detail soft-refresh.
 * Cache-only — never hits Odds API or API-Football on the poll path.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const detail = await readFixtureDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        match: detail.match,
        markets: detail.markets,
        homePeriodScores: detail.homePeriodScores,
        awayPeriodScores: detail.awayPeriodScores,
      },
      { headers: { "Cache-Control": CACHE } },
    );
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
