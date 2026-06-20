import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

// Opt-in list for "email me when M-Pesa withdrawals reopen". While the fiat
// withdraw form is disabled (MPESA_WITHDRAWALS_ENABLED=false in wallet-client),
// users can ask to be notified. Stored as a Notification row (type
// "withdraw_reopen") to avoid a new table; the cron endpoint
// /api/cron/notify-withdraw-reopened emails everyone and clears the list.
const NOTIFY_TYPE = "withdraw_reopen";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ subscribed: false });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  const existing = await db.notification.findFirst({ where: { userId: dbUser.id, type: NOTIFY_TYPE } });
  return Response.json({ subscribed: !!existing });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await getOrCreateUser(user.id, { email: user.email });

  // Idempotent: one subscription per user until the list is cleared on reopen.
  const existing = await db.notification.findFirst({ where: { userId: dbUser.id, type: NOTIFY_TYPE } });
  if (!existing) {
    await db.notification.create({
      data: {
        userId: dbUser.id,
        type: NOTIFY_TYPE,
        title: "Withdrawal alert set",
        body: "We'll email you the moment M-Pesa withdrawals are back.",
        isRead: true,
      },
    });
  }
  return Response.json({ subscribed: true });
}
