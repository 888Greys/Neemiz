import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function P2PPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="swap_horiz"
        title="P2P Trading"
        description="Buy and sell with real merchants. Escrow-protected every trade."
      />
    </AppShell>
  );
}
