export function RouteLoading() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="h-14 border-b border-white/10 bg-[#111113] lg:h-20" />
      <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5 lg:px-8">
        <div className="h-32 animate-pulse rounded-3xl bg-white/[0.05] sm:h-44" />
        <div className="mt-6 flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-10 w-24 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      </div>
    </div>
  );
}
