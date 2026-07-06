import { isOwnerEmail } from "@/lib/admin-allowlist";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isOwnerEmail(user.email)) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return true;
}

// Ops triage feed (Phase 3). One consolidated view of every queue that needs a
// human decision — payouts, disputes, KYC, merchant deposits — with counts,
// totals and the oldest waiting item. Actions stay on the existing dedicated
// pages (this screen links out to them); it doesn't duplicate mutations.
export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [
    wdAgg, wdOldest,
    disputesCount, disputeOldest,
    kycCount, kycOldest,
    depCount, depOldest,
  ] = await Promise.all([
    db.transaction.aggregate({ where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus }, _sum: { amount: true }, _count: true }),
    db.transaction.findFirst({ where: { type: "WITHDRAWAL", status: "PENDING_APPROVAL" as TransactionStatus }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.p2PDispute.count({ where: { status: "OPEN" } }),
    db.p2PDispute.findFirst({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.merchantProfile.count({ where: { kycStatus: "PENDING" } }),
    db.merchantProfile.findFirst({ where: { kycStatus: "PENDING" }, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } }),
    db.p2PCryptoDeposit.count({ where: { status: "PENDING" } }),
    db.p2PCryptoDeposit.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  const queues = [
    { key: "withdrawals", label: "Withdrawal payouts", icon: "hourglass_top", href: "/admin/withdrawals", count: wdAgg._count, amount: Number(wdAgg._sum.amount ?? 0), oldest: wdOldest?.createdAt ?? null, detail: "approve or refund before funds leave" },
    { key: "disputes", label: "P2P disputes", icon: "gavel", href: "/admin/p2p", count: disputesCount, amount: 0, oldest: disputeOldest?.createdAt ?? null, detail: "buyer/seller escrow conflicts" },
    { key: "kyc", label: "Merchant KYC", icon: "badge", href: "/admin/p2p", count: kycCount, amount: 0, oldest: kycOldest?.updatedAt ?? null, detail: "verify or reject applications" },
    { key: "deposits", label: "Merchant deposits", icon: "account_balance_wallet", href: "/admin/p2p", count: depCount, amount: 0, oldest: depOldest?.createdAt ?? null, detail: "confirm crypto top-ups" },
  ];

  return Response.json({
    queues,
    totalPending: queues.reduce((s, q) => s + q.count, 0),
  }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } });
}
