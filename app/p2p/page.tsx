import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { P2PBrowseClient } from "@/components/p2p-browse-client";
import { P2PMarketPanel } from "@/components/p2p-market-panel";
import { detectFiatFromHeaders, isSupportedFiat } from "@/lib/p2p/currencies";

export const metadata = {
  title: "P2P Trading · Nezeem",
  description: "Buy and sell crypto directly with verified merchants. Escrow-protected every trade.",
};

// Read per-request so the visitor's geo headers are honoured (not cached at build).
export const dynamic = "force-dynamic";

export default function P2PPage() {
  // Manual choice (cookie) wins over auto-detected geo currency.
  const cookieFiat = cookies().get("user_fiat")?.value;
  const defaultFiat = isSupportedFiat(cookieFiat)
    ? cookieFiat!
    : "__ALL__";

  return (
    <AppShell rightPanel={<P2PMarketPanel />} hideFooter>
      <div className="min-h-full bg-[#151518]">
        <Suspense>
          <P2PBrowseClient defaultFiat={defaultFiat} />
        </Suspense>
      </div>
    </AppShell>
  );
}
