export default function NeezemSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080c]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-spin { animation: none; }
        }
      `}</style>
    </div>
  );
}
