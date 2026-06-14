// Instant skeleton on tap for the Markets (predictions) tab.
export default function PredictionsLoading() {
  return (
    <div className="animate-pulse p-3 md:p-4">
      <div className="mb-4 h-7 w-40 rounded-lg bg-white/[0.05]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/[0.025]" />
        ))}
      </div>
    </div>
  );
}
