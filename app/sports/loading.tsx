function Sk({ className }: { className: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function SportsLoading() {
  return (
    <div>
      {/* Sport chips */}
      <div className="flex gap-2 border-b border-outline-variant px-4 py-3">
        {[88, 110, 72, 90, 102].map((w, i) => (
          <Sk key={i} className="h-8 shrink-0 rounded-full" style={{ width: w }} />
        ))}
      </div>
      {/* Live / Upcoming / Outrights tabs */}
      <div className="px-4 py-3">
        <Sk className="h-9 w-56 rounded" />
      </div>
      {/* Coming soon block */}
      <div className="flex flex-col items-center justify-center px-6 py-24">
        <Sk className="mb-6 h-20 w-20 rounded-full" />
        <Sk className="mb-3 h-7 w-40 rounded" />
        <Sk className="h-4 w-64 rounded" />
        <Sk className="mt-2 h-4 w-48 rounded" />
        <Sk className="mt-6 h-9 w-36 rounded-full" />
      </div>
    </div>
  );
}
