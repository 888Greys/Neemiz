import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { AdminDashboardClient } from "@/components/admin-dashboard-client";

export const metadata = { title: "Admin · Nezeem" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AppShell>
      <AdminDashboardClient adminEmail={email} />
    </AppShell>
  );
}
