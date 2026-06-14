import { NextResponse } from "next/server";
import { MOCK_LIVE } from "@/lib/theoddsapi";
import { readLivescores } from "@/lib/fixtures-cache";

export const revalidate = 30;

export async function GET() {
  try {
    const hasToken = Boolean(process.env.ODDS_API_KEY);
    const matches = hasToken ? await readLivescores(8) : MOCK_LIVE;
    return NextResponse.json((matches.length ? matches : MOCK_LIVE).slice(0, 8));
  } catch {
    return NextResponse.json(MOCK_LIVE.slice(0, 8));
  }
}
