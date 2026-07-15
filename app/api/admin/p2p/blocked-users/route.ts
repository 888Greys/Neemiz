import { db } from "@/lib/db";
import { requireOwnerAdmin } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/admin-audit";
import {
  P2P_BLOCKED_KEY,
  invalidateP2pBlockedCache,
  parseP2pBlockedList,
} from "@/lib/p2p/user-guard";

// Owner-admin control for the per-user P2P kill switch
// (system_settings.p2p_blocked_users — see lib/p2p/user-guard.ts). A blocked
// email cannot place orders, run express trades, post ads, or fund/cash-out
// merchant escrow.
//
// Previously this flag had no UI, so flipping it meant a deploy-time data
// migration (e.g. 20260715170000_unblock_p2p_goodhope229) — which runs once,
// silently, and can't be verified without DB access.
//
// GET  → { entries: [{ email, username, exists }], count }
// POST → { action: "block" | "unblock", email } → same shape

export const runtime = "nodejs";

/** Deliberately permissive — enough to catch typos, not to police addresses. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolve each blocked email to an account so the UI can flag entries that
 * match nobody. The list is keyed by email, but users.email can be NULL, so a
 * blocked address is not guaranteed to correspond to a live account.
 */
async function describe(emails: string[]) {
  if (emails.length === 0) return [];
  const users = await db.user.findMany({
    where:  { email: { in: emails, mode: "insensitive" } },
    select: { email: true, username: true },
  });
  const byEmail = new Map(users.map((u) => [u.email?.toLowerCase() ?? "", u.username]));
  return emails.map((email) => ({
    email,
    username: byEmail.get(email) ?? null,
    exists:   byEmail.has(email),
  }));
}

export async function GET() {
  const adminId = await requireOwnerAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const row = await db.systemSetting.findUnique({
    where:  { key: P2P_BLOCKED_KEY },
    select: { value: true },
  });
  const emails = parseP2pBlockedList(row?.value).sort();
  return Response.json({ entries: await describe(emails), count: emails.length });
}

export async function POST(req: Request) {
  const adminId = await requireOwnerAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: unknown; action?: unknown };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email  = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const action = body.action === "block" || body.action === "unblock" ? body.action : null;

  if (!action)              return Response.json({ error: "action must be 'block' or 'unblock'." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  // Read-modify-write in one transaction — the flag is a single comma-separated
  // string, so two concurrent admins would otherwise clobber each other.
  const emails = await db.$transaction(async (tx) => {
    const row = await tx.systemSetting.findUnique({
      where:  { key: P2P_BLOCKED_KEY },
      select: { value: true },
    });
    const set = new Set(parseP2pBlockedList(row?.value));

    if (action === "block") set.add(email);
    else                    set.delete(email);

    const next = [...set].sort();
    await tx.systemSetting.upsert({
      where:  { key: P2P_BLOCKED_KEY },
      create: { key: P2P_BLOCKED_KEY, value: next.join(",") },
      update: { value: next.join(",") },
    });
    return next;
  });

  invalidateP2pBlockedCache();

  await logAdminAction({
    adminId,
    action:   action === "block" ? "p2p_block_user" : "p2p_unblock_user",
    targetId: email,
    metadata: { email, blockedCount: emails.length },
  });

  return Response.json({ ok: true, action, email, entries: await describe(emails), count: emails.length });
}
