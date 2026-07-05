/**
 * POST /api/auth/passkey/login/options
 * Public. Returns WebAuthn authentication options for passwordless sign-in.
 * allowCredentials is empty: the credential is discoverable (resident key), so
 * the authenticator itself surfaces which account to sign in as. Challenge is
 * stashed in a short-lived httpOnly cookie.
 */
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpConfig, LOGIN_CHALLENGE_COOKIE, CHALLENGE_TTL_SECONDS } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { rpID } = rpConfig(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [],
  });

  const jar = await cookies();
  jar.set(LOGIN_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: CHALLENGE_TTL_SECONDS,
  });

  return Response.json(options);
}
