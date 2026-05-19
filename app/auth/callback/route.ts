import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// This route handles the OAuth redirect from Supabase after Google/GitHub sign-in.
// Set your Supabase Auth Redirect URL to: https://yourdomain.com/auth/callback
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error redirect to home with a message
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
