import { AppShell } from "@/components/app-shell";
import { P2POrdersClient } from "@/components/p2p-orders-client";
import { P2PMarketPanel } from "@/components/p2p-market-panel";

export default function P2POrdersPage() {
  return (
    <AppShell mainBg="bg-[#050505]" rightPanel={<P2PMarketPanel />} hideFooter>
      <P2POrdersClient />
    </AppShell>
  );
}
