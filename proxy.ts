import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEV_AUTH_ENABLED, DEV_COOKIE, devAccountByKey } from "@/lib/dev-auth";

const PROTECTED = [
  "/wallet",
  "/profile",
  "/admin",
];

const ADMIN_COOKIE    = "__nezeem_a2fa";
const USER_2FA_COOKIE = "__nezeem_u2fa";

function isProtected(pathname: string) {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// The Supabase auth cookie name is `sb-<url-host-first-label>-auth-token` (see
// @supabase/ssr / supabase-js defaultStorageKey). For www.nezeem.com that's
// `sb-www-auth-token`.
function currentAuthCookieBase(): string | null {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
    return `sb-${host.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

// Expire ORPHANED Supabase auth cookies left by an earlier project ref — most
// notably the pre-migration cloud ref (`sb-bxntlwwy-auth-token*`) which never
// gets overwritten because the self-hosted cookie has a different name. Left
// alone they pile up alongside the live cookie and blow past the edge proxy's
// header/cookie size cap → Cloudflare 400 "Request header or cookie too large",
// which surfaced as the passkey-enroll "Unexpected token 'R'" failure. Only the
// CURRENT project's cookies are kept.
function clearStaleAuthCookies(request: NextRequest, response: NextResponse) {
  const base = currentAuthCookieBase();
  for (const { name } of request.cookies.getAll()) {
    const isSupabaseAuth =
      /^sb-.+-auth-token(\.\d+)?$/.test(name) ||
      /^sb-.+-auth-token-code-verifier$/.test(name) ||
      name === "sb-access-token" ||
      name === "sb-refresh-token";
    if (!isSupabaseAuth) continue;
    // Keep the live project's cookie + its chunks + its code-verifier.
    if (base && (name === base || name.startsWith(base + ".") || name === base + "-code-verifier")) continue;
    response.cookies.set(name, "", { maxAge: 0, path: "/", expires: new Date(0) });
  }
  return response;
}

export default async function middleware(request: NextRequest) {
  // Dev-only local auth: gate protected routes off the dev cookie, skip Supabase
  // and 2FA entirely. Hard-gated by NODE_ENV inside DEV_AUTH_ENABLED.
  if (DEV_AUTH_ENABLED) {
    const signedIn = !!devAccountByKey(request.cookies.get(DEV_COOKIE)?.value);
    if (!signedIn && isProtected(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // If Supabase env vars are missing (e.g. not yet set in Vercel),
  // let all requests through rather than crashing into a redirect loop.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { pathname } = request.nextUrl;

  try {
    // Refresh session — IMPORTANT: do NOT remove this call
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return clearStaleAuthCookies(request, NextResponse.redirect(url));
    }

    // Admin 2FA: admin routes without the admin session cookie → /admin/2fa
    const isAdminRoute   = pathname === "/admin" || pathname.startsWith("/admin/");
    const isAdmin2FAPage = pathname === "/admin/2fa" || pathname.startsWith("/admin/2fa/");
    if (user && isAdminRoute && !isAdmin2FAPage && !request.cookies.get(ADMIN_COOKIE)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/2fa";
      return clearStaleAuthCookies(request, NextResponse.redirect(url));
    }

    // User 2FA: if user_metadata.totp_enabled and no verified session cookie → /2fa
    const isUser2FAPage  = pathname === "/2fa";
    const hasTotpEnabled = user?.user_metadata?.totp_enabled === true;
    if (
      user &&
      hasTotpEnabled &&
      !isUser2FAPage &&
      !isAdmin2FAPage &&
      isProtected(pathname) &&
      !request.cookies.get(USER_2FA_COOKIE)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/2fa";
      url.searchParams.set("next", pathname);
      return clearStaleAuthCookies(request, NextResponse.redirect(url));
    }
  } catch {
    // If session refresh fails, let the request through rather than looping.
  }

  return clearStaleAuthCookies(request, supabaseResponse);
}

export const config = {
  matcher: [
    "/wallet/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/2fa",
  ],
};
