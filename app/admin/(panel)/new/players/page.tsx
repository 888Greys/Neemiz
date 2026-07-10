import { AdminV2Players } from "@/components/admin-v2/players";

export const metadata = { title: "Players · Nezeem Admin" };

export default function NewAdminPlayersPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  return <AdminV2Players initialTab={searchParams.tab === "directory" ? "directory" : "overview"} />;
}
