import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { sendCryptoDepositEmail } from "@/lib/brevo";
import { creditUserCrypto } from "@/lib/p2p/crypto-balance";

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
    }).catch((e) => console.warn("[crypto-deposit] email failed:", e));
  }

  return { credited: true, skipped: false, reference };
}
