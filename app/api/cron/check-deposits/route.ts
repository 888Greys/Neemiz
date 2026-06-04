/**
 * Cron endpoint: scans all crypto deposit addresses and credits any new deposits.
 * VPS cron runs this every 5 minutes.
 *
 * Source of truth: the Transaction ledger.
 * Every deposit, withdrawal and transfer has a Transaction record.
 * UserCryptoBalance is updated by increment/decrement only — never overwritten
 * by an on-chain balance query (which can return stale/zero values transiently).
 *
 * KES walletBalance is only ever credited by fiat providers (Megapay, Pesapal).
 * Merchants use POST /api/p2p/merchant/fund to move wallet crypto → escrow.
 */
import { db } from "@/lib/db";
import { checkDeposits } from "@/lib/crypto/deposit-checker";
import { creditOnChainDeposit } from "@/lib/crypto/deposit-credit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const params = new URL(req.url).searchParams;
  const backfillBep20 = params.get("backfill") === "1";
  const addressFilter = params.get("address");
  const txHash = params.get("txHash") ?? undefined;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await db.cryptoDepositAddress.findMany({
    where: addressFilter ? { address: { equals: addressFilter, mode: "insensitive" } } : undefined,
    include: { user: { include: { merchantProfile: true } } },
  });

  let credited = 0;
  const errors:  string[] = [];
  const details: Array<{
    address:  string;
    crypto:   string;
    network:  string;
    txsFound: number;
    skipped:  number;
    credited: number;
    error?:   string;
  }> = [];

  for (const addr of addresses) {
    const addrDetail: (typeof details)[number] = {
      address:  addr.address,
      crypto:   addr.crypto,
      network:  addr.network,
      txsFound: 0,
      skipped:  0,
      credited: 0,
    };

    try {
      const txs = await checkDeposits(addr.address, addr.crypto, addr.network, { backfillBep20, txHash });
      addrDetail.txsFound = txs.length;

      for (const tx of txs) {
        const amount = parseFloat(tx.amount);
        if (amount <= 0) { addrDetail.skipped++; continue; }

        const result = await creditOnChainDeposit({
          user:           addr.user,
          depositAddress: addr.address,
          crypto:         addr.crypto,
          network:        addr.network,
          amount,
          txHash:         tx.txHash,
          logIndex:       tx.logIndex,
          from:           tx.from,
          source:         txHash ? "tx_hash_recovery" : "cron",
          metadata:       { blockTimestamp: tx.timestamp },
        });
        if (result.credited) {
          credited++;
          addrDetail.credited++;
        } else {
          addrDetail.skipped++;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      errors.push(`${addr.address}: ${msg}`);
      addrDetail.error = msg;
    }

    details.push(addrDetail);
  }

  return Response.json({ ok: true, checked: addresses.length, credited, errors, details });
}
