/**
 * POST /api/auth/2fa/setup
 * Generates a fresh TOTP secret and returns the QR code URI.
 * Does NOT enable 2FA yet — the user must confirm with a valid code first
 * via POST /api/auth/2fa/enable.
 */
import { createClient } from "@/lib/supabase/server";
import { generateTotpSecret, totpUri } from "@/lib/user-2fa";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateTotpSecret();
  const email  = user.email ?? user.phone ?? user.id;
  const uri    = totpUri(secret, email, "Nezeem");

  // Return secret + URI; not saved yet — enable route does that after code verify
  return Response.json({ secret, uri });
}
