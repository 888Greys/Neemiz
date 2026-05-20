import { AppShell } from "@/components/app-shell";
import { MyBetsClient } from "@/components/my-bets-client";

export const metadata = { title: "My Bets · Nezeem" };

export default function MyBetsPage() {
  return (
    <AppShell>
      <MyBetsClient />
    </AppShell>
  );
}
