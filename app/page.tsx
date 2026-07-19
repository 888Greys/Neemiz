import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBinarySurface } from "@/lib/product-surface";
import { BinaryKeLandingPage } from "@/components/binary-ke/landing-page";

export default async function RootPage() {
  if (!isBinarySurface()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/binary");
  }

  return <BinaryKeLandingPage />;
}
