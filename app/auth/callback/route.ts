import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

// This route handles the OAuth redirect from Supabase after Google/GitHub sign-in.
// Supabase Auth Redirect URL: https://www.nezeem.com/auth/callback
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/dashboard";
  // Redirect back to the origin the request actually arrived on when running
  // locally; otherwise use the configured public URL (prod sits behind a proxy
  // where the request host isn't the public domain). This keeps local OAuth on
  // localhost instead of bouncing to www.nezeem.com.
  const reqUrl = new URL(request.url);
  const isLocal = reqUrl.hostname === "localhost" || reqUrl.hostname === "127.0.0.1";
  const appUrl = isLocal
    ? reqUrl.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nezeem.com").replace(/\/+$/, "");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // TEMP DIAGNOSTIC: surface why OAuth code exchange fails (PKCE/cookie/etc).
      const cookieNames = request.headers
        .get("cookie")
        ?.split(";")
        .map((c) => c.trim().split("=")[0])
        .filter((n) => n.includes("supabase") || n.includes("sb-") || n.includes("auth"))
        .join(",");
      console.error(
        `[auth/callback] exchange failed host=${new URL(request.url).host} status=${error.status} msg="${error.message}" authCookies=[${cookieNames ?? ""}]`,
      );
    }
    if (!error && data.user) {
      const account = await db.user.findUnique({
        where: { supabaseId: data.user.id },
        select: { isActive: true, phone: true },
      });
      if (account?.isActive === false) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${appUrl}/suspended`);
      }

      // Google/GitHub sign-ins arrive already email-verified (the provider
      // confirms the address), so there's no OTP to send. But new social
      // sign-ups still have no withdrawal phone on file. Flag those so the app
      // shows a brief "Email verified ✓" confirmation and then hard-blocks on
      // the phone-number step, matching the email-OTP flow's end state.
      const needsPhone = !account || !account.phone;

      // Shrink the session cookie: Google returns several bulky, app-unused
      // user_metadata keys — `picture` duplicates `avatar_url`, and iss/sub/
      // provider_id are redundant. They inflate the JWT (embedded in the auth
      // cookie) and, for heavy-cookie users, help trip the edge proxy's header
      // size cap. Drop them; keep avatar_url/full_name/name/email. Best effort —
      // never block login on it.
      const md = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const BULKY_KEYS = ["picture", "iss", "sub", "provider_id"];
      if (BULKY_KEYS.some((k) => md[k] != null)) {
        const cleared: Record<string, null> = {};
        for (const k of BULKY_KEYS) cleared[k] = null;
        await supabase.auth.updateUser({ data: cleared }).catch(() => {});
      }

      const dest = new URL(`${appUrl}${next}`);
      if (needsPhone) dest.searchParams.set("verified", "1");
      return NextResponse.redirect(dest.toString());
    }
  }

  // On error redirect to home with a message
  return NextResponse.redirect(`${appUrl}/?auth_error=1`);
}
