/**
 * Seeds the LOCAL database with:
 *   • Dev users (User A / User B), each holding a big dummy KSh balance.
 *   • A set of dummy P2P merchants with verified profiles, payment rails,
 *     crypto balances and live ads (USDT + KES Coin, both sides, some promoted).
 *   • A handful of P2P orders for User A so "My Orders" isn't empty.
 *
 * Production uses Supabase — this is purely for local development so the P2P
 * pages have something to render.
 *
 * SAFETY: refuses to run unless DATABASE_URL points at localhost — this must
 * never touch the production database.
 *
 * Run:  bun run scripts/seed-local.ts     (or)     npm run seed:local
 */
import { PrismaClient, Prisma } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(
    `\n  Refusing to seed: DATABASE_URL is not local.\n  Got: ${url || "(empty)"}\n  Point it at your local Postgres first (see LOCAL-DEV.md).\n`,
  );
  process.exit(1);
}

const D = (v: number | string) => new Prisma.Decimal(v);

// These supabaseId values must match DEV_ACCOUNTS in lib/dev-auth.ts.
const ACCOUNTS = [
  { id: "dev-user-a", email: "usera@local.test", username: "usera" },
  { id: "dev-user-b", email: "userb@local.test", username: "userb" },
];

const BALANCE = D(1_000_000); // KSh 1,000,000 dummy funds

// Dummy merchants — each gets a verified, online, KYC-approved profile and ads.
// price is fiat (KES) per 1 unit of crypto. For the KES Coin (pegged 1:1) the
// price is a small spread around 1.00.
const MERCHANTS = [
  {
    supabaseId: "dummy-merchant-adrian",
    username: "adrian_ke", email: "adrian@merchant.local.test",
    displayName: "Adrian.ke",
    stats: { total: 38, completed: 36, rate: 100, release: 4 },
    rails: [
      { type: "MPESA" as const, name: "Safaricom M-Pesa", accountName: "Adrian K", accountNo: "0712345678" },
      { type: "BANK" as const,  name: "Equity Bank", accountName: "Adrian K", accountNo: "0123456789", bankName: "Equity" },
    ],
    ads: [
      { side: "SELL" as const, crypto: "USDT", price: 130.50, total: 2000, available: 1200, min: 1000, max: 50000, pay: ["MPESA", "BANK"], featured: true },
      { side: "SELL" as const, crypto: "KES",  price: 1.09,   total: 200000, available: 150000, min: 100, max: 20000, pay: ["MPESA"], featured: true },
    ],
  },
  {
    supabaseId: "dummy-merchant-bigboss",
    username: "big_boss", email: "bigboss@merchant.local.test",
    displayName: "Big_Boss",
    stats: { total: 6, completed: 5, rate: 100, release: 7 },
    rails: [{ type: "MPESA" as const, name: "Safaricom M-Pesa", accountName: "B Boss", accountNo: "0722000111" }],
    ads: [
      { side: "SELL" as const, crypto: "KES",  price: 1.10,  total: 120000, available: 90000, min: 5000, max: 80000, pay: ["MPESA"], featured: true },
      { side: "SELL" as const, crypto: "USDT", price: 132.00, total: 800, available: 600, min: 1000, max: 40000, pay: ["MPESA", "BANK"], featured: false },
    ],
  },
  {
    supabaseId: "dummy-merchant-mrgojias",
    username: "mrgojias", email: "mrgojias@merchant.local.test",
    displayName: "MrGojias",
    stats: { total: 1, completed: 1, rate: 100, release: 12, online: false },
    rails: [{ type: "MPESA" as const, name: "Safaricom M-Pesa", accountName: "Gojias", accountNo: "0733111222" }],
    ads: [
      { side: "SELL" as const, crypto: "KES", price: 1.02, total: 30000, available: 25000, min: 100, max: 10000, pay: ["MPESA"], featured: false },
    ],
  },
  {
    supabaseId: "dummy-merchant-noblecash",
    username: "noblecash", email: "noblecash@merchant.local.test",
    displayName: "NOBLECASH",
    stats: { total: 4, completed: 4, rate: 100, release: 6 },
    rails: [
      { type: "MPESA" as const, name: "Safaricom M-Pesa", accountName: "Noble", accountNo: "0700333444" },
      { type: "BANK" as const,  name: "KCB Bank", accountName: "Noble Cash", accountNo: "1100220033", bankName: "KCB" },
    ],
    ads: [
      { side: "SELL" as const, crypto: "KES", price: 1.02, total: 60000, available: 42000, min: 1000, max: 21207, pay: ["MPESA", "BANK", "AIRTEL"], featured: false },
      { side: "BUY"  as const, crypto: "USDT", price: 128.00, total: 1000, available: 1000, min: 1000, max: 30000, pay: ["MPESA", "BANK"], featured: false },
    ],
  },
  {
    supabaseId: "dummy-merchant-camylopez",
    username: "camylopez", email: "camylopez@merchant.local.test",
    displayName: "Camylopez",
    stats: { total: 1, completed: 1, rate: 100, release: 15, online: false },
    rails: [{ type: "MPESA" as const, name: "Safaricom M-Pesa", accountName: "Camy", accountNo: "0744555666" }],
    ads: [
      { side: "SELL" as const, crypto: "KES",  price: 1.05, total: 50000, available: 38000, min: 500, max: 21982, pay: ["MPESA"], featured: false },
      { side: "BUY"  as const, crypto: "KES",  price: 0.98, total: 40000, available: 40000, min: 500, max: 15000, pay: ["MPESA"], featured: false },
    ],
  },
];

async function main() {
  const db = new PrismaClient();
  try {
    // ── Dev users ────────────────────────────────────────────────────────────
    const devUsers: Record<string, string> = {};
    for (const a of ACCOUNTS) {
      const user = await db.user.upsert({
        where: { supabaseId: a.id },
        update: { walletBalance: BALANCE, isActive: true },
        create: {
          supabaseId: a.id, email: a.email, username: a.username,
          walletBalance: BALANCE, currency: "KES", isActive: true,
        },
      });
      devUsers[a.id] = user.id;
      console.log(`  ✓ ${a.username} (${a.email}) → KSh ${BALANCE.toString()}  [id ${user.id}]`);
    }

    // ── Wipe existing P2P data (local only) so re-runs stay clean ─────────────
    await db.p2PMessage.deleteMany({});
    await db.p2PDispute.deleteMany({});
    await db.p2POrder.deleteMany({});
    await db.p2PAd.deleteMany({});
    await db.p2PPaymentMethod.deleteMany({});
    await db.p2PCryptoBalance.deleteMany({});
    await db.merchantProfile.deleteMany({});
    console.log("  ✓ cleared previous P2P data");

    // ── Dummy merchants + ads ────────────────────────────────────────────────
    const now = new Date();
    const sellAds: { id: string; crypto: string; price: number; sellerId: string; pay: string[] }[] = [];

    for (const m of MERCHANTS) {
      const mUser = await db.user.upsert({
        where: { supabaseId: m.supabaseId },
        update: {},
        create: {
          supabaseId: m.supabaseId, email: m.email, username: m.username,
          walletBalance: D(0), currency: "KES", isActive: true,
        },
      });

      const profile = await db.merchantProfile.create({
        data: {
          userId: mUser.id,
          displayName: m.displayName,
          isVerified: true,
          isOnline: m.stats.online !== false,
          lastSeenAt: m.stats.online === false ? new Date(now.getTime() - 60 * 60 * 1000) : now,
          totalTrades: m.stats.total,
          completedTrades: m.stats.completed,
          completionRate: D(m.stats.rate),
          avgReleaseTime: m.stats.release,
          kycStatus: "APPROVED",
        },
      });

      for (const r of m.rails) {
        await db.p2PPaymentMethod.create({
          data: {
            merchantId: profile.id, type: r.type, name: r.name,
            accountName: r.accountName, accountNo: r.accountNo,
            bankName: (r as { bankName?: string }).bankName ?? null,
          },
        });
      }

      // Crypto balances to back the SELL ads.
      const cryptos = Array.from(new Set(m.ads.map((a) => a.crypto)));
      for (const c of cryptos) {
        const total = m.ads.filter((a) => a.crypto === c && a.side === "SELL").reduce((s, a) => s + a.total, 0) || 1000;
        await db.p2PCryptoBalance.create({
          data: { merchantId: profile.id, crypto: c, total: D(total), locked: D(0), available: D(total) },
        });
      }

      for (const a of m.ads) {
        const ad = await db.p2PAd.create({
          data: {
            merchantId: profile.id, side: a.side, crypto: a.crypto, fiat: "KES",
            pricePerUnit: D(a.price), totalAmount: D(a.total), availableAmount: D(a.available),
            minLimit: D(a.min), maxLimit: D(a.max), paymentMethods: a.pay,
            paymentWindow: 15, isActive: true, featured: a.featured,
            terms: "Pay only to the listed account. Keep all communication inside the order chat.",
          },
        });
        if (a.side === "SELL") {
          sellAds.push({ id: ad.id, crypto: a.crypto, price: a.price, sellerId: profile.id, pay: a.pay });
        }
      }
      console.log(`  ✓ merchant ${m.displayName} → ${m.ads.length} ads`);
    }

    // ── Orders for User A (buyer) across a few statuses ───────────────────────
    const buyerId = devUsers["dev-user-a"];
    const pool = sellAds;
    const ORDER_PLAN: { status: "RELEASED" | "PENDING" | "EXPIRED" | "CANCELLED"; fiat: number; ageMin: number }[] = [
      { status: "RELEASED",  fiat: 5000, ageMin: 60 * 24 * 3 },
      { status: "RELEASED",  fiat: 1200, ageMin: 60 * 24 * 1 },
      { status: "PENDING",   fiat: 800,  ageMin: 5 },
      { status: "EXPIRED",   fiat: 2000, ageMin: 60 * 6 },
      { status: "CANCELLED", fiat: 1500, ageMin: 60 * 30 },
    ];

    let made = 0;
    for (let i = 0; i < ORDER_PLAN.length && pool.length > 0; i++) {
      const plan = ORDER_PLAN[i];
      const src  = pool[i % pool.length];
      const created = new Date(now.getTime() - plan.ageMin * 60 * 1000);
      const cryptoAmount = plan.fiat / src.price;
      await db.p2POrder.create({
        data: {
          adId: src.id, buyerId, sellerId: src.sellerId,
          crypto: src.crypto,
          cryptoAmount: D(cryptoAmount.toFixed(8)), fiatAmount: D(plan.fiat), pricePerUnit: D(src.price),
          status: plan.status, paymentMethod: src.pay[0] ?? "MPESA",
          ...(plan.status === "RELEASED" ? { escrowReleased: true, releasedAt: created, paidAt: created } : {}),
          ...(plan.status === "CANCELLED" ? { cancelledBy: "buyer", cancelReason: "Changed my mind" } : {}),
          expiresAt: new Date(created.getTime() + 15 * 60 * 1000),
          createdAt: created,
        },
      });
      made++;
    }
    console.log(`  ✓ seeded ${made} orders for usera`);

    console.log("\n  Done. Sign in at /dev-login.\n");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
