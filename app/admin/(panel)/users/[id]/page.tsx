import { AdminUserDetailClient } from "@/components/admin-user-detail-client";

export const metadata = { title: "User Investigation · Admin · Nezeem" };

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  return <AdminUserDetailClient userId={params.id} />;
}
