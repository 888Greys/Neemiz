import { redirect } from "next/navigation";

// The user directory now lives as a tab on the unified Players page. Keep this
// path working for bookmarks/back-links by forwarding to that tab.
export default function AdminUsersPage() {
  redirect("/admin/players?tab=directory");
}
