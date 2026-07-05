import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { normalizeKenyanPhone } from "@/lib/lipaharaka";
import { isTwilioConfigured, toE164, sendOtp } from "@/lib/twilio";

export const runtime = "nodejs";

/**
 * POST { phone } — send an SMS OTP to the number via Twilio Verify.
 * The number is normalized (254…) and validated as a Safaricom line before we
 * ask Twilio to text a code. Requires an authenticated (signed-up) user.
 */
export async function POST(req: Request) {
  if (!isTwilioConfigured()) {
    return Response.json({ error: "Phone verification is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { phone?: string } | null;
  const phone = normalizeKenyanPhone(String(body?.phone ?? ""));
  if (!/^254[17]\d{8}$/.test(phone)) {
    return Response.json({ error: "Enter a valid Safaricom number (07XX or 01XX)." }, { status: 400 });
  }

  // Ensure the user row exists so the later verify step can attach the number.
  await getOrCreateUser(user.id, { email: user.email });

  try {
    await sendOtp(toE164(phone));
    return Response.json({ ok: true, phone });
  } catch (err) {
    console.error("[phone/send-otp] Twilio Verify failed", err);
    return Response.json({ error: "Could not send the code. Try again." }, { status: 502 });
  }
}
