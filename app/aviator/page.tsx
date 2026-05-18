import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function AviatorPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="rocket_launch"
        title="Aviator"
        description="Provably fair crash game. Cash out before the plane flies away."
      />
    </AppShell>
  );
}
