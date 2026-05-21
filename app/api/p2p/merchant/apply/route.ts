import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendMerchantApplicationEmail } from "@/lib/brevo";

// POST /api/p2p/merchant/apply — submit merchant application
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  const existing = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
  if (existing) return Response.json({ error: "Application already submitted", status: existing.kycStatus }, { status: 409 });

  const { displayName, kycDocumentUrl } = await req.json();
  if (!displayName) return Response.json({ error: "Display name required" }, { status: 400 });

  const merchant = await db.merchantProfile.create({
    data: {
      userId:        dbUser.id,
      displayName,
      kycDocumentUrl: kycDocumentUrl ?? null,
      kycStatus:     "PENDING",
    },
  });

  // Email admin about new application (fire and forget)
  if (dbUser.email) {
    sendMerchantApplicationEmail(dbUser.email, displayName).catch(console.error);
  }

  return Response.json({ id: merchant.id, kycStatus: merchant.kycStatus }, { status: 201 });
}

// GET /api/p2p/merchant/apply — check application status
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser   = await getOrCreateUser(user.id, { email: user.email });
  const merchant = await db.merchantProfile.findUnique({
    where: { userId: dbUser.id },
    select: { id: true, displayName: true, isVerified: true, kycStatus: true, kycNote: true, createdAt: true },
  });

  if (!merchant) return Response.json({ applied: false });
  return Response.json({ applied: true, ...merchant });
}
