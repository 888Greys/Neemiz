import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { RiskClient } from "@/components/admin-risk-client";

export const metadata = { title: "Risk · Nezeem Admin" };

export default async function RiskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AdminShell adminEmail={user?.email ?? ""}>
      <RiskClient />
    </AdminShell>
  );
}
