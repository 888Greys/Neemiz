import "server-only";

/**
 * Derive the WebAuthn Relying Party ID + expected origin from the incoming
 * request. rpID is the registrable domain (hostname, no port/scheme); origin is
 * the full scheme://host[:port]. Deriving from the request keeps this correct
 * across prod (www.nezeem.com), staging (nez-test.nezeem.com) and localhost
 * without hardcoding.
 */
export function rpConfig(req: Request): { rpID: string; origin: string } {
  const origin =
    req.headers.get("origin") ??
    (() => {
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      const host = req.headers.get("host") ?? "www.nezeem.com";
      return `${proto}://${host}`;
    })();
  const rpID = new URL(origin).hostname;
  return { rpID, origin };
}

export const RP_NAME = "Nezeem";

// Short-lived, single-use challenge cookies (httpOnly). One per ceremony type.
export const REG_CHALLENGE_COOKIE = "pk_reg_challenge";
export const LOGIN_CHALLENGE_COOKIE = "pk_login_challenge";
export const CHALLENGE_TTL_SECONDS = 300; // 5 min to complete the browser prompt
