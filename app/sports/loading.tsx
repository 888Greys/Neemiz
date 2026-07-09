// Instant skeleton matching wallet-clean flat rows + sticky chrome.
export default function SportsLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-[#151518]">
      {/* Sport strip */}
      <div className="border-b border-white/[0.06] bg-[#151518] px-3 pb-2 pt-2.5">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex shrink-0 flex-col items-center gap-1 px-1">
              <div className="h-9 w-9 rounded-full bg-white/[0.06] ring-1 ring-white/[0.06]" />
              <div className="h-2 w-10 rounded bg-white/[0.05]" />
            </div>
          ))}
        </div>
        <div className="mt-2.5 h-10 w-full rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]" />
      </div>

      {/* All / Live tabs */}
      <div className="flex items-center gap-6 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div className="h-3 w-8 rounded bg-white/[0.07]" />
        <div className="h-3 w-10 rounded bg-white/[0.05]" />
      </div>

      {/* Section label */}
      <div className="px-3 py-2.5 sm:px-4">
        <div className="h-3.5 w-16 rounded bg-white/[0.07]" />
      </div>

      {/* League header + flat match rows */}
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g}>
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
            <div className="h-4 w-4 rounded-full bg-white/[0.06]" />
            <div className="h-3 w-28 rounded bg-white/[0.06]" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-b border-white/[0.06] px-3 py-3 sm:px-4">
              <div className="mb-2.5 h-2.5 w-24 rounded bg-white/[0.05]" />
              <div className="mb-2 flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
                <div className="h-3.5 flex-1 rounded bg-white/[0.06]" />
              </div>
              <div className="mb-3 flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-white/[0.06]" />
                <div className="h-3.5 flex-1 rounded bg-white/[0.06]" />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="h-11 rounded-lg bg-white/[0.05]" />
                <div className="h-11 rounded-lg bg-white/[0.05]" />
                <div className="h-11 rounded-lg bg-white/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
