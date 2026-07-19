/**
 * Inspect a user's fiat + crypto balances and P2P ads (recovery diagnostics).
 *
 *   bun run scripts/inspect-p2p-user.ts goodhope229@gmail.com
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim();
if (!email) {
  console.error("Usage: bun run scripts/inspect-p2p-user.ts <email>");
  process.exit(1);
}

const db = new PrismaClient();

const user = await db.user.findFirst({
  where: { email: { equals: email, mode: "insensitive" } },
  select: {
    id: true,
    email: true,
    username: true,
    walletBalance: true,
    currency: true,
    merchantProfile: { select: { id: true, displayName: true, isVerified: true } },
  },
});

if (!user) {
  console.log(JSON.stringify({ error: "user not found", email }, null, 2));
  await db.$disconnect();
  process.exit(0);
}

const crypto = await db.userCryptoBalance.findMany({
  where: { userId: user.id },
  orderBy: [{ crypto: "asc" }, { network: "asc" }],
});

const escrow = user.merchantProfile
  ? await db.p2PCryptoBalance.findMany({ where: { merchantId: user.merchantProfile.id } })
  : [];

const ads = user.merchantProfile
  ? await db.p2PAd.findMany({
      where: { merchantId: user.merchantProfile.id },
      select: {
        id: true,
        side: true,
        crypto: true,
        fiat: true,
        isActive: true,
        totalAmount: true,
        availableAmount: true,
        feeRate: true,
        pricePerUnit: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    })
  : [];

const recentTx = await db.transaction.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: "desc" },
  take: 15,
  select: {
    id: true,
    type: true,
    amount: true,
    currency: true,
    status: true,
    provider: true,
    reference: true,
    createdAt: true,
  },
});

console.log(
  JSON.stringify(
    {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletBalance: Number(user.walletBalance),
        currency: user.currency,
        merchantId: user.merchantProfile?.id ?? null,
        displayName: user.merchantProfile?.displayName ?? null,
      },
      crypto: crypto.map((r) => ({
        crypto: r.crypto,
        network: r.network,
        available: Number(r.available),
        locked: Number(r.locked),
      })),
      escrow: escrow.map((r) => ({
        crypto: r.crypto,
        total: Number(r.total),
        available: Number(r.available),
        locked: Number(r.locked),
      })),
      ads: ads.map((a) => ({
        id: a.id,
        side: a.side,
        crypto: a.crypto,
        fiat: a.fiat,
        isActive: a.isActive,
        total: Number(a.totalAmount),
        available: Number(a.availableAmount),
        feeRate: Number(a.feeRate),
        price: Number(a.pricePerUnit),
        orders: a._count.orders,
        updatedAt: a.updatedAt,
      })),
      recentTx: recentTx.map((t) => ({
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        provider: t.provider,
        reference: t.reference,
        createdAt: t.createdAt,
      })),
    },
    null,
    2,
  ),
);

await db.$disconnect();
