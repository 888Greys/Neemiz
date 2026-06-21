import { db } from "@/lib/db";

// Owner-confirmed test accounts. Several were funded via transfer/P2P rather
// than the "manual" provider, so the provider heuristic alone misses them —
// list them explicitly. Keep in sync if new test accounts are created.
export const TEST_USERNAMES = [
  "newtonmulti",
  "silas_binary",
  "collinskipkiru",
  "oira",
  "bewill",
  "bigmanxmr",
];

/**
 * User ids to exclude from real-money analytics (P&L, turnover, etc.):
 *   - suspended accounts (is_active = false) — the binary exploiters
 *   - owner test accounts (TEST_USERNAMES)
 *   - any account credited manually / by admin seed / bonus (test money)
 * Returns a de-duped id list suitable for a Prisma `notIn`.
 */
export async function getExcludedUserIds(): Promise<string[]> {
  const [users, credited] = await Promise.all([
    db.user.findMany({
      where: { OR: [{ isActive: false }, { username: { in: TEST_USERNAMES } }] },
      select: { id: true },
    }),
    db.transaction.findMany({
      where: {
        OR: [
          { type: "BONUS" },
          { type: "DEPOSIT", provider: "manual" },
          { type: "DEPOSIT", reference: { startsWith: "admin-credit" } },
          { type: "DEPOSIT", reference: { startsWith: "ADMIN-SEED" } },
        ],
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  return [...new Set([...users.map((u) => u.id), ...credited.map((t) => t.userId)])];
}
