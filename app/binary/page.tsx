import { AppShell } from "@/components/app-shell";
import { BinaryClient } from "@/components/binary/binary-client";
import { BinaryMaintenance } from "@/components/binary/binary-maintenance";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { isBinaryOptionsInMaintenance, binaryLiveFamilies } from "@/lib/game-guard";
import { TRADE_TYPES, liveTradeTypes } from "@/components/binary/trade-types";

export const dynamic = "force-dynamic";

export default async function BinaryPage() {
  const maint = await isBinaryOptionsInMaintenance();
  const allTypes = TRADE_TYPES.map((t) => t.id);
  const liveTypes = maint ? liveTradeTypes(await binaryLiveFamilies()) : allTypes;

  if (liveTypes.length === 0) {
    return (
      <AppShell hideFooter fullHeight hideSidebar>
        <BinaryMaintenance />
      </AppShell>
    );
  }

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
    <AppShell hideFooter fullHeight hideSidebar>
      <BinaryClient userId={userId} username={username} balance={balance} liveTypes={liveTypes} />
    </AppShell>
  );
}
