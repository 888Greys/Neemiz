import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/lib/db";

export type RedeemPromoResult =
  | { ok: true; amount: number; code: string; balance: number }
  | { ok: false; error: string; status: number };

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Atomically redeem a promo code for a user: credit wallet + ledger row +
 * redemption record. One redeem per user per code (unique constraint).
 */
export async function redeemPromoCode(
  userId: string,
  rawCode: string,
): Promise<RedeemPromoResult> {
  const code = normalizePromoCode(rawCode);
  if (!code || code.length < 3) {
    return { ok: false, error: "Enter a valid promo code.", status: 400 };
  }

  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) {
    return { ok: false, error: "Invalid or expired promo code.", status: 404 };
  }

  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) {
    return { ok: false, error: "This promo code is not active yet.", status: 400 };
  }
  if (promo.expiresAt && promo.expiresAt < now) {
    return { ok: false, error: "This promo code has expired.", status: 400 };
  }
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    return { ok: false, error: "This promo code has reached its limit.", status: 410 };
  }

  const already = await db.promoRedemption.findUnique({
    where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
  });
  if (already) {
    return { ok: false, error: "You already used this promo code.", status: 409 };
  }

  // Per-device cap — the anti-farming guard. The signup-velocity tripwire showed
  // single devices spinning up dozens of accounts to each claim welcome credit.
  // One promo redemption per physical device: refuse if any OTHER account that
  // shares a login device with this user has already redeemed ANY promo.
  const myDevices = await db.loginDevice.findMany({
    where: { userId },
    select: { deviceHash: true },
  });
  if (myDevices.length > 0) {
    const deviceSibling = await db.loginDevice.findFirst({
      where: {
        deviceHash: { in: myDevices.map((d) => d.deviceHash) },
        userId: { not: userId },
        user: { promoRedemptions: { some: {} } },
      },
      select: { userId: true },
    });
    if (deviceSibling) {
      return { ok: false, error: "A promo code has already been claimed on this device.", status: 429 };
    }
  }

  const amount = Number(promo.amountKes);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Invalid promo code.", status: 400 };
  }

  const reference = `promo-${promo.code}-${userId.slice(-8)}-${Date.now()}`;

  try {
    const balance = await db.$transaction(async (tx) => {
      // Conditional bump enforces the global cap under concurrency.
      const bumped = await tx.promoCode.updateMany({
        where: {
          id: promo.id,
          isActive: true,
          ...(promo.maxRedemptions != null
            ? { redemptionCount: { lt: promo.maxRedemptions } }
            : {}),
        },
        data: { redemptionCount: { increment: 1 } },
      });
      if (bumped.count === 0) {
        throw new Error(promo.maxRedemptions != null ? "PROMO_EXHAUSTED" : "PROMO_INACTIVE");
      }

      await tx.promoRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId,
          amountKes: amount,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      });
      if (!user) throw new Error("USER_MISSING");
      const before = Number(user.walletBalance);

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.BONUS,
          amount,
          currency: "KES",
          status: TransactionStatus.COMPLETED,
          reference,
          provider: "promo_code",
          metadata: {
            action: "promo_redeem",
            code: promo.code,
            promoCodeId: promo.id,
            before,
            after: before + amount,
          },
        },
      });

      return before + amount;
    });

    return { ok: true, amount, code: promo.code, balance };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "You already used this promo code.", status: 409 };
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg === "PROMO_EXHAUSTED") {
      return { ok: false, error: "This promo code has reached its limit.", status: 410 };
    }
    if (msg === "PROMO_INACTIVE") {
      return { ok: false, error: "Invalid or expired promo code.", status: 404 };
    }
    throw err;
  }
}
