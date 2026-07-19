import { createHash } from "crypto";
import { db } from "@/lib/db";

/** Max distinct app users that may share one browser/device fingerprint. */
export function deviceMaxAccounts(): number {
  const n = Number(process.env.DEVICE_MAX_ACCOUNTS ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function hashDeviceId(deviceId: string): string {
  return createHash("sha256").update(deviceId.trim()).digest("hex");
}

/**
 * Cloudflare sets cf-ipcountry=T1 for Tor exit nodes. Anonymous VPN/proxy
 * blocking is primarily a Cloudflare WAF rule (Managed Rules → Anonymous IP /
 * Bot Fight Mode) — app-level can only see Tor reliably without a paid IP API.
 */
export function isTorExit(req: Request): boolean {
  const cc = (req.headers.get("cf-ipcountry") ?? "").toUpperCase();
  return cc === "T1";
}

export async function countUsersOnDevice(deviceHash: string): Promise<number> {
  // Admins / ops testers don't consume the per-device slot — otherwise you
  // can't switch between test accounts on one phone.
  const rows = await db.loginDevice.findMany({
    where: { deviceHash, user: { isAdmin: false } },
    distinct: ["userId"],
    select: { userId: true },
  });
  return rows.length;
}

export type DeviceGateResult =
  | { ok: true; users: number; max: number }
  | { ok: false; code: "DEVICE_LIMIT" | "TOR_BLOCKED"; users: number; max: number; error: string };

/**
 * Whether this device may attach another account (signup or first login link).
 * `excludeUserId` — when re-checking for an existing user who already owns a
 * row on this device, don't count them against the cap.
 */
export async function checkDeviceGate(
  deviceId: string,
  opts?: { excludeUserId?: string; req?: Request },
): Promise<DeviceGateResult> {
  const max = deviceMaxAccounts();

  if (opts?.req && isTorExit(opts.req)) {
    return {
      ok: false,
      code: "TOR_BLOCKED",
      users: 0,
      max,
      error: "Sign-ups from Tor / anonymous networks aren't allowed. Disable Tor or VPN and try again.",
    };
  }

  const id = deviceId.trim();
  if (!id) {
    // No device id → allow (server cookie will be set later); IP rate limits still apply.
    return { ok: true, users: 0, max };
  }

  const deviceHash = hashDeviceId(id);
  let users = await countUsersOnDevice(deviceHash);
  if (opts?.excludeUserId) {
    const already = await db.loginDevice.findUnique({
      where: { userId_deviceHash: { userId: opts.excludeUserId, deviceHash } },
      select: { id: true },
    });
    if (already) return { ok: true, users, max };
  }

  if (users >= max) {
    return {
      ok: false,
      code: "DEVICE_LIMIT",
      users,
      max,
      error: `This device already has ${users} account${users === 1 ? "" : "s"}. Max ${max} per device — use another device or contact support.`,
    };
  }

  return { ok: true, users, max };
}
