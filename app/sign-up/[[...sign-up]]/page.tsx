import { redirect } from "next/navigation";

// Auth is now handled via the register modal on the home/dashboard page.
export default function SignUpPage() {
  redirect("/");
}
