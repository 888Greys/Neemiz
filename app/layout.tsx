import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, JetBrains_Mono, Pacifico } from "next/font/google";
import { PageTransition } from "./page-transition";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { Toaster } from "@/lib/toast";
import { VersionWatcher } from "@/components/version-watcher";
import { SupabaseAuthProvider } from "@/lib/supabase/auth-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { resolveDisplayCurrency } from "@/lib/currency-server";
import { SiteConfigProvider } from "@/lib/site-config-context";
import { productSurface, surfaceBrand } from "@/lib/product-surface";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const jetBrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = surfaceBrand();
  const binary = productSurface() === "binary";
  return {
    title: {
      default: brand,
      template: `%s | ${brand}`,
    },
    description: binary
      ? `${brand} — binary options trading.`
      : "A premium betting, predictions, P2P, forex, binary, and Aviator prototype.",
    // Dynamic app/icon.tsx + app/apple-icon.tsx read PRODUCT_SURFACE at runtime.
    // Static favicon.ico is still Nezeem; Binary rewrites it in proxy.ts.
    icons: {
      icon: [{ url: "/icon", type: "image/png" }],
      apple: [{ url: "/apple-icon", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { code: currencyCode, toKES } = await resolveDisplayCurrency();
  const surface = productSurface();
  const brand = surfaceBrand();
  return (
    <html lang="en" className="dark" data-surface={surface}>
      <body className={`${jakarta.variable} ${jetBrains.variable} ${pacifico.variable} bg-background text-on-background`}>
        <SiteConfigProvider surface={surface} brand={brand}>
          <SupabaseAuthProvider>
            <CurrencyProvider initialCode={currencyCode} toKES={toKES}>
              <Suspense fallback={null}>
                <NavigationFeedback />
              </Suspense>
              {/* Suspense boundary so client hooks that read the URL query
                  (useSearchParams in AppShell's section-aware bottom nav) don't
                  force a CSR bailout / build error on prerendered routes. */}
              <Suspense fallback={null}>
                <PageTransition>{children}</PageTransition>
              </Suspense>
              <Toaster />
              <VersionWatcher />
            </CurrencyProvider>
          </SupabaseAuthProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
