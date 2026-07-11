import { AppShell } from "@/components/app-shell";
import { ForexClient } from "@/components/forex/forex-client";

export default function ForexPage() {
  return (
    <AppShell hideFooter fullHeight hideSidebar immersive>
      <ForexClient />
    </AppShell>
  );
}
