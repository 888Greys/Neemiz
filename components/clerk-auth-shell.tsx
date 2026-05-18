import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function ClerkAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-3 py-5 text-on-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(4,180,162,0.10),transparent_30%)]" />
      <div className="relative w-full max-w-[500px] rounded-[28px] border border-white/10 bg-white/[0.02] p-4 shadow-2xl shadow-black/30">
        <div className="mb-5 text-center">
          <Link href="/" className="inline-flex">
            <BrandLogo size="sm" />
          </Link>
        </div>
        {children}
        <p className="mt-5 text-center text-xs text-slate-600">Protected by Clerk · 256-bit encryption</p>
      </div>
    </main>
  );
}
