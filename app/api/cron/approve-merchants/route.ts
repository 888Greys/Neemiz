/**
 * Cron endpoint: auto-approve due merchant applications.
 *
 * Merchant applications stay PENDING for a randomized 30–40 min window, then
 * auto-verify. Approval is normally lazy (resolved when the applicant reads
 * their profile), but this sweep approves due applications on a schedule so
 * the approval notification + KYC email fire even while the user is offline.
 *
 * VPS cron should run this every ~5 min. Auth: Bearer CRON_SECRET.
 *
 *   curl -sL -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.nezeem.com/api/cron/approve-merchants
 */
import { db } from "@/lib/db";
import { autoApproveIfDue } from "@/lib/p2p/merchant-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const pending = await db.merchantProfile.findMany({
    where: { kycStatus: "PENDING" },
    select: { id: true, userId: true, displayName: true, isVerified: true, kycStatus: true, createdAt: true },
  });

  let approved = 0;
  for (const merchant of pending) {
    const resolved = await autoApproveIfDue(merchant);
    if (resolved.kycStatus === "APPROVED") approved++;
  }

  return Response.json({ ok: true, scanned: pending.length, approved });
}

// Allow POST too, so the same VPS curl pattern works either way.
export async function POST(req: Request) {
  return GET(req);
}
