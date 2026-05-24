import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { P2PBrowseClient } from "@/components/p2p-browse-client";
import { P2PMarketPanel } from "@/components/p2p-market-panel";

export const metadata = {
  title: "P2P Trading · Nezeem",
  description: "Buy and sell crypto directly with verified merchants. Escrow-protected every trade.",
};

export default function P2PPage() {
  return (
    <AppShell mainBg="bg-[#050505]" rightPanel={<P2PMarketPanel />} hideFooter>
      <div>
        <Suspense>
          <P2PBrowseClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
