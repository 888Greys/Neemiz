import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser, SuspendedAccountError } from "@/lib/get-or-create-user";
import { redeemPromoCode } from "@/lib/promo-redeem";

export const dynamic = "force-dynamic";

/**
 * POST /api/promo/redeem
 * Body: { code: string }
 * Credits the signed-in user's main wallet when the code is valid.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  let dbUser;
  try {
    dbUser = await getOrCreateUser(user.id, {
      email: user.email,
      phone: user.phone,
      username: typeof user.user_metadata?.username === "string" ? user.user_metadata.username : null,
    });
  } catch (err) {
    if (err instanceof SuspendedAccountError) {
      return Response.json({ error: "Account suspended" }, { status: 403 });
    }
    throw err;
  }

  const result = await redeemPromoCode(dbUser.id, body.code ?? "");
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    code: result.code,
    amount: result.amount,
    balance: result.balance,
  });
}
