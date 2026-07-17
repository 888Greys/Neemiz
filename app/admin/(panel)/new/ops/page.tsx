import { Suspense } from "react";
import { OpsHub } from "@/components/admin-v2/ops-hub";

export const metadata = { title: "Ops · Nezeem Admin" };

export default function NewAdminOpsPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#adc6ff]" /></div>}>
      <OpsHub />
    </Suspense>
  );
}
