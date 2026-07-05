/**
 * POST /api/auth/passkey/login/verify
 * Public. Verifies the authentication response against the stored credential,
 * and — on success — mints a Supabase session for the credential's owner.
 *
 * GoTrue has no "primary login from a passkey" endpoint, so we mint the session
 * ourselves: verify the assertion, then use the service-role admin API to
 * generate a magic-link token_hash for the user. The client exchanges that
 * token_hash via supabase.auth.verifyOtp() to establish the session cookies.
 * generateLink only *generates* — it does not send an email.
 *
 * Body: { response: AuthenticationResponseJSON }
 */
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rpConfig, LOGIN_CHALLENGE_COOKIE } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const jar = await cookies();
  const expectedChallenge = jar.get(LOGIN_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return Response.json({ error: "Your passkey sign-in expired. Please try again." }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { response?: { id?: string } } | null;
  const credentialId = body?.response?.id;
  if (!credentialId) return Response.json({ error: "Missing passkey response." }, { status: 400 });

  const passkey = await db.passkey.findUnique({
    where: { credentialId },
    include: { user: true },
  });
  if (!passkey) return Response.json({ error: "This passkey isn't registered. Use your password." }, { status: 400 });

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
    return Response.json({ error: "Passkey sign-in could not be verified." }, { status: 400 });
  }
  jar.delete(LOGIN_CHALLENGE_COOKIE);

  if (!verification.verified) {
    return Response.json({ error: "Passkey sign-in could not be verified." }, { status: 400 });
  }

  // Bump the signature counter (clone/replay detection) and record last use.
  await db.passkey.update({
    where: { id: passkey.id },
    data:  { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
  }).catch(() => {});

  if (!passkey.user.isActive) {
    return Response.json({ error: "This account is suspended." }, { status: 403 });
  }

  // Mint the session via the GoTrue admin API.
  const admin = createAdminClient();
  const { data: gotrue, error: guErr } = await admin.auth.admin.getUserById(passkey.user.supabaseId);
  const email = gotrue?.user?.email;
  if (guErr || !email) {
    return Response.json({ error: "Could not start your session. Use your password." }, { status: 500 });
  }
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    return Response.json({ error: "Could not start your session. Use your password." }, { status: 500 });
  }

  return Response.json({ ok: true, tokenHash });
}
