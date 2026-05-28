import { NextResponse } from "next/server";
import { getLivescores, MOCK_LIVE } from "@/lib/theoddsapi";

export const revalidate = 30;

export async function GET() {
  try {
    const hasToken = Boolean(process.env.ODDS_API_KEY);
    const matches = hasToken ? await getLivescores() : MOCK_LIVE;
    return NextResponse.json(matches.slice(0, 8));
  } catch {
    return NextResponse.json(MOCK_LIVE.slice(0, 8));
  }
}
