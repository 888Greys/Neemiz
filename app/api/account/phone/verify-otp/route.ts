import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { normalizeKenyanPhone } from "@/lib/lipaharaka";
import { isTwilioConfigured, toE164, checkOtp } from "@/lib/twilio";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST { phone, code } — confirm the OTP via Twilio Verify. On success, attach
 * the number to the user and mark it verified. Mirrors the mpesa route's
 * unique-constraint handling (a number maps to one account).
 */
export async function POST(req: Request) {
  if (!isTwilioConfigured()) {
    return Response.json({ error: "Phone verification is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { phone?: string; code?: string } | null;
  const phone = normalizeKenyanPhone(String(body?.phone ?? ""));
  const code = String(body?.code ?? "").trim();
  if (!/^254[17]\d{8}$/.test(phone)) {
    return Response.json({ error: "Enter a valid Safaricom number (07XX or 01XX)." }, { status: 400 });
  }
  if (!/^\d{4,10}$/.test(code)) {
    return Response.json({ error: "Enter the code from the SMS." }, { status: 400 });
  }

  let approved: boolean;
  try {
    approved = await checkOtp(toE164(phone), code);
  } catch (err) {
    // Twilio 404s the check once the code has expired or was already consumed.
    console.error("[phone/verify-otp] Twilio check failed", err);
    return Response.json({ error: "Code expired or invalid. Request a new one." }, { status: 400 });
  }
  if (!approved) {
    return Response.json({ error: "Incorrect code. Try again." }, { status: 400 });
  }

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  try {
    await db.user.update({ where: { id: dbUser.id }, data: { phone, phoneVerified: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return Response.json({ error: "This mobile number is already registered." }, { status: 409 });
    }
    throw err;
  }
  return Response.json({ ok: true, phone, phoneVerified: true });
}
