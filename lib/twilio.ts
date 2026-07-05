import twilio from "twilio";

/**
 * Twilio Verify — phone-number OTP for registration.
 *
 * All credentials are server-only. Verify handles OTP generation, delivery and
 * expiry entirely on Twilio's side; we never store or compare the code
 * ourselves — we ask Twilio to send one, then ask Twilio whether a submitted
 * code is valid.
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

/**
 * Explicit kill switch. Phone verification stays OFF until this is set to
 * "true", even if Twilio credentials happen to be present. The Twilio account
 * is not yet verified, so this ships disabled: registration falls through to
 * the existing (unverified) flow. Flip to "true" only once Twilio Verify is
 * live. Belt-and-suspenders on top of the credential check below — either the
 * flag being off OR any credential missing keeps the feature dormant.
 */
const phoneVerifyEnabled = process.env.PHONE_VERIFICATION_ENABLED === "true";

/** True only when phone verification is explicitly enabled AND fully configured. */
export function isTwilioConfigured(): boolean {
  return phoneVerifyEnabled && Boolean(accountSid && authToken && verifyServiceSid);
}

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!client) client = twilio(accountSid!, authToken!);
  return client;
}

/**
 * Convert a stored/entered Kenyan number to E.164 (+254…), which Twilio requires.
 * Our app stores the bare `254…` form (see normalizeKenyanPhone); Verify wants
 * the leading `+`. Non-`254` inputs already carrying a `+` are passed through.
 */
export function toE164(phone: string): string {
  const p = phone.trim().replace(/\s+/g, "");
  if (p.startsWith("+")) return p;
  return `+${p}`;
}

/** Send an SMS OTP to the phone number. Returns Twilio's verification status. */
export async function sendOtp(phoneE164: string): Promise<string> {
  const v = await getClient().verify.v2
    .services(verifyServiceSid!)
    .verifications.create({ to: phoneE164, channel: "sms" });
  return v.status; // "pending"
}

/** Check a submitted code. Returns true when Twilio reports it approved. */
export async function checkOtp(phoneE164: string, code: string): Promise<boolean> {
  const check = await getClient().verify.v2
    .services(verifyServiceSid!)
    .verificationChecks.create({ to: phoneE164, code });
  return check.status === "approved";
}
