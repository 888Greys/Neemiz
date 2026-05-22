import { AppShell } from "@/components/app-shell";
import { AviatorClient } from "@/components/aviator/aviator-client";
import { AviatorSidePanel } from "@/components/aviator/aviator-side-panel";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
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
    <AppShell rightPanel={<AviatorSidePanel />}>
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <h1 className="text-lg font-black text-white">Aviator</h1>
            <p className="text-xs text-white/40">
              Provably fair crash game — cash out before it flies away!
            </p>
          </div>
        </div>

        <AviatorClient
          userId={userId}
          username={username}
          balance={balance}
        />
      </div>
    </AppShell>
  );
}
