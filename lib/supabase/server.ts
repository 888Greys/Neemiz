import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEV_AUTH_ENABLED, DEV_COOKIE, devAccountByKey, devSupabaseUser } from "@/lib/dev-auth";

export async function createClient() {
  const cookieStore = await cookies();

  // Dev-only local auth: resolve the signed-in user from a cookie, no remote
  // Supabase. Only the auth methods the app actually uses are implemented.
  if (DEV_AUTH_ENABLED) {
    const acct = devAccountByKey(cookieStore.get(DEV_COOKIE)?.value);
    const user = acct ? devSupabaseUser(acct) : null;
    return {
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
        getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
        signOut: async () => ({ error: null }),
        updateUser: async () => ({ data: { user }, error: null }),
        exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: null }),
      },
    } as unknown as SupabaseClient;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies — safe to ignore in RSC context
          }
        },
      },
    }
  );
}
