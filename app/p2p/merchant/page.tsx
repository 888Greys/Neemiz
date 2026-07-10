import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { P2PMerchantClient } from "@/components/p2p-merchant-client";
import { P2PMarketPanel } from "@/components/p2p-market-panel";

export const metadata = {
  title: "Merchant Center · Nezeem P2P",
};

export default function MerchantPage() {
  return (
    <AppShell rightPanel={<P2PMarketPanel />} hideFooter>
      <Suspense fallback={<div className="flex min-h-[260px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#087cff]" /></div>}>
        <P2PMerchantClient />
      </Suspense>
    </AppShell>
  );
}
