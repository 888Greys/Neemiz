import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/admin/p2p/deposits — list pending crypto deposit requests
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const deposits = await db.p2PCryptoDeposit.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      merchant: {
        select: {
          id: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return Response.json(deposits);
}
