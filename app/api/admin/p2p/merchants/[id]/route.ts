import { requireOwnerAdmin } from "@/lib/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendKycApprovedEmail, sendKycRejectedEmail } from "@/lib/brevo";

// POST /api/admin/p2p/merchants/[id] — approve or reject a merchant KYC
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireOwnerAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, note } = body as { action: "approve" | "reject"; note?: string };

  if (!["approve", "reject"].includes(action)) {
    return Response.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 });
  }

  const merchant = await db.merchantProfile.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!merchant) return Response.json({ error: "Merchant not found" }, { status: 404 });

  if (action === "approve") {
    await db.merchantProfile.update({
      where: { id },
      data: { isVerified: true, kycStatus: "APPROVED" },
    });
    await db.notification.create({
      data: {
        userId: merchant.userId,
        type: "kyc_approved",
        title: "KYC Approved",
        body: "Your merchant account has been verified. You can now list ads and trade crypto.",
        link: "/p2p/merchant",
      },
    });
    // Email the merchant
    if (merchant.user.email) {
      sendKycApprovedEmail(merchant.user.email, merchant.displayName).catch(console.error);
    }
  } else {
    await db.merchantProfile.update({
      where: { id },
      data: { kycStatus: "REJECTED", kycNote: note ?? null },
    });
    await db.notification.create({
      data: {
        userId: merchant.userId,
        type: "kyc_rejected",
        title: "KYC Rejected",
        body: note
          ? `Your KYC submission was rejected: ${note}`
          : "Your KYC submission was rejected. Please re-submit with correct documents.",
        link: "/p2p/merchant",
      },
    });
    // Email the merchant
    if (merchant.user.email) {
      sendKycRejectedEmail(merchant.user.email, merchant.displayName, note).catch(console.error);
    }
  }

  return Response.json({ ok: true, action });
}
