import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBinarySurface } from "@/lib/product-surface";
import { BinaryKeAuthPage } from "@/components/binary-ke/auth-page";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");

  // Nezeem still uses dashboard modals — keep the old bounce.
  if (!isBinarySurface({ host })) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/binary");

  return <BinaryKeAuthPage initialTab="register" />;
}
