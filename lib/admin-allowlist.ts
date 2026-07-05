// ─── Owner allowlist (defense-in-depth) ──────────────────────────────────────
// Added 2026-06-26 after an attacker with direct Supabase (postgrest) access
// repeatedly flipped `is_admin = true` on their own accounts to reach the admin
// panel. `is_admin` lives in the DB, which the attacker can write — so it can no
// longer be the sole gate. Admin access now ALSO requires the authenticated
// email to be on this allowlist, which lives in app config (env), NOT the DB.
//
// Even if `is_admin` is flipped in the database, a non-allowlisted email cannot
// mint the admin 2FA cookie or load the panel.
//
// Configure OWNER_EMAILS as a comma-separated list. The two known owner
// accounts are the built-in fallback so a missing env var fails safe (only the
// real owners), never open.

// owner@local.test is the dev-auth owner (lib/dev-auth.ts). Harmless in prod —
// dev-auth is hard-gated off there and no real Supabase user owns that address.
const FALLBACK_OWNERS = ["toxicgreys001@gmail.com", "goodhope229@gmail.com", "owner@local.test"];

function ownerEmails(): string[] {
  const fromEnv = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : FALLBACK_OWNERS;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.trim().toLowerCase());
}
