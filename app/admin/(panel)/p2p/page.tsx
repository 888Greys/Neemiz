import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminP2PClient } from "@/components/admin-p2p-client";

export const metadata = { title: "P2P Admin · Nezeem" };

export default async function AdminP2PPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminP2PClient />
    </AdminShell>
  );
}
