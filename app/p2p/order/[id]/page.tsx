import { AppShell } from "@/components/app-shell";
import { P2POrderClient } from "@/components/p2p-order-client";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell hideFooter>
      <P2POrderClient orderId={id} />
    </AppShell>
  );
}
