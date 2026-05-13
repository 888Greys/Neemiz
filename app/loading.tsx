import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return (
    <main className="hero-bg flex min-h-screen items-center justify-center px-6 text-on-surface">
      <div className="w-full max-w-sm text-center">
        <BrandLogo size="lg" animated />
        <div className="mx-auto mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="loading-scan h-full w-20 rounded-full bg-primary shadow-[0_0_24px_rgba(78,222,163,0.7)]" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant">
          Preparing market access
        </p>
      </div>
    </main>
  );
}
