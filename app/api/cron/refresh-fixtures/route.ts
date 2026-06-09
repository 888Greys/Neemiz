/**
 * Cron endpoint: refreshes the server-side fixture cache from the Odds API in a
 * SINGLE pass over the in-season sports, then user page loads and settlement
 * read from the DB at zero API cost. This decouples Odds API credit spend from
 * user traffic — see lib/fixtures-cache.ts.
 *
 * VPS cron should run this on a modest interval (e.g. every 15–30 min). It is
 * the only place that spends Odds API credits for browsing data, so the
 * interval is the credit-budget knob.
 *
 * Auth mirrors the other cron routes: Bearer CRON_SECRET.
 */
import { refreshFixtureCache } from "@/lib/fixtures-cache";
import { refreshSoccerFromApiSports } from "@/lib/apisports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Opt-in evaluation path: ?provider=apisports fills the same cache from
  // API-Football (soccer) so the UI can render its logos/odds, without touching
  // the live the-odds-api path.
  const provider = new URL(req.url).searchParams.get("provider");

  try {
    const result = provider === "apisports"
      ? await refreshSoccerFromApiSports()
      : await refreshFixtureCache();
    return Response.json(result);
  } catch (err) {
    console.error("refresh-fixtures failed:", err);
    return Response.json({ ok: false, error: "refresh failed" }, { status: 500 });
  }
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
