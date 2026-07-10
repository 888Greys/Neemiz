import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests, clientIp } from "@/lib/rate-limit";
import { checkDeviceGate } from "@/lib/device-gate";

export const dynamic = "force-dynamic";

/**
 * Pre-signup / pre-login device check. Client sends the stable localStorage
 * deviceId; we count how many app users already share that fingerprint and
 * reject when over DEVICE_MAX_ACCOUNTS (default 1). Also blocks Tor exits
 * (Cloudflare cf-ipcountry=T1).
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`device-gate:${ip}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  let deviceId = "";
  try {
    const body = await req.json();
    if (body && typeof body.deviceId === "string") deviceId = body.deviceId.trim();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const gate = await checkDeviceGate(deviceId, { req });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, code: gate.code, error: gate.error, users: gate.users, max: gate.max },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, users: gate.users, max: gate.max });
}
