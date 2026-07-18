"use client";

import { createContext, useContext } from "react";
import type { ProductSurface } from "@/lib/product-surface";

type SiteConfig = {
  surface: ProductSurface;
  brand: string;
};

const SiteConfigContext = createContext<SiteConfig>({
  surface: "full",
  brand: "Nezeem",
});

export function SiteConfigProvider({
  surface,
  brand,
  children,
}: SiteConfig & { children: React.ReactNode }) {
  return (
    <SiteConfigContext.Provider value={{ surface, brand }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext);
}

export function useIsBinarySurface(): boolean {
  return useSiteConfig().surface === "binary";
}
