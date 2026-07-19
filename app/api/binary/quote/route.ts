import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getCalibrationTicks } from "@/lib/binary/calibration";
import { getLiveEntrySpot } from "@/lib/binary-price";
import { priceDigitServer, resolveDigitEdgeFloor } from "@/lib/binary/server-price";
import { exitDigitFromQuote, type DigitSide } from "@/lib/binary/kernel";

const VALID_MARKETS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
const VALID_SIDES = ["Even", "Odd", "Matches", "Differs", "Over", "Under"];

/**
 * Advisory digit quote — same priceDigitServer path as POST /api/binary/bet,
 * without placing. Display-only; place remains authoritative.
 *
 * Auth optional so demo mode can show live multipliers too.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rlKey = `binary-quote:${user?.id ?? "anon"}`;
  const rl = await rateLimit(rlKey, 60, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: {
    market?: string;
    side?: string;
    sides?: string[];
    stake?: number;
    targetDigit?: number;
    durationTicks?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { market, stake, targetDigit, durationTicks } = body;
  const sideList = Array.isArray(body.sides) && body.sides.length
    ? body.sides
    : body.side
      ? [body.side]
      : [];

  if (!market || !VALID_MARKETS.includes(market)) {
    return Response.json({ error: "Invalid market" }, { status: 400 });
  }
  if (!sideList.length || sideList.some((s) => !VALID_SIDES.includes(s))) {
    return Response.json({ error: "Invalid side" }, { status: 400 });
  }
  if (!Number.isFinite(stake) || (stake as number) <= 0) {
    return Response.json({ error: "Invalid stake" }, { status: 400 });
  }
  if (!Number.isInteger(targetDigit) || targetDigit! < 0 || targetDigit! > 9) {
    return Response.json({ error: "Invalid target digit" }, { status: 400 });
  }
  if (sideList.includes("Over") && targetDigit! >= 9) {
    return Response.json({ error: "Invalid target: no digit is greater than 9" }, { status: 400 });
  }
  if (sideList.includes("Under") && targetDigit! <= 0) {
    return Response.json({ error: "Invalid target: no digit is less than 0" }, { status: 400 });
  }

  const ticks = Math.max(1, Math.min(30, durationTicks ?? 5));
  const stakeVal = Number(stake);

  let marketPrices: number[], symbolEdge = 0.09, entrySpot: number;
  try {
    const [calib, entry] = await Promise.all([getCalibrationTicks(market), getLiveEntrySpot(market)]);
    marketPrices = calib.prices;
    symbolEdge = calib.edge;
    entrySpot = entry.spot;
  } catch (err) {
    console.error("binary/quote market data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }

  if (marketPrices.length < 500) {
    return Response.json({ error: "Not enough market data, try again" }, { status: 503 });
  }

  const entryDigit = exitDigitFromQuote(entrySpot);
  const quotes: Record<string, { accepted: true; multiplier: number; payout: number } | { accepted: false; reason: string }> = {};

  for (const side of sideList) {
    const digitEdgeFloor = resolveDigitEdgeFloor(side as DigitSide, targetDigit!, symbolEdge);
    const priced = priceDigitServer({
      side: side as DigitSide,
      targetDigit: targetDigit!,
      durationTicks: ticks,
      stake: stakeVal,
      ticks: marketPrices,
      edgeFloor: digitEdgeFloor,
      market,
      entryDigit,
    });
    quotes[side] = priced.accepted
      ? { accepted: true, multiplier: priced.multiplier, payout: priced.payout }
      : { accepted: false, reason: priced.reason };
  }

  // Single-side convenience shape (matches common client call).
  if (sideList.length === 1) {
    const q = quotes[sideList[0]];
    return Response.json({ ...q, quotes, entryDigit });
  }

  return Response.json({ quotes, entryDigit });
}
