import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendMerchantApplicationEmail } from "@/lib/brevo";

// POST /api/p2p/merchant/apply — submit merchant application
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const existing = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (existing) return Response.json({ error: "Application already submitted", status: existing.kycStatus }, { status: 409 });

    let displayName: string | undefined;
    let kycDocumentUrl: string | undefined;
    try {
      const body = await req.json();
      displayName    = body.displayName;
      kycDocumentUrl = body.kycDocumentUrl;
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!displayName || typeof displayName !== "string") {
      return Response.json({ error: "Display name required" }, { status: 400 });
    }
    const trimmed = displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      return Response.json({ error: "Display name must be 2–50 characters" }, { status: 400 });
    }

    // Open merchant signup: anybody can be a merchant — auto-approve on apply,
    // no admin review step required.
    const merchant = await db.merchantProfile.create({
      data: {
        userId:         dbUser.id,
        displayName:    trimmed,
        kycDocumentUrl: kycDocumentUrl ?? null,
        kycStatus:      "APPROVED",
        isVerified:     true,
      },
    });

    // Email admin about new merchant (fire and forget)
    if (dbUser.email) {
      sendMerchantApplicationEmail(dbUser.email, trimmed).catch(() => {});
    }

    return Response.json({ id: merchant.id, kycStatus: merchant.kycStatus }, { status: 201 });
  } catch (err) {
    console.error("POST /api/p2p/merchant/apply:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/p2p/merchant/apply — check application status
export async function GET() {
  try {
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
  } catch (err) {
    console.error("GET /api/p2p/merchant/apply:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
