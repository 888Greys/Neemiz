import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-2fa";
import { Admin2FAClient } from "@/components/admin-2fa-client";

export const metadata = { title: "Admin 2FA · Nezeem" };

export default async function Admin2FAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const dbUser = await db.user.findUnique({
    where: { supabaseId: user.id },
    select: { isAdmin: true, totpEnabled: true },
  });
  if (!dbUser?.isAdmin) redirect("/");

  // If 2FA already verified in this session, go straight to admin
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token && verifyAdminToken(token)) redirect("/admin");

  const email = user.email ?? "";

  return (
    <div className="min-h-screen bg-[#08080c] text-white">
      <div className="fixed left-4 top-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-[#087cff]" />
          <span className="text-sm font-black text-white">Nezeem Admin</span>
        </div>
      </div>
      <Admin2FAClient totpEnabled={!!dbUser.totpEnabled} adminEmail={email} />
    </div>
  );
}
