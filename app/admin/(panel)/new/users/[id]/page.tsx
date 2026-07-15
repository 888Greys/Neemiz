import { AdminUserDetailClient } from "@/components/admin-user-detail-client";

export const metadata = { title: "User Investigation · Nezeem Admin" };

// The investigation view is the one screen with no hand-ported v2 counterpart.
// It renders inside the new shell (see ../../layout.tsx) and is recoloured by
// the .admin-v2 theme bridge, same as the other not-yet-ported screens.
export default function NewAdminUserDetailPage({ params }: { params: { id: string } }) {
  return <AdminUserDetailClient userId={params.id} />;
}
