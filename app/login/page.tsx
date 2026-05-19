import { redirect } from "next/navigation";

// Auth is now handled via modals. Redirect to home.
export default function LoginPage() {
  redirect("/");
}
