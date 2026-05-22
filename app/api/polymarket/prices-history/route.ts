import { NextRequest, NextResponse } from "next/server";

const CLOB = "https://clob.polymarket.com";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tokenId  = searchParams.get("tokenId");
  const interval = searchParams.get("interval") ?? "1w";
  const fidelity = searchParams.get("fidelity") ?? "60";

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 });
  }

  const url = `${CLOB}/prices-history?market=${encodeURIComponent(tokenId)}&interval=${interval}&fidelity=${fidelity}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json({ error: "CLOB API error", status: res.status }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
