// Clerk webhook — no longer used. Migrated to Supabase Auth.
// See /api/webhooks/supabase for the replacement.
export async function POST() {
  return new Response("Gone — use /api/webhooks/supabase", { status: 410 });
}
