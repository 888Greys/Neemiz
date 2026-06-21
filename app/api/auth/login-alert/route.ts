import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendNewLoginEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "nezeem-device";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function deviceHash(deviceId: string) {
  return createHash("sha256").update(deviceId).digest("hex");
}

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
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getOrCreateUser(user.id, { email: user.email });
  const ua = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const countryRaw = request.headers.get("cf-ipcountry") ?? "";
  const location = countryRaw && countryRaw !== "XX" ? countryRaw : undefined;
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
  const knownDevice = await db.loginDevice.findUnique({
    where: { userId_deviceHash: { userId: appUser.id, deviceHash: deviceHash(rawDeviceId) } },
    select: { id: true },
  });

  const response = NextResponse.json({ ok: true, newDevice: !knownDevice });
  if (!cookieDeviceId) {
    response.cookies.set(DEVICE_COOKIE, rawDeviceId, {
      httpOnly: true,
      maxAge: DEVICE_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  if (knownDevice) {
    await db.loginDevice.update({
      where: { id: knownDevice.id },
      data: { lastSeenAt: new Date(), userAgent: ua || null, lastLocation: location ?? null },
    });
    return response;
  }

  await db.loginDevice.create({
    data: {
      userId: appUser.id,
      deviceHash: deviceHash(rawDeviceId),
      userAgent: ua || null,
      lastLocation: location ?? null,
    },
  });

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
