import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { sendTestingNoticeEmail } from "@/lib/brevo";

// POST /api/admin/notify-tester
// Body: { email: string; firstName?: string }
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getOrCreateUser(user.id, { email: user.email });
  if (!dbUser.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { email: string; firstName?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.email) return Response.json({ error: "email is required" }, { status: 400 });

  await sendTestingNoticeEmail(body.email, body.firstName);
  return Response.json({ success: true });
}
