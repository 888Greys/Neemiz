import { AppShell } from "@/components/app-shell";
import { P2PBrowseClient } from "@/components/p2p-browse-client";

export const metadata = {
  title: "P2P Trading · Nezeem",
  description: "Buy and sell crypto directly with verified merchants. Escrow-protected every trade.",
};

export default function P2PPage() {
  return (
    <AppShell>
      <P2PBrowseClient />
    </AppShell>
  );
}
