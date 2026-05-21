import { AppShell } from "@/components/app-shell";
import { PolymarketClient } from "@/components/polymarket/polymarket-client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/get-or-create-user";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userId:  string | undefined;
  let balance = 0;

  if (user) {
    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    userId  = dbUser.id;
    balance = Number(dbUser.walletBalance);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="text-lg font-black text-white">Predictions</h1>
            <p className="text-xs text-white/40">
              Bet on real-world events — odds powered by Polymarket
            </p>
          </div>
        </div>

        <PolymarketClient userId={userId} balance={balance} />
      </div>
    </AppShell>
  );
}
