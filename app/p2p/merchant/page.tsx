import { AppShell } from "@/components/app-shell";
import { P2PMerchantClient } from "@/components/p2p-merchant-client";

export const metadata = {
  title: "Merchant Center · Nezeem P2P",
};

export default function MerchantPage() {
  return (
    <AppShell>
      <P2PMerchantClient />
    </AppShell>
  );
}
