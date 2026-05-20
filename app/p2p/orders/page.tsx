import { AppShell } from "@/components/app-shell";
import { P2POrdersClient } from "@/components/p2p-orders-client";

export default function P2POrdersPage() {
  return (
    <AppShell>
      <P2POrdersClient />
    </AppShell>
  );
}
