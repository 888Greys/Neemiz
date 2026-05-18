import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function WalletPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="account_balance_wallet"
        title="Smart Wallet"
        description="Multi-currency wallet. Deposit, withdraw, and transfer instantly."
      />
    </AppShell>
  );
}
