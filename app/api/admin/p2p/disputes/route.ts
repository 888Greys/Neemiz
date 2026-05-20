import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/admin/p2p/disputes — list all open disputes with order details
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const disputes = await db.p2PDispute.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          id: true,
          crypto: true,
          cryptoAmount: true,
          fiatAmount: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
          buyer: {
            select: { id: true, email: true, firstName: true, lastName: true, username: true },
          },
          seller: {
            select: { id: true, displayName: true, userId: true },
          },
        },
      },
    },
  });

  return Response.json(disputes);
}
