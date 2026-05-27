import { AppShell } from "@/components/app-shell";
import { WalletClient } from "@/components/wallet-client";

export const metadata = {
  title: "Wallet · Nezeem",
  description: "Deposit, withdraw, and manage your Nezeem wallet.",
};

export default function WalletPage() {
  return (
    <AppShell hideFooter>
      <WalletClient />
    </AppShell>
  );
}
