import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { DisputeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/admin/p2p/disputes?status=OPEN|RESOLVED  (omit for all)
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as DisputeStatus | null;

    const disputes = await db.p2PDispute.findMany({
      where: statusParam ? { status: statusParam } : undefined,
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
  } catch (err) {
    console.error("GET /api/admin/p2p/disputes:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
