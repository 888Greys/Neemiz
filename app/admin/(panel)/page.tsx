import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminDashboardClient } from "@/components/admin-dashboard-client";

export const metadata = { title: "Admin · Nezeem" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminDashboardClient adminEmail={email} />
    </AdminShell>
  );
}
