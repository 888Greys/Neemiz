import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { PlayersClient } from "@/components/admin-players-client";

export const metadata = { title: "Players · Nezeem Admin" };

export default async function PlayersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AdminShell adminEmail={user?.email ?? ""}>
      <PlayersClient />
    </AdminShell>
  );
}
