/**
 * Seeds a LARGE set of dummy P2P merchants + ads into the LOCAL database, so the
 * P2P browse view looks populated. Additive and idempotent: it only creates/clears
 * its own generated merchants (supabaseId prefix "genmerch-"), leaving the base
 * seed-local.ts data (dev users, orders, activity) untouched.
 *
 * SAFETY: refuses to run unless DATABASE_URL points at localhost.
 *
 * Run:  bun run scripts/seed-many-ads.ts [count]     (default 30 merchants)
 */
import { PrismaClient, Prisma } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(`\n  Refusing to seed: DATABASE_URL is not local.\n  Got: ${url || "(empty)"}\n`);
  process.exit(1);
}

const D = (v: number | string) => new Prisma.Decimal(v);
const COUNT = Math.max(1, Math.min(200, Number(process.argv[2]) || 30));

const NAMES = [
  "SwiftPesa", "CryptoKing_KE", "MamaCoins", "NairobiExchange", "PesaPlug",
  "GoldenRate", "FastCash254", "TrustTrader", "CoinHub_KE", "DiasporaPay",
  "KenyaCryptoDesk", "QuickSettle", "ApexTraders", "MombasaMerchant", "RiftValleyPay",
  "ZawadiCash", "Haraka Trades", "UsafiExchange", "TumainiCoins", "EagleRate",
  "PrimeUSDT", "MzalendoPay", "BlueChipTrader", "SafiriPesa", "JamboCrypto",
  "ChapaaHouse", "VaultKE", "OceanTraders", "SummitPay", "LinaCash",
  "BorderlessKE", "MpesaWhale", "GreenlightPay", "NairobiVault", "PesaKonnect",
];

// price = KES per 1 unit. Coins with a reference rate (USDT / KES) must stay in
// band; the rest (BTC/ETH/USDC/BNB) skip the price check, so any sane number works.
type Coin = { crypto: string; priceLo: number; priceHi: number; totalLo: number; totalHi: number };
const COINS: Coin[] = [
  { crypto: "USDT", priceLo: 122,      priceHi: 150,       totalLo: 500,   totalHi: 5000 },
  { crypto: "USDC", priceLo: 122,      priceHi: 150,       totalLo: 500,   totalHi: 5000 },
  { crypto: "KES",  priceLo: 0.97,     priceHi: 1.12,      totalLo: 50000, totalHi: 400000 },
  { crypto: "BTC",  priceLo: 7_500_000, priceHi: 8_800_000, totalLo: 0.2,   totalHi: 1.5 },
  { crypto: "ETH",  priceLo: 360_000,  priceHi: 430_000,   totalLo: 2,     totalHi: 12 },
  { crypto: "BNB",  priceLo: 70_000,   priceHi: 90_000,    totalLo: 5,     totalHi: 40 },
];

const RAILS = [
  { type: "MPESA" as const, name: "Safaricom M-Pesa", accountName: "Trader", accountNo: "0712000000" },
  { type: "BANK" as const,  name: "Equity Bank", accountName: "Trader", accountNo: "0123456789", bankName: "Equity" },
];
const PAY_SETS = [["MPESA"], ["MPESA", "BANK"], ["MPESA", "BANK", "AIRTEL"]];

// Deterministic pseudo-random from an integer seed (so re-runs are stable).
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const lerp = (r: number, lo: number, hi: number) => lo + r * (hi - lo);
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const db = new PrismaClient();
  try {
    // ── Clear only previously-generated merchants (cascade their P2P rows) ──────
    const prior = await db.user.findMany({
      where: { supabaseId: { startsWith: "genmerch-" } },
      select: { merchantProfile: { select: { id: true } }, id: true },
    });
    const priorProfileIds = prior.map((u) => u.merchantProfile?.id).filter(Boolean) as string[];
    if (priorProfileIds.length) {
      const where = { merchantId: { in: priorProfileIds } };
      await db.p2PAd.deleteMany({ where });
      await db.p2PPaymentMethod.deleteMany({ where });
      await db.p2PCryptoBalance.deleteMany({ where });
      await db.merchantProfile.deleteMany({ where: { id: { in: priorProfileIds } } });
    }
    await db.user.deleteMany({ where: { supabaseId: { startsWith: "genmerch-" } } });
    console.log(`  ✓ cleared ${priorProfileIds.length} previously-generated merchants`);

    const now = new Date();
    let adCount = 0;

    for (let i = 0; i < COUNT; i++) {
      const rand = rng(i + 1);
      const name = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? `_${Math.floor(i / NAMES.length) + 1}` : ""}`;
      const online = rand() > 0.25;
      const total = 20 + Math.floor(rand() * 400);
      const completed = Math.floor(total * (0.9 + rand() * 0.1));

      const mUser = await db.user.create({
        data: {
          supabaseId: `genmerch-${i}`,
          email: `genmerch${i}@merchant.local.test`,
          username: `genmerch_${i}`,
          walletBalance: D(0), currency: "KES", isActive: true,
        },
      });

      const profile = await db.merchantProfile.create({
        data: {
          userId: mUser.id, displayName: name,
          isVerified: true, isOnline: online,
          lastSeenAt: online ? now : new Date(now.getTime() - (10 + Math.floor(rand() * 600)) * 60 * 1000),
          totalTrades: total, completedTrades: completed,
          completionRate: D(round2(90 + rand() * 10)), avgReleaseTime: 2 + Math.floor(rand() * 15),
          kycStatus: "APPROVED",
        },
      });

      for (const r of RAILS) {
        await db.p2PPaymentMethod.create({
          data: {
            merchantId: profile.id, type: r.type, name: r.name,
            accountName: name, accountNo: r.accountNo,
            bankName: (r as { bankName?: string }).bankName ?? null,
          },
        });
      }

      // 2–4 ads per merchant, cycling through coins and both sides.
      const nAds = 2 + Math.floor(rand() * 3);
      const sellTotals: Record<string, number> = {};
      for (let a = 0; a < nAds; a++) {
        const coin = COINS[(i + a) % COINS.length];
        const side = rand() > 0.45 ? "SELL" : "BUY";
        const price = coin.crypto === "BTC" || coin.crypto === "ETH"
          ? Math.round(lerp(rand(), coin.priceLo, coin.priceHi))
          : round2(lerp(rand(), coin.priceLo, coin.priceHi));
        const totalAmt = round2(lerp(rand(), coin.totalLo, coin.totalHi));
        const available = round2(totalAmt * (0.4 + rand() * 0.6));
        const listedValue = available * price;
        const minLimit = Math.max(100, Math.round(lerp(rand(), 500, 3000)));
        // maxLimit must stay <= total listed value; keep a comfortable margin.
        const maxLimit = Math.min(Math.round(totalAmt * price), Math.max(minLimit + 1000, Math.round(listedValue * 0.9)));
        if (maxLimit < minLimit) continue;

        await db.p2PAd.create({
          data: {
            merchantId: profile.id, side, crypto: coin.crypto, fiat: "KES",
            pricePerUnit: D(price), totalAmount: D(totalAmt), availableAmount: D(available),
            minLimit: D(minLimit), maxLimit: D(maxLimit),
            paymentMethods: PAY_SETS[Math.floor(rand() * PAY_SETS.length)],
            paymentWindow: 15, isActive: true, featured: rand() > 0.85,
            terms: "Pay only to the listed account. Keep all communication inside the order chat.",
          },
        });
        adCount++;
        if (side === "SELL") sellTotals[coin.crypto] = (sellTotals[coin.crypto] ?? 0) + totalAmt;
      }

      // Back SELL ads with crypto balances (unique per merchant × crypto).
      for (const [crypto, amt] of Object.entries(sellTotals)) {
        await db.p2PCryptoBalance.create({
          data: { merchantId: profile.id, crypto, total: D(amt), locked: D(0), available: D(amt) },
        });
      }
    }

    console.log(`  ✓ created ${COUNT} merchants with ${adCount} ads`);
    console.log(`\n  Done. Open the P2P page to see them.\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
