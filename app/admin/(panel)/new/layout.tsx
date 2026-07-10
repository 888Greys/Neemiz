import { createClient } from "@/lib/supabase/server";
import { AdminV2Shell } from "@/components/admin-v2/shell";

// Shared chrome for the redesigned admin console. Every /admin/new/* screen
// renders inside the new Stitch shell (sidebar + top bar).
export default async function NewAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <AdminV2Shell adminEmail={user?.email ?? ""}>{children}</AdminV2Shell>;
}
