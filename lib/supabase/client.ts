import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Enable the experimental WebAuthn/passkey API (auth.signInWithPasskey,
    // auth.registerPasskey, auth.passkey.*). Passkeys are also enabled in the
    // Supabase dashboard (Authentication → Passkeys).
    { auth: { experimental: { passkey: true } } }
  );
}
