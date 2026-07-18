import { redirect } from "next/navigation";
import { isBinarySurface } from "@/lib/product-surface";

export default function RootPage() {
  redirect(isBinarySurface() ? "/binary" : "/dashboard");
}
