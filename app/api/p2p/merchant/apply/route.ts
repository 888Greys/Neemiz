import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendMerchantApplicationEmail } from "@/lib/brevo";
import { autoApproveIfDue } from "@/lib/p2p/merchant-approval";

function resolveMerchantDisplayName(
  bodyName: unknown,
  dbUser: { username: string | null; firstName: string | null; lastName: string | null; email: string | null },
  authUser: { email?: string | null; user_metadata?: Record<string, unknown> | null },
): string {
  const fromBody = typeof bodyName === "string" ? bodyName.trim() : "";
  if (fromBody.length >= 2 && fromBody.length <= 50) return fromBody;

  const meta = authUser.user_metadata ?? {};
  const metaName =
    (typeof meta.username === "string" && meta.username.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.first_name === "string" && meta.first_name.trim()) ||
    "";
  const full =
    [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ").trim() ||
    dbUser.username?.trim() ||
    metaName ||
    dbUser.email?.split("@")[0]?.trim() ||
    authUser.email?.split("@")[0]?.trim() ||
    "Trader";

  const sliced = full.slice(0, 50).trim();
  return sliced.length >= 2 ? sliced : "Trader";
}

// POST /api/p2p/merchant/apply — submit merchant application
// Display name is taken from the Nezeem account — merchants no longer set a separate nickname.
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(user.id, { email: user.email });

    const existing = await db.merchantProfile.findUnique({ where: { userId: dbUser.id } });
    if (existing) return Response.json({ error: "Application already submitted", status: existing.kycStatus }, { status: 409 });

    const body = (await req.json().catch(() => ({}))) as {
      displayName?: unknown;
      kycDocumentUrl?: unknown;
    };
    const kycDocumentUrl =
      typeof body.kycDocumentUrl === "string" ? body.kycDocumentUrl : undefined;
    const trimmed = resolveMerchantDisplayName(body.displayName, dbUser, user);

    const merchant = await db.merchantProfile.create({
      data: {
        userId:         dbUser.id,
        displayName:    trimmed,
        kycDocumentUrl: kycDocumentUrl ?? null,
        kycStatus:      "PENDING",
      },
    });

    // Email admin about new application (fire and forget)
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
    const found = await db.merchantProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true, userId: true, displayName: true, isVerified: true, kycStatus: true, kycNote: true, createdAt: true },
    });

    if (!found) return Response.json({ applied: false });
    const merchant = await autoApproveIfDue(found);
    return Response.json({ applied: true, ...merchant });
  } catch (err) {
    console.error("GET /api/p2p/merchant/apply:", err instanceof Error ? err.message : "Unknown error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
