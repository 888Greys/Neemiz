import { AdminV2Money } from "@/components/admin-v2/money";

export const metadata = { title: "Money · Nezeem Admin" };

export default function NewAdminMoneyPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "pnl" ? "pnl" : searchParams.tab === "promos" ? "promos" : "cashflow";
  return <AdminV2Money initialTab={tab} />;
}
