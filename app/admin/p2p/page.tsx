import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminP2PClient } from "@/components/admin-p2p-client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export default async function AdminP2PPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const dbUser = await db.user.findUnique({ where: { supabaseId: user.id }, select: { isAdmin: true } });
  if (!dbUser?.isAdmin) redirect("/");

  return (
    <AppShell>
      <AdminP2PClient />
    </AppShell>
  );
}
