import { redirect } from "next/navigation";

// Wallet is now a floating modal opened from the app shell.
// Redirect any direct /wallet visits back to the dashboard.
export default function WalletPage() {
  redirect("/dashboard");
}
