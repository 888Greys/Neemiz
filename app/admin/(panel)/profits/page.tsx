import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminProfitsClient } from "@/components/admin-profits-client";

export const metadata = { title: "Profits · Admin · Nezeem" };

export default async function AdminProfitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminProfitsClient />
    </AdminShell>
  );
}
