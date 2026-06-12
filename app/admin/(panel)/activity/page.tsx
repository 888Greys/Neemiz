import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminActivityClient } from "@/components/admin-activity-client";

export const metadata = { title: "Product Activity · Admin · Nezeem" };

export default async function AdminActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AdminShell adminEmail={user?.email ?? ""}>
      <AdminActivityClient />
    </AdminShell>
  );
}
