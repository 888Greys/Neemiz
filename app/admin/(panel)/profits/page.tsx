import { redirect } from "next/navigation";

// The daily P&L statement now lives as a tab on the unified Money page.
export default function AdminProfitsPage() {
  redirect("/admin/money?tab=pnl");
}
