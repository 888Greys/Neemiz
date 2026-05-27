import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { generateTotpSecret, totpUri } from "@/lib/admin-2fa";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, isAdmin: true, email: true, totpEnabled: true },
  });
  if (!dbUser?.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (dbUser.totpEnabled) return Response.json({ error: "2FA already enabled — disable first" }, { status: 409 });

  const secret = generateTotpSecret();

  // Save secret (not yet enabled — enabled after first successful verify)
  await db.user.update({
    where: { id: dbUser.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const email = user.email ?? dbUser.email ?? "admin";
  const uri = totpUri(secret, email);

  return Response.json({ secret, uri });
}
