import { AppShell } from "@/components/app-shell";
import { AviatorClient } from "@/components/aviator/aviator-client";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

export default async function AviatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userId:   string | undefined;
  let username: string | undefined;
  let balance = 0;

  if (user) {
    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    userId   = dbUser.id;
    username = dbUser.username ?? undefined;
    balance  = Number(dbUser.walletBalance);
  }

  return (
    <AppShell mainBg="bg-[#050505]">
      <div className="w-full px-2 py-2 sm:px-3">
        <AviatorClient
          userId={userId}
          username={username}
          balance={balance}
        />
      </div>
    </AppShell>
  );
}
