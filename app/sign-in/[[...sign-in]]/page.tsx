import { redirect } from "next/navigation";

// Auth is now handled via the login modal on the home/dashboard page.
export default function SignInPage() {
  redirect("/");
}
