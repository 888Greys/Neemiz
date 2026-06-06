import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/brevo";
import { generateUniqueUsername } from "@/lib/user-identity";

// Supabase Auth webhook — fires on user.created, user.updated, user.deleted
// Set SUPABASE_WEBHOOK_SECRET in env and configure the endpoint in:
//   Supabase Dashboard → Authentication → Hooks
type SupabaseAuthEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    email: string | null;
    phone: string | null;
    raw_user_meta_data: {
      username?: string;
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      full_name?: string;
    } | null;
  } | null;
  old_record: { id: string } | null;
};

export async function POST(req: Request) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Supabase webhook rejected: SUPABASE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: SupabaseAuthEvent;
  try {
    event = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Only handle auth.users table events
  if (event.table !== "users") {
    return new Response("OK", { status: 200 });
  }

  if (event.type === "INSERT" && event.record) {
    const { id, email, phone, raw_user_meta_data } = event.record;
    const username = await generateUniqueUsername(db, {
      username: raw_user_meta_data?.username,
      email,
      phone,
      firstName: raw_user_meta_data?.first_name,
    });

    await db.user.upsert({
      where: { supabaseId: id },
      update: {},
      create: {
        supabaseId: id,
        email: email ?? null,
        phone: phone ?? null,
        username,
        firstName: raw_user_meta_data?.first_name ?? null,
        lastName: raw_user_meta_data?.last_name ?? null,
        imageUrl: raw_user_meta_data?.avatar_url ?? null,
      },
    });

    if (email) {
      try {
        await sendWelcomeEmail(email, raw_user_meta_data?.first_name ?? "");
      } catch (err) {
        console.error("Welcome email failed:", err);
      }
    }
  }

  if (event.type === "UPDATE" && event.record) {
    const { id, email, phone, raw_user_meta_data } = event.record;

    await db.user.updateMany({
      where: { supabaseId: id },
      data: {
        email: email ?? null,
        phone: phone ?? null,
        firstName: raw_user_meta_data?.first_name ?? null,
        lastName: raw_user_meta_data?.last_name ?? null,
        imageUrl: raw_user_meta_data?.avatar_url ?? null,
      },
    });
  }

  if (event.type === "DELETE" && event.old_record) {
    await db.user.updateMany({
      where: { supabaseId: event.old_record.id },
      data: { isActive: false },
    });
  }

  return new Response("OK", { status: 200 });
}
