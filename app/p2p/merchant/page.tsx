import { AppShell } from "@/components/app-shell";
import { P2PMerchantClient } from "@/components/p2p-merchant-client";
import { P2PMarketPanel } from "@/components/p2p-market-panel";

export const metadata = {
  title: "Merchant Center · Nezeem P2P",
};

export default function MerchantPage() {
  return (
    <AppShell rightPanel={<P2PMarketPanel />} hideFooter>
      <P2PMerchantClient />
    </AppShell>
  );
}
