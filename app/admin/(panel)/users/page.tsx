import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminUsersClient } from "@/components/admin-users-client";

export const metadata = { title: "Users · Admin · Nezeem" };

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminUsersClient />
    </AdminShell>
  );
}
