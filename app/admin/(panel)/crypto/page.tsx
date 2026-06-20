import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";
import { AdminCryptoClient } from "@/components/admin-crypto-client";

export const metadata = { title: "Crypto exposure · Admin · Nezeem" };

export default async function AdminCryptoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  return (
    <AdminShell adminEmail={email}>
      <AdminCryptoClient />
    </AdminShell>
  );
}
