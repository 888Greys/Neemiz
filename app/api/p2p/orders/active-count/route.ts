import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/p2p/orders/active-count — number of live orders that involve the
// current user (as buyer OR as the merchant/seller) and still need attention.
// Powers the red-dot badge on the P2P "My Orders" tab.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ count: 0 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    const merchant = await db.merchantProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true },
    });

    const count = await db.p2POrder.count({
      where: {
        status: { in: ["PENDING", "PAID"] },
        OR: [
          { buyerId: dbUser.id },
          ...(merchant ? [{ sellerId: merchant.id }] : []),
        ],
      },
    });

    return Response.json({ count }, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" },
    });
  } catch (err) {
    console.error("GET /api/p2p/orders/active-count:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ count: 0 });
  }
}
