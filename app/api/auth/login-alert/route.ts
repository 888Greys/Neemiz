import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendNewLoginEmail } from "@/lib/brevo";
import { isOwnerEmail } from "@/lib/admin-allowlist";
import { checkDeviceGate, hashDeviceId } from "@/lib/device-gate";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "nezeem-device";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

// Best-effort, human-readable device label from the User-Agent header.
function describeDevice(ua: string): string {
  if (!ua) return "Unknown device";
  const os = /Windows/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux"
    : "Unknown OS";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) ? "Safari"
    : "browser";
  return `${browser} on ${os}`;
}

// Records a "new login detected" alert only for a previously unseen browser
// device. Country is shown for context but not used as a trigger: mobile IPs,
// VPNs, and carriers can change location during normal use.
//
// Also enforces DEVICE_MAX_ACCOUNTS: a brand-new account that would be the
// N+1st user on this device fingerprint is frozen (isActive=false) so promo
// farming can't bypass the pre-signup gate by clearing localStorage mid-flow.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.user_metadata ?? {};
  const avatar =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  const appUser = await getOrCreateUser(user.id, {
    email: user.email,
    imageUrl: avatar,
  });
  const ua = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const countryRaw = request.headers.get("cf-ipcountry") ?? "";
  const location = countryRaw && countryRaw !== "XX" && countryRaw !== "T1" ? countryRaw : undefined;
  const device = describeDevice(ua);
  const when = new Date().toUTCString();

  const cookieStore = cookies();
  // Stable client-provided device id (localStorage) is the primary key — it
  // survives the fire-and-forget response that the httpOnly cookie rides on, so
  // a returning browser is reliably recognized and not re-notified every login.
  let bodyDeviceId = "";
  try {
    const b = await request.json();
    if (b && typeof b.deviceId === "string") bodyDeviceId = b.deviceId.trim();
  } catch { /* no/invalid body — fall back to cookie */ }
  const cookieDeviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  const rawDeviceId = bodyDeviceId || cookieDeviceId || randomUUID();
  const hash = hashDeviceId(rawDeviceId);
  const knownDevice = await db.loginDevice.findUnique({
    where: { userId_deviceHash: { userId: appUser.id, deviceHash: hash } },
    select: { id: true },
  });

  const setDeviceCookie = (res: NextResponse) => {
    if (!cookieDeviceId) {
      res.cookies.set(DEVICE_COOKIE, rawDeviceId, {
        httpOnly: true,
        maxAge: DEVICE_COOKIE_MAX_AGE,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  };

  if (knownDevice) {
    await db.loginDevice.update({
      where: { id: knownDevice.id },
      data: { lastSeenAt: new Date(), userAgent: ua || null, lastLocation: location ?? null },
    });
    const response = NextResponse.json({ ok: true, newDevice: false });
    setDeviceCookie(response);
    return response;
  }

  // New user↔device link — enforce per-device account cap + Tor block.
  // Admins / owners skip the account-cap (still record the device for alerts).
  const bypassDeviceCap = appUser.isAdmin || isOwnerEmail(appUser.email);
  const gate = bypassDeviceCap
    ? { ok: true as const, users: 0, max: 1 }
    : await checkDeviceGate(rawDeviceId, {
        excludeUserId: appUser.id,
        req: request,
      });
  if (!gate.ok) {
    const priorDevices = await db.loginDevice.count({ where: { userId: appUser.id } });
    const accountAgeMs = Date.now() - new Date(appUser.createdAt).getTime();
    const isFreshSignup = priorDevices === 0 && accountAgeMs < 15 * 60_000;

    if (isFreshSignup || gate.code === "TOR_BLOCKED") {
      await db.user.update({
        where: { id: appUser.id },
        data: { isActive: false },
      });
    }

    const response = NextResponse.json(
      {
        ok: false,
        code: gate.code,
        error: gate.error,
        suspended: isFreshSignup || gate.code === "TOR_BLOCKED",
      },
      { status: 403 },
    );
    setDeviceCookie(response);
    return response;
  }

  await db.loginDevice.create({
    data: {
      userId: appUser.id,
      deviceHash: hash,
      userAgent: ua || null,
      lastLocation: location ?? null,
    },
  });

  const response = NextResponse.json({ ok: true, newDevice: true });
  setDeviceCookie(response);

  await db.notification.create({
    data: {
      userId: appUser.id,
      type: "security_login",
      title: "New login detected",
      body: `New sign-in from ${device} (${ip}${location ? `, ${location}` : ""}) at ${when}. If this wasn't you, secure your account immediately.`,
      link: "/profile",
    },
  });

  if (appUser.email) {
    try {
      await sendNewLoginEmail(appUser.email, appUser.firstName ?? appUser.username ?? "", {
        when,
        device: escapeHtml(device),
        ip: escapeHtml(ip),
        location: location ? escapeHtml(location) : undefined,
      });
    } catch {
      // Email is best-effort; the in-app notification already recorded the event.
    }
  }

  return response;
}
