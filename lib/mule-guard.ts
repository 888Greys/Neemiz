import { db } from "@/lib/db";
import { CURRENCY_SYMBOL } from "@/lib/currency";

/**
 * Mule watchlist. Accounts flagged as suspected mules (e.g. multiple accounts
 * cashing out to one collector number). A flagged account is NOT blocked — its
 * withdrawals are HELD for admin review (PENDING_APPROVAL) and the owner is
 * paged, so a real win can still be approved and laundering can be rejected.
 *
 * Source: `system_settings.flagged_mule_users` (comma-separated emails). 10s cache.
 */
const CACHE_TTL_MS = 10_000;
let cache: { set: Set<string>; expires: number } | null = null;

export async function flaggedMuleEmails(): Promise<Set<string>> {
  if (cache && cache.expires > Date.now()) return cache.set;
  let set = new Set<string>();
  try {
    const row = await db.systemSetting.findUnique({ where: { key: "flagged_mule_users" }, select: { value: true } });
    if (row?.value) set = new Set(row.value.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  } catch {
    // missing flag — nobody flagged
  }
  cache = { set, expires: Date.now() + CACHE_TTL_MS };
  return set;
}

export async function isMuleFlagged(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return (await flaggedMuleEmails()).has(email.trim().toLowerCase());
}

/** Page every admin in-app that a flagged mule's withdrawal was held for review. */
export async function notifyAdminsMuleHold(info: { username: string; amountKes: number; msisdn: string }): Promise<void> {
  try {
    const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
    if (!admins.length) return;
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "admin_mule_hold",
        title: "⚠️ Flagged account withdrawal — review",
        body: `@${info.username} tried to withdraw ${CURRENCY_SYMBOL} ${info.amountKes.toLocaleString()} to +${info.msisdn}. Held pending your approval — approve or reject in the withdrawals panel.`,
        link: "/admin/withdrawals",
      })),
    });
  } catch (e) {
    console.error("[mule-guard] admin notify failed", e);
  }
}
