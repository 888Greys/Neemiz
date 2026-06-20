// Dev-only local authentication.
//
// When DEV_AUTH is on (and we're NOT in production), the app authenticates a
// local "User A / User B" purely from a cookie — no remote Supabase calls. This
// lets you develop fully offline against a local Postgres DB. It is hard-gated
// by NODE_ENV so it can never activate in a production build even if the env
// var leaks. See LOCAL-DEV.md.
import type { User } from "@supabase/supabase-js";

export const DEV_AUTH_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH === "true";

// Client-side equivalent (auth-context reads this). Mirror the server flag, but
// the browser can only see NEXT_PUBLIC_* vars, so it's a separate name.
export const DEV_AUTH_PUBLIC =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_AUTH === "true";

export const DEV_COOKIE = "dev_uid";

export type DevAccount = {
  key: "owner" | "a" | "b";
  id: string;        // used as the Supabase user id == User.supabaseId in the DB
  email: string;
  password: string;
  username: string;
  isAdmin?: boolean;
};

// These ids must match the supabaseId values created by scripts/seed-local.ts.
export const DEV_ACCOUNTS: DevAccount[] = [
  { key: "owner", id: "dev-owner", email: "owner@local.test", password: "owner123", username: "owner", isAdmin: true },
  { key: "a", id: "dev-user-a", email: "usera@local.test", password: "usera123", username: "usera" },
  { key: "b", id: "dev-user-b", email: "userb@local.test", password: "userb123", username: "userb" },
];

export function devAccountByKey(key?: string | null): DevAccount | null {
  return DEV_ACCOUNTS.find((a) => a.key === key) ?? null;
}

export function devAccountByCreds(email: string, password: string): DevAccount | null {
  const e = email.trim().toLowerCase();
  return DEV_ACCOUNTS.find((a) => a.email.toLowerCase() === e && a.password === password) ?? null;
}

// Build a Supabase-User-shaped object so existing code that reads user.id /
// user.email / user.user_metadata keeps working unchanged.
export function devSupabaseUser(acct: DevAccount): User {
  const now = new Date().toISOString();
  return {
    id: acct.id,
    aud: "authenticated",
    role: "authenticated",
    email: acct.email,
    app_metadata: { provider: "dev" },
    user_metadata: { username: acct.username, totp_enabled: false },
    created_at: now,
    updated_at: now,
    last_sign_in_at: now,
    identities: [],
  } as unknown as User;
}
