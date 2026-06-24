import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { MoneyClient } from "@/components/admin-money-client";

export const metadata = { title: "Money · Nezeem Admin" };

export default async function MoneyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AdminShell adminEmail={user?.email ?? ""}>
      <MoneyClient />
    </AdminShell>
  );
}
