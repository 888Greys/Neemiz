import { AdminV2UserAudit } from "@/components/admin-v2/user-audit";

export const metadata = { title: "Player Audit · Nezeem Admin" };

export default function NewAdminUserDetailPage({ params }: { params: { id: string } }) {
  return <AdminV2UserAudit userId={params.id} />;
}
