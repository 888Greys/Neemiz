import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { getMarketDetail } from "@/lib/admin/market-detail";
import { MARKET_KEYS, todayWindow, yesterdayWindow, windowOf, monthToDateWindow, type MarketKey, type Window } from "@/lib/admin/metrics";
import { cookies } from "next/headers";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return true;
}

// KPI window selector for the deep-dive. The 14-day GGR series is fixed.
function rangeWindow(range: string | null): Window {
  switch (range) {
    case "yesterday": return yesterdayWindow();
    case "7d": return windowOf(7);
    case "mtd": return monthToDateWindow();
    case "all": return windowOf(3650);
    default: return todayWindow();
  }
}

export async function GET(req: Request, { params }: { params: { key: string } }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const key = params.key as MarketKey;
  if (!MARKET_KEYS.includes(key)) return Response.json({ error: "Unknown market" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const detail = await getMarketDetail(key, {
    window: rangeWindow(searchParams.get("range")),
    country: "KE",
  });

  return Response.json(detail, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
