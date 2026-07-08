/**
 * POST /api/auth/stepup/password
 * Signed-in only. Verifies the current user's password SERVER-SIDE and, on
 * success, sets the short-lived step-up proof cookie that the withdraw API
 * requires. Verification is a raw GoTrue password grant so it does NOT touch the
 * caller's session cookies (unlike signInWithPassword).
 *
 * Body: { password: string }
 */
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mintStepUpToken, STEPUP_COOKIE, stepUpCookieOptions } from "@/lib/step-up";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { password?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }
  if (!body.password) return Response.json({ error: "Enter your password." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: "Auth not configured" }, { status: 503 });

  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: body.password }),
    });
  } catch {
    return Response.json({ error: "Could not verify. Please try again." }, { status: 502 });
  }

  if (!res.ok) {
    return Response.json({ error: "Incorrect password. Please try again." }, { status: 401 });
  }

  (await cookies()).set(STEPUP_COOKIE, mintStepUpToken(user.id), stepUpCookieOptions);
  return Response.json({ ok: true });
}
