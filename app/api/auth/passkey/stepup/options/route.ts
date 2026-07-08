/**
 * POST /api/auth/passkey/stepup/options
 * Signed-in only. Returns WebAuthn authentication options to CONFIRM the current
 * user (withdrawal step-up), scoped to that user's own sign-in passkeys. There
 * is no separate "withdrawal passkey" — the same sign-in passkeys are reused.
 * Challenge is stashed in a short-lived httpOnly cookie.
 */
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { rpConfig, STEPUP_CHALLENGE_COOKIE, CHALLENGE_TTL_SECONDS } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true } });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const passkeys = await db.passkey.findMany({
    where: { userId: dbUser.id },
    select: { credentialId: true, transports: true },
  });
  if (passkeys.length === 0) {
    return Response.json({ error: "No passkey on this account.", noPasskey: true }, { status: 404 });
  }

  const { rpID } = rpConfig(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    // Restrict to THIS user's credentials so step-up can only be satisfied by
    // one of their own passkeys (not any discoverable credential).
    allowCredentials: passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
  });

  const jar = await cookies();
  jar.set(STEPUP_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: CHALLENGE_TTL_SECONDS,
  });

  return Response.json(options);
}
