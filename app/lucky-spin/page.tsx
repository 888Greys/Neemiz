import { AppShell } from "@/components/app-shell";
import { LuckySpinView } from "@/components/lucky-spin-view";

export const metadata = { title: "Lucky Spin · Nezeem" };

export default function LuckySpinPage() {
  return (
    <AppShell>
      <LuckySpinView />
    </AppShell>
  );
}
