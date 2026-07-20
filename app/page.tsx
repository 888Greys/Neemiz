import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBinarySurface, surfaceBrand } from "@/lib/product-surface";
import { BinaryKeLandingPage } from "@/components/binary-ke/landing-page";
import { MoneyBinaryLandingPage } from "@/components/moneybinary/landing-page";

// One image serves Nezeem + Binary brands; surface is chosen at runtime via env.
// Must stay dynamic so Next never bakes a static "/" → /dashboard redirect.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const binary = isBinarySurface({ host });
  const brand = surfaceBrand({ host });

  // Binary surface: never send guests (or anyone) to /dashboard from here.
  // /dashboard → /binary remains intentional in middleware for deep links.
  if (binary) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/binary");
    }

    if (brand === "MoneyBinary") {
      return <MoneyBinaryLandingPage />;
    }

    return <BinaryKeLandingPage />;
  }

  redirect("/dashboard");
}
