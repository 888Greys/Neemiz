import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendNewLoginEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";

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

// Records a "new login detected" alert (in-app notification + email). Called by
// the client auth listener on SIGNED_IN. Catches every sign-in method (OAuth,
// OTP, passkey) because they all emit SIGNED_IN. Deduped client-side per session
// and server-side per ~2 minutes so refreshes/tabs don't re-fire.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getOrCreateUser(user.id, { email: user.email });

  const recent = await db.notification.findFirst({
    where: {
      userId: appUser.id,
      type: "security_login",
      createdAt: { gte: new Date(Date.now() - 2 * 60_000) },
    },
    select: { id: true },
  });
  if (recent) return Response.json({ ok: true, deduped: true });

  const ua = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const countryRaw = request.headers.get("cf-ipcountry") ?? "";
  const location = countryRaw && countryRaw !== "XX" ? countryRaw : undefined;
  const device = describeDevice(ua);
  const when = new Date().toUTCString();

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

  return Response.json({ ok: true });
}
