import { AdminV2Money } from "@/components/admin-v2/money";

export const metadata = { title: "Money · Nezeem Admin" };

export default function NewAdminMoneyPage({ searchParams }: { searchParams: { tab?: string } }) {
  return <AdminV2Money initialTab={searchParams.tab === "pnl" ? "pnl" : "cashflow"} />;
}
