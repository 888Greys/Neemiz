import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function PredictionsPage() {
  return (
    <AppShell>
      <ComingSoon
        icon="online_prediction"
        title="Predictions"
        description="Polymarket-style markets. Trade YES/NO on real-world events."
      />
    </AppShell>
  );
}
