import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { PageTransition } from "./page-transition";
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

export const metadata: Metadata = {
  title: {
    default: "Nezeem",
    template: "%s | Nezeem",
  },
  description: "A premium betting, predictions, P2P, forex, binary, and Aviator prototype.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Preconnect to Google Fonts so the icon font loads as fast as possible */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* display=block: icons are invisible (not raw text) until the font arrives */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body className={`${jakarta.variable} ${jetBrains.variable} bg-background text-on-background`}>
        <SupabaseAuthProvider>
          <PageTransition>{children}</PageTransition>
          <Toaster />
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
