import { AppShell } from "@/components/app-shell";
import { MyBetsClient } from "@/components/my-bets-client";
import { SportsBetSlip } from "@/components/sports-bet-slip";

export const metadata = { title: "My Bets · Nezeem" };

export default function MyBetsPage() {
  return (
    <AppShell
      rightPanel={
        <div className="hidden h-full w-[320px] shrink-0 border-l border-white/[0.07] xl:block">
          <SportsBetSlip />
        </div>
      }
    >
      <MyBetsClient />
    </AppShell>
  );
}
