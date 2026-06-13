import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ authenticated: false }, { status: 401 });

  const account = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { isActive: true },
  });

  return Response.json({
    authenticated: true,
    suspended: account?.isActive === false,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
