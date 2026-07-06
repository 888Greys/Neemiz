import { requireOwnerAdmin } from "@/lib/admin-guard";
/**
 * GET /api/admin/pesapal-setup
 * One-shot helper: fetches the IPN list from Pesapal and returns IPN IDs.
 * Use this to get the PESAPAL_IPN_ID value for your .env file.
 * Admin-only (requires admin 2FA cookie).
 */
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/admin-2fa";

const BASE_URL = process.env.PESAPAL_ENV === "production"
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3";

async function getToken(): Promise<string> {
  const key    = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET not configured");

  const res = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  if (!res.ok) throw new Error(`Pesapal auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { token: string };
  return data.token;
}

export async function GET() {
  // Full owner gate: auth + owner allowlist + is_admin + admin 2FA cookie.
  if (!(await requireOwnerAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const authToken = await getToken();

    // List all registered IPNs
    const res = await fetch(`${BASE_URL}/api/URLSetup/GetIpnList`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Pesapal error: ${res.status} ${text}` }, { status: 502 });
    }

    const ipns = await res.json() as Array<{
      ipn_id:     string;
      url:        string;
      created_date: string;
      ipn_status: number;
      ipn_status_description: string;
    }>;

    return Response.json({
      message: "Copy the ipn_id for your IPN URL and set it as PESAPAL_IPN_ID in your .env",
      env:     process.env.PESAPAL_ENV ?? "sandbox",
      ipns,
    });

  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
