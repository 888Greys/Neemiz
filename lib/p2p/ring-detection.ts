/**
 * P2P ring detection + release-review gate (2026-07-20 hardening).
 *
 * Incident: a 3-account ring (collo / collince / emilykiogo435) traded with
 * itself via fake "paid" orders to launder balances — wallet transfers are
 * capped at 50 KES/tx, so they used P2P escrow releases for size.
 *
 * At order creation we flag buyer↔merchant pairs that look like the same
 * actor; the flags are stored on P2POrder.riskFlags and ANY flag (or a large
 * release) routes the release through an admin review (auto-dispute) before
 * funds move.
 *
 * Note: shared-IP is intentionally not checked — login IPs are not persisted
 * (login_devices has no ip column). Device fingerprint + transfer history are
 * the durable signals available in the schema.
 */
/**
 * Minimal structural DB interface — satisfied by PrismaClient / a transaction
 * client, and easy to fake in tests.
 */
export interface RingDetectionDb {
  loginDevice: {
    findMany(args: { where: { userId: string }; select: { deviceHash: true } }): Promise<Array<{ deviceHash: string }>>;
    count(args: { where: { userId: string; deviceHash: { in: string[] } } }): Promise<number>;
  };
  transaction: {
    count(args: {
      where: {
        provider: string;
        OR: Array<{ userId: string; metadata: { path: string[]; equals: string } }>;
      };
    }) => Promise<number>;
  };
}

export type P2PRingSignal = "buyer_is_seller" | "shared_device" | "transfer_history";

/** Detect buyer↔seller ring signals at order-creation time. */
export async function detectP2PRingSignals(
  tx: RingDetectionDb,
  buyerId: string,
  sellerUserId: string,
): Promise<string[]> {
  if (!buyerId || !sellerUserId) return [];
  if (buyerId === sellerUserId) return ["buyer_is_seller"];

  const signals: string[] = [];

  // Shared device fingerprint between the two accounts.
  const buyerDevices = await tx.loginDevice.findMany({
    where: { userId: buyerId },
    select: { deviceHash: true },
  });
  if (buyerDevices.length > 0) {
    const shared = await tx.loginDevice.count({
      where: { userId: sellerUserId, deviceHash: { in: buyerDevices.map((d) => d.deviceHash) } },
    });
    if (shared > 0) signals.push("shared_device");
  }

  // Any prior wallet transfer between the pair, either direction.
  const transfers = await tx.transaction.count({
    where: {
      provider: "wallet_transfer",
      OR: [
        { userId: buyerId,      metadata: { path: ["senderId"],    equals: sellerUserId } },
        { userId: sellerUserId, metadata: { path: ["senderId"],    equals: buyerId } },
        { userId: buyerId,      metadata: { path: ["recipientId"], equals: sellerUserId } },
        { userId: sellerUserId, metadata: { path: ["recipientId"], equals: buyerId } },
      ],
    },
  });
  if (transfers > 0) signals.push("transfer_history");

  return signals;
}

// ─── Release review gate ─────────────────────────────────────────────────────

export const RELEASE_REVIEW_DEFAULT_THRESHOLD_KES = 10_000;

/** Releases at/above this KES value require admin review. 0 disables the threshold. */
export function releaseReviewThresholdKes(): number {
  const v = Number(process.env.P2P_RELEASE_REVIEW_THRESHOLD_KES ?? RELEASE_REVIEW_DEFAULT_THRESHOLD_KES);
  return Number.isFinite(v) && v >= 0 ? v : RELEASE_REVIEW_DEFAULT_THRESHOLD_KES;
}

/** Parse the stored riskFlags JSON column into a clean string list. */
export function p2pRingFlags(riskFlags: unknown): string[] {
  if (!Array.isArray(riskFlags)) return [];
  return riskFlags.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/**
 * Decide whether a release must go through admin review, and why.
 * Ring flags always win over the size threshold (they are the stronger signal).
 */
export function releaseReviewReason(fiatKes: number, ringFlags: string[]): string | null {
  if (ringFlags.length > 0) return `buyer/seller ring signals: ${ringFlags.join(", ")}`;
  const threshold = releaseReviewThresholdKes();
  if (threshold > 0 && fiatKes >= threshold) {
    return `release above admin review threshold (${Math.round(fiatKes).toLocaleString()} KES)`;
  }
  return null;
}
