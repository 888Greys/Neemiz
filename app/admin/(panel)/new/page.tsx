import { redirect } from "next/navigation";

// The console lands straight on Money — the owner's first screen is the money.
export default function NewAdminIndexPage() {
  redirect("/admin/new/money-cockpit");
}
