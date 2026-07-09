import { AppShell } from "@/components/app-shell";
import { PolymarketClient } from "@/components/polymarket/polymarket-client";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { fetchMarkets } from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export default async function PolymarketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userId:  string | undefined;
  let balance = 0;

  if (user) {
    const dbUser = await getOrCreateUser(user.id, { email: user.email });
    userId  = dbUser.id;
    balance = Number(dbUser.walletBalance);
  }

  const initialMarkets = await fetchMarkets({ limit: 24 });

  return (
    <AppShell>
      <div className="min-h-full w-full bg-[#151518] px-3 py-3 sm:px-4 lg:px-5">
        <PolymarketClient userId={userId} balance={balance} initialMarkets={initialMarkets} />
      </div>
    </AppShell>
  );
}
