import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { SIGMA_WINDOW } from "@/lib/accumulator";
import { getCalibrationTicks } from "@/lib/binary/calibration";
import { getLiveEntrySpot } from "@/lib/binary-price";
import { priceDirectionalServer, type FixedKind } from "@/lib/binary/server-price";
import type { DirectionalSide } from "@/lib/directional";

const VALID_MARKETS = ["1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "R_10", "R_25", "R_50", "R_75", "R_100", "JD10"];
/** Fixed-payout kinds priced by priceDirectionalServer (not Vanilla). */
const VALID_KINDS = ["RISE_FALL", "HIGHER_LOWER", "TOUCH_NO_TOUCH"] as const;
const SIDES_BY_KIND: Record<string, DirectionalSide[]> = {
  RISE_FALL: ["RISE", "FALL"],
  HIGHER_LOWER: ["HIGHER", "LOWER"],
  TOUCH_NO_TOUCH: ["TOUCH", "NO_TOUCH"],
};
const NEEDS_OFFSET = new Set(["HIGHER_LOWER", "TOUCH_NO_TOUCH"]);

/**
 * Advisory directional quote — same priceDirectionalServer path as
 * POST /api/directional/bet, without placing. Auth optional for demo.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rl = await rateLimit(`directional-quote:${user?.id ?? "anon"}`, 60, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let body: {
    market?: string;
    kind?: string;
    side?: string;
    sides?: string[];
    stake?: number;
    durationTicks?: number;
    barrierOffset?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { market, kind, stake, durationTicks, barrierOffset } = body;
  const sideList = Array.isArray(body.sides) && body.sides.length
    ? body.sides
    : body.side
      ? [body.side]
      : [];

  if (!market || !VALID_MARKETS.includes(market)) {
    return Response.json({ error: "Invalid market" }, { status: 400 });
  }
  if (!kind || !(VALID_KINDS as readonly string[]).includes(kind)) {
    return Response.json({ error: "Invalid kind" }, { status: 400 });
  }
  const allowed = SIDES_BY_KIND[kind];
  if (!sideList.length || sideList.some((s) => !allowed.includes(s as DirectionalSide))) {
    return Response.json({ error: "Invalid side" }, { status: 400 });
  }
  if (!Number.isFinite(stake) || (stake as number) <= 0) {
    return Response.json({ error: "Invalid stake" }, { status: 400 });
  }
  if (!Number.isInteger(durationTicks) || durationTicks! < 1 || durationTicks! > 30) {
    return Response.json({ error: "Duration must be 1–30 ticks" }, { status: 400 });
  }
  const offset = barrierOffset == null ? 0 : Number(barrierOffset);
  if (NEEDS_OFFSET.has(kind) && !Number.isFinite(offset)) {
    return Response.json({ error: "Invalid barrier" }, { status: 400 });
  }
  if (NEEDS_OFFSET.has(kind) && offset === 0) {
    return Response.json({ error: "Choose a barrier above or below the spot" }, { status: 400 });
  }

  const ticks = durationTicks!;
  const stakeVal = Number(stake);

  let entrySpot: number, marketPrices: number[], symbolEdge = 0.09;
  try {
    const [calib, entry] = await Promise.all([getCalibrationTicks(market), getLiveEntrySpot(market)]);
    marketPrices = calib.prices;
    symbolEdge = calib.edge;
    entrySpot = entry.spot;
  } catch (err) {
    console.error("directional/quote market data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Live feed unavailable, try again" }, { status: 503 });
  }
  if (marketPrices.length < SIGMA_WINDOW) {
    return Response.json({ error: "Not enough market data, try again" }, { status: 503 });
  }

  const barrier = kind === "RISE_FALL" ? null : Number((entrySpot + offset).toFixed(5));
  if (kind !== "RISE_FALL" && !(barrier! > 0)) {
    return Response.json({ error: "Invalid barrier" }, { status: 400 });
  }

  const quotes: Record<string, { accepted: true; multiplier: number; payout: number } | { accepted: false; reason: string }> = {};
  for (const side of sideList) {
    const priced = priceDirectionalServer({
      kind: kind as FixedKind,
      side: side as DirectionalSide,
      entrySpot,
      barrier,
      durationTicks: ticks,
      stake: stakeVal,
      ticks: marketPrices,
      market,
      edgeFloor: symbolEdge,
    });
    quotes[side] = priced.accepted
      ? { accepted: true, multiplier: priced.multiplier, payout: priced.payout }
      : { accepted: false, reason: priced.reason };
  }

  if (sideList.length === 1) {
    return Response.json({ ...quotes[sideList[0]], quotes, entrySpot, barrier });
  }
  return Response.json({ quotes, entrySpot, barrier });
}
