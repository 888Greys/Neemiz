/**
 * POST /api/auth/passkey/register/verify
 * Authed. Verifies the registration response against the stashed challenge and
 * persists the credential (public key + counter) for passwordless login.
 * Body: { response: RegistrationResponseJSON, deviceName?: string }
 */
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { rpConfig, REG_CHALLENGE_COOKIE } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const expectedChallenge = jar.get(REG_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return Response.json({ error: "Your passkey setup expired. Please try again." }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { response?: unknown; deviceName?: string } | null;
  if (!body?.response) return Response.json({ error: "Missing registration response." }, { status: 400 });

  const { rpID, origin } = rpConfig(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return Response.json({ error: "This passkey could not be verified." }, { status: 400 });
  }
  jar.delete(REG_CHALLENGE_COOKIE);

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ error: "This passkey could not be verified." }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  try {
    await db.passkey.create({
      data: {
        userId:       dbUser.id,
        credentialId: credential.id,
        publicKey:    Buffer.from(credential.publicKey),
        counter:      BigInt(credential.counter),
        transports:   credential.transports ?? [],
        deviceName:   typeof body.deviceName === "string" ? body.deviceName.slice(0, 60) : null,
      },
    });
  } catch {
    // Unique violation → this credential is already enrolled. Treat as success.
  }

  return Response.json({ ok: true });
}
