// Instant skeleton on tap for the Aviator tab (it blocks on auth + user lookup).
export default function AviatorLoading() {
  return (
    <div className="animate-pulse p-3 md:p-4">
      <div className="mb-3 h-56 rounded-2xl bg-white/[0.03] md:h-72" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-2xl bg-white/[0.025]" />
        <div className="h-28 rounded-2xl bg-white/[0.025]" />
      </div>
    </div>
  );
}
