import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stop the caller's running auto-trader. Any in-flight trade is left to settle
// normally (it's already staked); we just stop placing new ones.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { sessionId?: string } = {};
  try { body = await req.json(); } catch { /* sessionId optional */ }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const where = body.sessionId
    ? { id: body.sessionId, userId: dbUser.id, status: "RUNNING" as const }
    : { userId: dbUser.id, status: "RUNNING" as const };

  const result = await db.autoTradeSession.updateMany({
    where,
    data:  { status: "STOPPED", stopReason: "stopped by user" },
  });

  return Response.json({ stopped: result.count });
}
