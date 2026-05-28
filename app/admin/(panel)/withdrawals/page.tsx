import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminWithdrawalsClient } from "@/components/admin-withdrawals-client";

export const metadata = { title: "Withdrawals · Admin · Nezeem" };

export default async function AdminWithdrawalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminWithdrawalsClient />
    </AdminShell>
  );
}
