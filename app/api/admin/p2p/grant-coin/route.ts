import { db } from "@/lib/db";
import { requireOwnerAdmin } from "@/lib/admin-guard";
import { creditUserCrypto, defaultNetwork, isKesCoin } from "@/lib/p2p/crypto-balance";
import { isActiveLocalCoin } from "@/lib/p2p/local-coins";
import { TransactionType, TransactionStatus } from "@prisma/client";

// POST /api/admin/p2p/grant-coin — owner-admin tops up an in-app local coin
// (UGX, TZS, NGN, …) into a user's P2P wallet (UserCryptoBalance). These coins
// are 1:1-pegged marketing instruments with no deposit rail, so they are seeded
// here rather than deposited. Not for KES (that is the fiat wallet) or real crypto.
//
// Body: { crypto: string; amount: number; username?: string }
//   - username omitted → credits the calling admin's own account.
//   - username targets by the always-set unique handle (email may be NULL).
export async function POST(req: Request) {
  const adminUserId = await requireOwnerAdmin();
  if (!adminUserId) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { crypto?: unknown; amount?: unknown; username?: unknown };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const crypto = typeof body.crypto === "string" ? body.crypto.toUpperCase() : "";
  const amount = Number(body.amount);
  const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : null;

  if (!isActiveLocalCoin(crypto) || isKesCoin(crypto)) {
    return Response.json({ error: "crypto must be an active in-app local coin (not KES)." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "amount must be a positive number." }, { status: 400 });
  }

  // Resolve the target user: explicit username, else the calling admin.
  const target = username
    ? await db.user.findUnique({ where: { username }, select: { id: true, username: true } })
    : await db.user.findUnique({ where: { id: adminUserId }, select: { id: true, username: true } });
  if (!target) return Response.json({ error: `No user found for username "${username}".` }, { status: 404 });

  const network = defaultNetwork(crypto);
  await db.$transaction(async (tx) => {
    await creditUserCrypto(tx, target.id, crypto, network, amount);
    await tx.transaction.create({
      data: {
        userId:    target.id,
        type:      TransactionType.DEPOSIT,
        amount,
        currency:  crypto,
        status:    TransactionStatus.COMPLETED,
        reference: `admin-grant-${crypto.toLowerCase()}-${target.id}-${Date.now()}`,
        provider:  "admin_incoin_grant",
        metadata:  { action: "admin_grant", asset: crypto, grantedBy: adminUserId },
      },
    });
  });

  const balance = await db.userCryptoBalance.findUnique({
    where: { userId_crypto_network: { userId: target.id, crypto, network } },
    select: { available: true, locked: true },
  });

  return Response.json({
    ok: true,
    username: target.username,
    crypto,
    network,
    granted: amount,
    available: Number(balance?.available ?? 0),
    locked: Number(balance?.locked ?? 0),
  });
}
