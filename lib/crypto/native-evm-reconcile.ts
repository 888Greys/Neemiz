/**
 * Native EVM deposit backstop — Etherscan-free.
 *
 * Native coins (ETH/BNB/POL) emit no logs and public RPC has no txs-by-address
 * method, so the deposit-checker can't scan them without Etherscan. Deposit
 * addresses only ever RECEIVE (withdrawals spend directly, gas is funded from
 * the hot wallet), so the on-chain native balance IS the total deposited. This
 * backstop compares eth_getBalance (public RPC) to the credited ledger and
 * credits the difference. Idempotent by construction: once credited, ledger ==
 * on-chain, so a re-run computes a zero delta. The clawback reconcile
 * (reconcile-onchain) still caps ledger <= on-chain, so this can never
 * over-credit even if a real-time path (Moralis) also credits the same deposit.
 */
import { db } from "@/lib/db";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { creditUserCrypto } from "@/lib/p2p/crypto-balance";
import { tryGetOnChainBalance } from "@/lib/crypto/deposit-checker";

const NATIVE_EVM: { crypto: string; network: string }[] = [
  { crypto: "ETH", network: "ERC20" },
  { crypto: "BNB", network: "BEP20" },
  { crypto: "POL", network: "POLYGON" },
];

const DUST = 1e-8;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

export interface NativeReconcileRow {
  userId: string;
  email: string | null;
  crypto: string;
  network: string;
  address: string;
  onChain: number;
  ledger: number;
  credited: number;
}

export async function reconcileNativeEvmUp(
  opts: { dryRun?: boolean; userIds?: string[] } = {},
): Promise<{ dryRun: boolean; scanned: number; credited: NativeReconcileRow[] }> {
  const dryRun = opts.dryRun !== false; // default safe

  const addrs = await db.cryptoDepositAddress.findMany({
    where: {
      OR: NATIVE_EVM,
      ...(opts.userIds?.length ? { userId: { in: opts.userIds } } : {}),
    },
    select: { userId: true, crypto: true, network: true, address: true, user: { select: { email: true } } },
  });

  const credited: NativeReconcileRow[] = [];

  for (const a of addrs) {
    const onChain = await tryGetOnChainBalance(a.address, a.crypto, a.network);
    if (onChain === null) continue; // RPC blip — never adjust on a failed read

    const bal = await db.userCryptoBalance.findUnique({
      where: { userId_crypto_network: { userId: a.userId, crypto: a.crypto, network: a.network } },
      select: { available: true, locked: true },
    });
    const ledger = Number(bal?.available ?? 0) + Number(bal?.locked ?? 0);
    const diff = round8(onChain - ledger);
    if (diff <= DUST) continue;

    credited.push({
      userId: a.userId, email: a.user.email, crypto: a.crypto, network: a.network,
      address: a.address, onChain: round8(onChain), ledger: round8(ledger), credited: diff,
    });

    if (!dryRun) {
      await db.$transaction(async (t) => {
        await creditUserCrypto(t, a.userId, a.crypto, a.network, diff);
        await t.transaction.create({
          data: {
            userId:   a.userId,
            type:     TransactionType.DEPOSIT,
            amount:   diff,
            currency: a.crypto,
            status:   TransactionStatus.COMPLETED,
            provider: "crypto",
            reference: `crypto-native-recon-${a.crypto}-${a.network}-${a.userId}-${Date.now()}`,
            metadata: {
              source: "native_evm_balance_reconcile",
              crypto: a.crypto, network: a.network, address: a.address,
              onChain: round8(onChain), previousLedger: round8(ledger),
            },
          },
        });
      });
    }
  }

  return { dryRun, scanned: addrs.length, credited };
}
