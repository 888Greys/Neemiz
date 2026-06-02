import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { cookies } from "next/headers";
import { TransactionStatus } from "@prisma/client";
import { relworxSend } from "@/lib/relworx";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) return null;
  return true;
}

// PATCH /api/admin/withdrawals/[id]  { action: "approve" | "reject" }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = params;
  let body: { action: string; txHash?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid body" }, { status: 400 }); }

  const txn = await db.transaction.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });

  if (!txn) return Response.json({ error: "Not found" }, { status: 404 });
  if ((txn.status as string) !== "PENDING_APPROVAL") {
    return Response.json({ error: "Withdrawal is not pending approval" }, { status: 409 });
  }

  if (body.action === "reject") {
    // Refund the held balance and mark cancelled
    await db.$transaction([
      db.user.update({ where: { id: txn.userId }, data: { walletBalance: { increment: txn.amount } } }),
      db.transaction.update({ where: { id }, data: { status: TransactionStatus.CANCELLED } }),
    ]);
    return Response.json({ ok: true, status: "cancelled" });
  }

  if (body.action === "approve") {
    const meta = txn.metadata as Record<string, unknown> | null;

    // ── KES → crypto sell: admin sends crypto manually, then marks complete ──
    if (txn.provider === "crypto_sell") {
      const txHash = typeof body.txHash === "string" ? body.txHash.trim() : undefined;
      await db.transaction.update({
        where: { id },
        data: {
          status:   TransactionStatus.COMPLETED,
          metadata: { ...(meta ?? {}), txHash, approvedAt: new Date().toISOString() },
        },
      });
      await db.notification.create({
        data: {
          userId: txn.userId,
          type:   "crypto_sell",
          title:  `${(meta?.crypto as string) ?? "Crypto"} sent`,
          body:   `≈ ${(meta?.cryptoAmount as number) ?? ""} ${(meta?.crypto as string) ?? ""} sent for your KSh ${Number(txn.amount).toLocaleString()} sale.`,
          link:   "/wallet",
        },
      });
      return Response.json({ ok: true, status: "completed" });
    }

    const msisdn  = meta?.msisdn as string | undefined;
    const payout  = meta?.payout as number | undefined;
    const amount  = Number(txn.amount);

    if (!msisdn || !payout) {
      return Response.json({ error: "Missing payment metadata" }, { status: 422 });
    }

    const accountNo = process.env.RELWORX_ACCOUNT_NO;
    if (!accountNo) {
      return Response.json({ error: "Payment provider not configured" }, { status: 503 });
    }

    await db.transaction.update({ where: { id }, data: { status: TransactionStatus.PENDING } });

    try {
      const result = await relworxSend({
        account_no:  accountNo,
        reference:   id,
        msisdn:      `+${msisdn}`,
        currency:    "KES",
        amount:      payout,
        description: `Nezeem withdrawal ${id}`,
      });

      await db.transaction.update({
        where: { id },
        data: {
          reference: result.reference ?? id,
          metadata: { ...(meta ?? {}), relworxRef: result.reference, approvedAt: new Date().toISOString() },
        },
      });

      return Response.json({ ok: true, status: "processing" });
    } catch (apiErr) {
      // Relworx failed — refund and cancel
      await db.$transaction([
        db.user.update({ where: { id: txn.userId }, data: { walletBalance: { increment: amount } } }),
        db.transaction.update({ where: { id }, data: { status: TransactionStatus.FAILED } }),
      ]);
      const msg = apiErr instanceof Error ? apiErr.message : "Payment provider error";
      return Response.json({ error: msg }, { status: 502 });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
