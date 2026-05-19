import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, {
    email: user.email,
    phone: user.phone,
    username: user.user_metadata?.username,
    firstName: user.user_metadata?.first_name,
    lastName: user.user_metadata?.last_name,
  });

  return Response.json({
    balance: Number(dbUser.walletBalance),
    currency: dbUser.currency,
  });
}
