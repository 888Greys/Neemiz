import { cookies } from "next/headers";
import {
  DEV_AUTH_ENABLED,
  DEV_COOKIE,
  devAccountByCreds,
  devAccountByKey,
  devSupabaseUser,
} from "@/lib/dev-auth";
import { createAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";

// Dev-only local auth endpoint. Returns 404 unless DEV_AUTH is on and we're not
// in production, so it simply doesn't exist in a real deployment.
//   GET    → current dev user (or null)
//   POST   → { email, password } or { key: "a" | "b" } → set cookie, log in
//   DELETE → clear cookie, log out
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function GET() {
  if (!DEV_AUTH_ENABLED) return Response.json({ error: "Not found" }, { status: 404 });
  const c = await cookies();
  const acct = devAccountByKey(c.get(DEV_COOKIE)?.value);
  return Response.json({ user: acct ? devSupabaseUser(acct) : null });
}

export async function POST(req: Request) {
  if (!DEV_AUTH_ENABLED) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { email?: string; password?: string; key?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const acct = body.key
    ? devAccountByKey(body.key)
    : devAccountByCreds(body.email ?? "", body.password ?? "");
  if (!acct) return Response.json({ error: "Invalid dev credentials" }, { status: 401 });

  const c = await cookies();
  c.set(DEV_COOKIE, acct.key, COOKIE_OPTS);
  if (acct.isAdmin) {
    c.set(COOKIE_NAME, createAdminToken("local-dev-owner"), { ...COOKIE_OPTS, maxAge: 60 * 60 * 8 });
  } else {
    c.delete(COOKIE_NAME);
  }
  return Response.json({ user: devSupabaseUser(acct) });
}

export async function DELETE() {
  if (!DEV_AUTH_ENABLED) return Response.json({ error: "Not found" }, { status: 404 });
  const c = await cookies();
  c.delete(DEV_COOKIE);
  c.delete(COOKIE_NAME);
  return Response.json({ ok: true });
}
