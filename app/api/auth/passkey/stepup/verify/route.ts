/**
 * POST /api/auth/passkey/stepup/verify
 * Signed-in only. Verifies a WebAuthn assertion against ONE OF THE CURRENT
 * USER'S sign-in passkeys, as a withdrawal step-up / re-auth. On success returns
 * { ok: true } — it does NOT mint or change any session. This replaces the old
 * separate GoTrue-MFA "withdrawal passkey": the same sign-in passkeys are reused.
 *
 * Body: { response: AuthenticationResponseJSON }
 */
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { createClient } from "@/lib/supabase/server";
import { rpConfig, STEPUP_CHALLENGE_COOKIE } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { id: true } });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const expectedChallenge = jar.get(STEPUP_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return Response.json({ error: "Your passkey check expired. Please try again." }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { response?: { id?: string } } | null;
  const credentialId = body?.response?.id;
  if (!credentialId) return Response.json({ error: "Missing passkey response." }, { status: 400 });

  // The credential MUST belong to the current user — never accept another
  // account's passkey to confirm this user's withdrawal.
  const passkey = await db.passkey.findUnique({ where: { credentialId } });
  if (!passkey || passkey.userId !== dbUser.id) {
    return Response.json({ error: "That passkey isn't registered to your account." }, { status: 400 });
  }

  const { rpID, origin } = rpConfig(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body!.response as unknown as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id:         passkey.credentialId,
        publicKey:  new Uint8Array(passkey.publicKey),
        counter:    Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return Response.json({ error: "Passkey could not be verified." }, { status: 400 });
  }
  jar.delete(STEPUP_CHALLENGE_COOKIE);

  if (!verification.verified) {
    return Response.json({ error: "Passkey could not be verified." }, { status: 400 });
  }

  await db.passkey.update({
    where: { id: passkey.id },
    data:  { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
  }).catch(() => {});

  return Response.json({ ok: true });
}
