import React from "react";

function Sk({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`skeleton rounded ${className}`} style={style} />;
}

export default function CasinoCategoryLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-3 py-6 md:px-6">
      {/* Breadcrumb + title */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Sk className="h-4 w-16 rounded" />
          <Sk className="h-4 w-3 rounded" />
          <Sk className="h-4 w-24 rounded" />
        </div>
        <Sk className="h-8 w-48 rounded" />
      </div>

      {/* Filter chips */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} className="h-9 w-20 shrink-0 rounded-2xl" />
        ))}
      </div>

      {/* Game grid — 3:4 aspect-ratio cards */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {Array.from({ length: 24 }).map((_, i) => (
          <Sk
            key={i}
            className="w-full rounded-2xl"
            style={{ aspectRatio: "3/4" }}
          />
        ))}
      </div>
    </div>
  );
}
