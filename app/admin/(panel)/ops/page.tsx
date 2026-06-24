import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { OpsClient } from "@/components/admin-ops-client";

export const metadata = { title: "Operations · Nezeem Admin" };

export default async function OpsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AdminShell adminEmail={user?.email ?? ""}>
      <OpsClient />
    </AdminShell>
  );
}
