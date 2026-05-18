import React from "react";

function Sk({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded ${className}`} style={style} />;
}

export default function FixtureLoading() {
  return (
    <div className="mx-auto max-w-[900px] px-3 py-4 md:px-6">
      {/* Back bar */}
      <div className="mb-4 flex items-center gap-3">
        <Sk className="h-9 w-9 rounded-xl" />
        <Sk className="h-5 w-32 rounded" />
        <Sk className="ml-auto h-9 w-24 rounded-xl" />
      </div>

      {/* Match card */}
      <div className="mb-4 rounded-2xl bg-[#16171d] p-5">
        <div className="mb-4 flex items-center justify-between">
          <Sk className="h-3 w-24 rounded" />
          <Sk className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 flex-col items-center gap-2">
            <Sk className="h-14 w-14 rounded-full" />
            <Sk className="h-4 w-20 rounded" />
          </div>
          <Sk className="h-10 w-24 rounded-xl" />
          <div className="flex flex-1 flex-col items-center gap-2">
            <Sk className="h-14 w-14 rounded-full" />
            <Sk className="h-4 w-20 rounded" />
          </div>
        </div>
        {/* Period info */}
        <div className="mt-4 flex justify-center gap-6">
          <Sk className="h-4 w-16 rounded" />
          <Sk className="h-4 w-16 rounded" />
        </div>
      </div>

      {/* Tab pills */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} className="h-9 w-24 shrink-0 rounded-2xl" />
        ))}
      </div>

      {/* Market accordion blocks */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-3 rounded-2xl bg-[#16171d] p-4">
          <div className="mb-3 flex items-center justify-between">
            <Sk className="h-5 w-36 rounded" />
            <Sk className="h-5 w-5 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Sk key={j} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
