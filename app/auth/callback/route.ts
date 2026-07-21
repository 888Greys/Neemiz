import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

/**
 * Resolve the public origin for post-OAuth redirects.
 * NEXT_PUBLIC_APP_URL is inlined at Docker build time (usually Nezeem), so on
 * binary brand domains we must prefer X-Forwarded-Host / Host, then runtime
 * APP_URL / PRODUCT_SURFACE — never the baked Nezeem public URL.
 */
function publicAppOrigin(request: Request): { appUrl: string; isBinaryHost: boolean } {
  const reqUrl = new URL(request.url);
  const forwardedHost = (
    request.headers.get("x-forwarded-host")
    ?? request.headers.get("host")
    ?? ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  const proto = (
    request.headers.get("x-forwarded-proto")
    ?? (reqUrl.protocol === "https:" ? "https" : "http")
  )
    .split(",")[0]
    .trim();

  const host = forwardedHost || reqUrl.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.startsWith("localhost:");
  const isBinaryHost =
    process.env.PRODUCT_SURFACE === "binary"
    || /^(www\.)?(binaryoptionske|moneybinaryke)\.com(?::\d+)?$/i.test(host)
    || /^(www\.)?binarymarket\.org(?::\d+)?$/i.test(host);

  if (!isLocal && host) {
    return { appUrl: `${proto}://${host}`.replace(/\/+$/, ""), isBinaryHost };
  }

  if (isBinaryHost) {
    const runtime = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://nezeem.com";
    return { appUrl: runtime.replace(/\/+$/, ""), isBinaryHost: true };
  }

  const runtime =
    process.env.APP_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || "https://www.nezeem.com";
  return { appUrl: runtime.replace(/\/+$/, ""), isBinaryHost: false };
}

// OAuth redirect after Google/GitHub. Google always returns to shared GoTrue on
// nezeem.com/supabase-auth first; GoTrue then sends the browser to this route
// on whichever brand started login (allowlisted redirectTo).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const { appUrl, isBinaryHost } = publicAppOrigin(request);
  const defaultNext = isBinaryHost ? "/binary" : "/dashboard";
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : defaultNext;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const cookieNames = request.headers
        .get("cookie")
        ?.split(";")
        .map((c) => c.trim().split("=")[0])
        .filter((n) => n.includes("supabase") || n.includes("auth") || n.includes("sb-"))
        .join(",");
      console.error(
        `[auth/callback] exchange failed host=${new URL(request.url).host} appUrl=${appUrl} status=${error.status} msg="${error.message}" authCookies=[${cookieNames ?? ""}]`,
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

      const needsPhone = !account || !account.phone;

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

  return NextResponse.redirect(`${appUrl}/?auth_error=1`);
}
