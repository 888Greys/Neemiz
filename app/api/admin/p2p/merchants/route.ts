import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/admin/p2p/merchants — list merchant profiles by KYC status
// Query param: ?status=PENDING|APPROVED|REJECTED (defaults to PENDING)
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statusParam  = searchParams.get("status") ?? "PENDING";
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
    const kycStatus    = validStatuses.includes(statusParam) ? statusParam : "PENDING";

    const merchants = await db.merchantProfile.findMany({
      where: { kycStatus: kycStatus as "PENDING" | "APPROVED" | "REJECTED" },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    return Response.json(merchants);
  } catch (err) {
    console.error("GET /api/admin/p2p/merchants:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
