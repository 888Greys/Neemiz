// Instant skeleton on tap so the Sports tab responds immediately instead of
// freezing on the previous page while fixtures load.
export default function SportsLoading() {
  return (
    <div className="animate-pulse space-y-3 p-3 md:p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white/[0.025] p-4">
          <div className="mb-3 h-3 w-24 rounded bg-white/[0.05]" />
          <div className="mb-2 h-4 w-40 rounded bg-white/[0.05]" />
          <div className="mb-4 h-4 w-36 rounded bg-white/[0.05]" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 rounded-lg bg-white/[0.04]" />
            <div className="h-10 rounded-lg bg-white/[0.04]" />
            <div className="h-10 rounded-lg bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
