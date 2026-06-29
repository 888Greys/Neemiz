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
        select: { isActive: true },
      });
      if (account?.isActive === false) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${appUrl}/suspended`);
      }
      return NextResponse.redirect(`${appUrl}${next}`);
    }
  }

  // On error redirect to home with a message
  return NextResponse.redirect(`${appUrl}/?auth_error=1`);
}
