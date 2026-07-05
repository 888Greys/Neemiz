/**
 * POST /api/auth/passkey/register/options
 * Authed. Returns WebAuthn registration options for enrolling a passwordless
 * sign-in passkey, and stashes the challenge in a short-lived httpOnly cookie.
 */
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { rpConfig, RP_NAME, REG_CHALLENGE_COOKIE, CHALLENGE_TTL_SECONDS } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    include: { passkeys: true },
  });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { rpID } = rpConfig(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: dbUser.email ?? dbUser.username ?? dbUser.id,
    userDisplayName: dbUser.username ?? dbUser.email ?? "Nezeem user",
    userID: new TextEncoder().encode(dbUser.id),
    attestationType: "none",
    excludeCredentials: dbUser.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    // Resident (discoverable) key so the user can sign in without typing an
    // identifier first; platform authenticator = Face ID / fingerprint.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  const jar = await cookies();
  jar.set(REG_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: CHALLENGE_TTL_SECONDS,
  });

  return Response.json(options);
}
