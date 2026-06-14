import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, JetBrains_Mono, Pacifico } from "next/font/google";
import { PageTransition } from "./page-transition";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { Toaster } from "@/lib/toast";
import { SupabaseAuthProvider } from "@/lib/supabase/auth-context";
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

export const metadata: Metadata = {
  title: {
    default: "Nezeem",
    template: "%s | Nezeem",
  },
  description: "A premium betting, predictions, P2P, forex, binary, and Aviator prototype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${jakarta.variable} ${jetBrains.variable} ${pacifico.variable} bg-background text-on-background`}>
        <SupabaseAuthProvider>
          <Suspense fallback={null}>
            <NavigationFeedback />
          </Suspense>
          <PageTransition>{children}</PageTransition>
          <Toaster />
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
