import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { sendCryptoDepositEmail, sendCryptoDepositPendingEmail } from "@/lib/brevo";
import { creditUserCrypto } from "@/lib/p2p/crypto-balance";

const PENDING_NOTIFICATION_TYPE = "wallet_deposit_pending";
// Deterministic per-tx link that doubles as the dedup key for the pending notice.
export const pendingDepositLink = (txHash: string) => `/wallet?deposit=${normalizeReferencePart(txHash)}`;

interface DepositCreditUser {
  id: string;
  email: string | null;
  username: string | null;
  merchantProfile?: unknown | null;
}

export interface OnChainDepositCreditInput {
  user: DepositCreditUser;
  depositAddress: string;
  crypto: string;
  network: string;
  amount: number;
  txHash: string;
  logIndex?: string | null;
  from?: string | null;
  source: "cron" | "moralis" | "tatum" | "tx_hash_recovery";
  metadata?: Record<string, unknown>;
}

export interface OnChainDepositCreditResult {
  credited: boolean;
  skipped: boolean;
  reference: string;
  reason?: string;
}

function normalizeReferencePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function buildDepositReference(input: {
  txHash: string;
  crypto: string;
  network: string;
  depositAddress: string;
  logIndex?: string | null;
}): string {
  const suffix = input.logIndex ? normalizeReferencePart(input.logIndex) : normalizeReferencePart(input.depositAddress);
  return [
    "crypto",
    normalizeReferencePart(input.txHash),
    normalizeReferencePart(input.crypto),
    normalizeReferencePart(input.network),
    suffix,
  ].join("-");
}

export async function creditOnChainDeposit(input: OnChainDepositCreditInput): Promise<OnChainDepositCreditResult> {
  const amount = Number(input.amount);
  const reference = buildDepositReference(input);
  const legacyReference = `crypto-${input.txHash}`;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { credited: false, skipped: true, reference, reason: "invalid_amount" };
  }

  const [alreadyDeposit, alreadyTx] = await Promise.all([
    db.p2PCryptoDeposit.findFirst({ where: { txHash: input.txHash } }),
    db.transaction.findFirst({
      where: {
        OR: [
          { reference },
          { reference: legacyReference },
        ],
      },
    }),
  ]);
  if (alreadyDeposit || alreadyTx) {
    return { credited: false, skipped: true, reference, reason: "already_processed" };
  }

  try {
    await db.$transaction(async (t) => {
      await t.transaction.create({
        data: {
          userId:   input.user.id,
          type:     TransactionType.DEPOSIT,
          amount,
          currency: input.crypto,
          status:   TransactionStatus.COMPLETED,
          reference,
          provider: "crypto",
          metadata: {
            txHash:         input.txHash,
            logIndex:       input.logIndex ?? null,
            from:           input.from ?? null,
            crypto:         input.crypto,
            network:        input.network,
            depositAddress: input.depositAddress,
            source:         input.source,
            ...(input.metadata ?? {}),
          },
        },
      });

      await creditUserCrypto(t, input.user.id, input.crypto, input.network, amount);

      await t.notification.create({
        data: {
          userId: input.user.id,
          type:   "wallet_deposit",
          title:  "Crypto deposit received",
          body:   input.user.merchantProfile
            ? `${amount.toFixed(8)} ${input.crypto} (${input.network}) credited to your wallet. Go to Merchant Center to fund your escrow.`
            : `${amount.toFixed(8)} ${input.crypto} (${input.network}) credited to your wallet.`,
          link:   input.user.merchantProfile ? "/p2p/merchant" : "/dashboard",
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { credited: false, skipped: true, reference, reason: "duplicate_reference" };
    }
    throw error;
  }

  if (input.user.email) {
    sendCryptoDepositEmail(input.user.email, input.user.username ?? input.user.email, {
      crypto:       input.crypto,
      network:      input.network,
      cryptoAmount: amount,
      txHash:       input.txHash,
      address:      input.depositAddress,
    }).catch((e) => console.warn("[crypto-deposit] email failed:", e));
  }

  return { credited: true, skipped: false, reference };
}

export interface PendingDepositNotifyResult {
  notified: boolean;
  reason?: string;
}

/**
 * Stage-1 "deposit detected" notification: fired when a deposit transaction is
 * seen on-chain but not yet confirmed/credited. In-app notification + email,
 * exactly once per transaction. This NEVER touches the credit/dedup path (it
 * writes no Transaction/ledger row), so it cannot affect crediting or cause a
 * double-credit — the worst failure mode is a missing or duplicate heads-up.
 *
 * Dedup is intentionally cheap: a matching notification `link` (per-tx) means we
 * already told this user, and an existing credited Transaction means the deposit
 * already landed, so there's no point announcing it as pending.
 */
export async function notifyPendingDeposit(input: {
  user: DepositCreditUser;
  depositAddress: string;
  crypto: string;
  network: string;
  amount: number;
  txHash: string;
  logIndex?: string | null;
}): Promise<PendingDepositNotifyResult> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { notified: false, reason: "invalid_amount" };

  const reference = buildDepositReference(input);
  const link = pendingDepositLink(input.txHash);

  const [alreadyCredited, alreadyNotified] = await Promise.all([
    db.transaction.findFirst({ where: { OR: [{ reference }, { reference: `crypto-${input.txHash}` }] }, select: { id: true } }),
    db.notification.findFirst({ where: { userId: input.user.id, type: PENDING_NOTIFICATION_TYPE, link }, select: { id: true } }),
  ]);
  if (alreadyCredited) return { notified: false, reason: "already_credited" };
  if (alreadyNotified) return { notified: false, reason: "already_notified" };

  await db.notification.create({
    data: {
      userId: input.user.id,
      type:   PENDING_NOTIFICATION_TYPE,
      title:  "Deposit detected",
      body:   `${amount.toFixed(8)} ${input.crypto} (${input.network}) spotted on-chain — awaiting confirmation. We'll credit it automatically.`,
      link,
    },
  });

  if (input.user.email) {
    sendCryptoDepositPendingEmail(input.user.email, input.user.username ?? input.user.email, {
      crypto:       input.crypto,
      network:      input.network,
      cryptoAmount: amount,
      txHash:       input.txHash,
      address:      input.depositAddress,
    }).catch((e) => console.warn("[crypto-deposit] pending email failed:", e));
  }

  return { notified: true };
}
