import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function BinaryPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="candlestick_chart"
        title="Binary & Forex"
        description="Up or down. Trade currency pairs with fixed risk, fixed reward."
      />
    </AppShell>
  );
}
