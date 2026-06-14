import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

// This route handles the OAuth redirect from Supabase after Google/GitHub sign-in.
// Set your Supabase Auth Redirect URL to: https://yourdomain.com/auth/callback
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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
        return NextResponse.redirect(`${origin}/suspended`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error redirect to home with a message
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
