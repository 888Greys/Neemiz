import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// GET /api/crypto/balance — return the signed-in user's on-platform crypto balances
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const balances = await db.userCryptoBalance.findMany({
    where:   { userId: dbUser.id },
    orderBy: { crypto: "asc" },
    select: {
      crypto:    true,
      network:   true,
      available: true,
      locked:    true,
      updatedAt: true,
    },
  });

  return Response.json(
    balances.map((b) => ({
      crypto:    b.crypto,
      network:   b.network,
      available: Number(b.available),
      locked:    Number(b.locked),
      total:     Number(b.available) + Number(b.locked),
      updatedAt: b.updatedAt,
    })),
  );
}
