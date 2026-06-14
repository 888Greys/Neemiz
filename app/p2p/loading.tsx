// Instant skeleton on tap for the P2P tab.
export default function P2pLoading() {
  return (
    <div className="animate-pulse p-3 md:p-4">
      <div className="mb-4 h-9 w-full rounded-xl bg-white/[0.04]" />
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.025]" />
        ))}
      </div>
    </div>
  );
}
