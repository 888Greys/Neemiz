/**
 * Clamp UserCryptoBalance to the LIVE on-chain balance of the user's current
 * deposit address. Fixes phantom ledger balances left after the HD seed
 * migration (funds on burned addresses, ledger still showing them).
 *
 * Rules:
 *   - Never raise a balance (deposit cron owns credits).
 *   - available := max(0, onChain − locked)
 *   - If available drops, write a REFUND row for the delta (audit trail).
 *   - No deposit address + ledger > 0 → available := 0 (can't withdraw anyway).
 *   - RPC failure → skip that row (never claw to 0 on an outage).
 */
import { db } from "@/lib/db";
import { tryGetOnChainBalance } from "@/lib/crypto/deposit-checker";
import { TransactionStatus, TransactionType } from "@prisma/client";

export type ReconcileRow = {
  userId: string;
  username: string | null;
  email: string | null;
  crypto: string;
  network: string;
  address: string | null;
  ledgerAvailable: number;
  ledgerLocked: number;
  onChain: number;
  newAvailable: number;
  delta: number; // negative = clawed back
  skipped?: boolean;
  skipReason?: string;
};

export type ReconcileResult = {
  dryRun: boolean;
  checked: number;
  changed: number;
  skipped: number;
  rows: ReconcileRow[];
};

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function round8NonNeg(n: number): number {
  return Math.round(Math.max(0, n) * 1e8) / 1e8;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function reconcileCryptoToOnChain(opts: {
  dryRun?: boolean;
  /** Only these user ids (optional). */
  userIds?: string[];
  concurrency?: number;
}): Promise<ReconcileResult> {
  const dryRun = opts.dryRun !== false; // default safe
  const concurrency = opts.concurrency ?? 4;

  const balances = await db.userCryptoBalance.findMany({
    where: {
      NOT: { crypto: "KES", network: "KES" },
      ...(opts.userIds?.length ? { userId: { in: opts.userIds } } : {}),
      OR: [{ available: { gt: 0 } }, { locked: { gt: 0 } }],
    },
    include: { user: { select: { username: true, email: true } } },
  });

  const addresses = await db.cryptoDepositAddress.findMany({
    where: {
      ...(opts.userIds?.length ? { userId: { in: opts.userIds } } : {}),
    },
    select: { userId: true, crypto: true, network: true, address: true },
  });
  const addrKey = (userId: string, crypto: string, network: string) =>
    `${userId}|${crypto}|${network}`;
  const addrMap = new Map(addresses.map((a) => [addrKey(a.userId, a.crypto, a.network), a.address]));

  const planned = await mapLimit(balances, concurrency, async (b) => {
    const ledgerAvailable = Number(b.available);
    const ledgerLocked = Number(b.locked);
    const address = addrMap.get(addrKey(b.userId, b.crypto, b.network)) ?? null;

    // No on-chain deposit address for this coin/network means the balance is
    // NOT backed by a scanned deposit address — it was acquired internally
    // (P2P merchant escrow, wallet transfer, admin credit). The reconcile only
    // clamps deposit-address holdings; clamping an internal balance to 0 wrongly
    // claws back legitimately-acquired crypto (e.g. a P2P purchase). SKIP it.
    if (!address) {
      return {
        userId: b.userId, username: b.user.username, email: b.user.email,
        crypto: b.crypto, network: b.network, address: null,
        ledgerAvailable, ledgerLocked, onChain: 0,
        newAvailable: ledgerAvailable, delta: 0,
        skipped: true, skipReason: "no_deposit_address",
      } satisfies ReconcileRow;
    }

    let onChain = 0;
    if (address) {
      const fetched = await tryGetOnChainBalance(address, b.crypto, b.network);
      if (fetched === null) {
        return {
          userId: b.userId,
          username: b.user.username,
          email: b.user.email,
          crypto: b.crypto,
          network: b.network,
          address,
          ledgerAvailable,
          ledgerLocked,
          onChain: 0,
          newAvailable: ledgerAvailable,
          delta: 0,
          skipped: true,
          skipReason: "rpc_unavailable",
        } satisfies ReconcileRow;
      }
      onChain = fetched;
    }

    // Spendable cannot exceed what's on the current address after locks.
    const newAvailable = round8NonNeg(
      Math.min(ledgerAvailable, Math.max(0, onChain - ledgerLocked)),
    );
    // delta is negative when clawing back — do not clamp through round8NonNeg
    const delta = round8(newAvailable - ledgerAvailable);

    return {
      userId: b.userId,
      username: b.user.username,
      email: b.user.email,
      crypto: b.crypto,
      network: b.network,
      address,
      ledgerAvailable,
      ledgerLocked,
      onChain: round8NonNeg(onChain),
      newAvailable,
      delta,
    } satisfies ReconcileRow;
  });

  const skipped = planned.filter((r) => r.skipped).length;
  const rows = planned.filter((r) => !r.skipped && r.delta < -1e-12); // only reductions
  if (!dryRun && rows.length) {
    for (const r of rows) {
      const claw = round8NonNeg(-r.delta);
      await db.$transaction(async (tx) => {
        await tx.userCryptoBalance.update({
          where: {
            userId_crypto_network: {
              userId: r.userId,
              crypto: r.crypto,
              network: r.network,
            },
          },
          data: { available: r.newAvailable },
        });
        await tx.transaction.create({
          data: {
            userId: r.userId,
            type: TransactionType.REFUND,
            amount: -claw,
            currency: r.crypto,
            status: TransactionStatus.COMPLETED,
            provider: "admin_crypto_balance_reconcile",
            reference: `crypto-reconcile-onchain-${r.crypto}-${r.network}-${Date.now()}-${r.userId}`,
            metadata: {
              reason: "clamp_ledger_to_current_deposit_address",
              crypto: r.crypto,
              network: r.network,
              address: r.address,
              previousAvailable: r.ledgerAvailable,
              locked: r.ledgerLocked,
              onChain: r.onChain,
              newAvailable: r.newAvailable,
              clawed: claw,
            },
          },
        });
      });
    }
  }

  return {
    dryRun,
    checked: balances.length,
    changed: rows.length,
    skipped,
    rows: rows.sort((a, b) => a.delta - b.delta),
  };
}
