import React from "react";

function Sk({ className }: { className: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export default function WalletLoading() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24">
      <Sk className="mb-6 h-20 w-20 rounded-full" />
      <Sk className="mb-3 h-7 w-40 rounded" />
      <Sk className="h-4 w-64 rounded" />
      <Sk className="mt-2 h-4 w-52 rounded" />
      <Sk className="mt-6 h-9 w-36 rounded-full" />
    </div>
  );
}
