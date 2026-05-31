import { AppShell } from "@/components/app-shell";
import { ForexClient } from "@/components/forex/forex-client";

export default function ForexPage() {
  return (
    <AppShell mainBg="bg-[#050506]" hideFooter fullHeight hideSidebar>
      <ForexClient />
    </AppShell>
  );
}
