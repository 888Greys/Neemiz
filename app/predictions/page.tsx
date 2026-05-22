import { AppShell } from "@/components/app-shell";
import { PolymarketClient } from "@/components/polymarket/polymarket-client";
import { createClient } from "@/lib/supabase/server";
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
      <div className="mx-auto max-w-[1520px] px-3 py-3 sm:px-4">
        <PolymarketClient userId={userId} balance={balance} />
      </div>
    </AppShell>
  );
}
