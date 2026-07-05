import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { isOwnerEmail } from "@/lib/admin-allowlist";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Defense-in-depth: admin access requires an allowlisted owner email, not
  // just is_admin (DB-writable). See lib/admin-allowlist.ts.
  if (!isOwnerEmail(user.email)) redirect("/");

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) redirect("/");

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyAdminToken(token)) redirect("/admin/2fa");

  return <>{children}</>;
}
