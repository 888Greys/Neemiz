import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminCockpitClient } from "@/components/admin-cockpit-client";

export const metadata = { title: "Admin · Nezeem" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminCockpitClient adminEmail={email} />
    </AdminShell>
  );
}
