import { db } from "@/lib/db";
import { sendKycApprovedEmail } from "@/lib/brevo";

/**
 * Auto-approval for merchant applications.
 *
 * To feel like a real review, an application stays PENDING for a randomized
 * 30–40 minute window before it is automatically approved. The delay is
 * derived deterministically from the profile id, so it is stable across
 * reads (no extra DB column needed) yet varies per applicant.
 *
 * Approval is "lazy" / just-in-time: there is no cron. The flip to APPROVED
 * happens the first time the profile is read after its deadline has passed —
 * call {@link autoApproveIfDue} wherever a PENDING profile is loaded.
 */

const MIN_DELAY_MIN = 30;
const MAX_DELAY_MIN = 40;

/** Deterministic delay in ms for a given profile id, in [30min, 40min]. */
export function autoApproveDelayMs(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const spanMin = MAX_DELAY_MIN - MIN_DELAY_MIN;
  const minutes = MIN_DELAY_MIN + (hash % (spanMin + 1)); // inclusive of MAX
  return minutes * 60 * 1000;
}

type ApprovableMerchant = {
  id: string;
  userId: string;
  displayName: string;
  isVerified: boolean;
  kycStatus: string;
  createdAt: Date;
};

/**
 * If the merchant is PENDING and past its randomized auto-approve deadline,
 * flip it to APPROVED in the DB and return the updated row. Otherwise returns
 * the input unchanged. REJECTED / already-APPROVED profiles are never touched.
 */
export async function autoApproveIfDue<T extends ApprovableMerchant>(
  merchant: T,
): Promise<T> {
  if (merchant.kycStatus !== "PENDING") return merchant;

  const dueAt = merchant.createdAt.getTime() + autoApproveDelayMs(merchant.id);
  if (Date.now() < dueAt) return merchant;

  const updated = await db.merchantProfile.update({
    where: { id: merchant.id },
    data: { isVerified: true, kycStatus: "APPROVED" },
  });

  // Notify + email (fire and forget) — mirrors the admin approve path.
  db.notification
    .create({
      data: {
        userId: merchant.userId,
        type: "kyc_approved",
        title: "KYC Approved",
        body: "Your merchant account has been verified. You can now list ads and trade crypto.",
        link: "/p2p/merchant",
      },
    })
    .catch(() => {});

  db.user
    .findUnique({ where: { id: merchant.userId }, select: { email: true } })
    .then((u) => {
      if (u?.email) return sendKycApprovedEmail(u.email, merchant.displayName);
    })
    .catch(() => {});

  return { ...merchant, isVerified: updated.isVerified, kycStatus: updated.kycStatus };
}
