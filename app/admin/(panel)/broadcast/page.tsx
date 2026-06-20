import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminBroadcastClient } from "@/components/admin-broadcast-client";

export const metadata = { title: "Broadcast · Admin · Nezeem" };

export default async function AdminBroadcastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminBroadcastClient />
    </AdminShell>
  );
}
