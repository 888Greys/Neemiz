import { redirect } from "next/navigation";

// Profile is now a floating modal opened from the app shell.
// Redirect any direct /profile visits back to the dashboard.
export default function ProfilePage() {
  redirect("/dashboard");
}
