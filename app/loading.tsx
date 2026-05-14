function Sk({ className }: { className: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

function SidebarGroupSkeleton() {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-3 px-2 py-1.5">
        <Sk className="h-8 w-8 rounded-full" />
        <Sk className="h-4 w-20 rounded" />
      </div>
      <div className="ml-4 space-y-1 border-l border-white/10 pl-4">
        {[72, 56, 64, 48, 60].map((w) => (
          <div key={w} className="flex items-center gap-3 px-3 py-2.5">
            <Sk className="h-5 w-5 rounded" />
            <Sk className={`h-3.5 w-${w === 72 ? "[72px]" : w === 56 ? "[56px]" : w === 64 ? "[64px]" : w === 48 ? "[48px]" : "[60px]"} rounded`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardContentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      {/* Hero + side cards */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Sk className="h-[300px] rounded-[28px]" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <Sk className="h-[140px] rounded-[28px]" />
          <Sk className="h-[140px] rounded-[28px]" />
        </div>
      </div>

      {/* Search + filter */}
      <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_400px]">
        <Sk className="h-14 rounded-2xl" />
        <Sk className="h-14 rounded-2xl" />
      </div>

      {/* Chip row */}
      <div className="mt-6 flex gap-2 overflow-hidden">
        {[120, 90, 110, 80, 100, 95, 88, 42].map((w, i) => (
          <Sk key={i} className="h-12 shrink-0 rounded-2xl" style={{ width: w }} />
        ))}
      </div>

      {/* Product category cards */}
      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div className="space-y-2">
            <Sk className="h-3 w-28 rounded" />
            <Sk className="h-6 w-44 rounded" />
          </div>
          <Sk className="h-10 w-32 rounded-2xl" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Sk key={i} className="h-[178px] rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Games grid */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <Sk className="h-6 w-32 rounded" />
          <Sk className="h-10 w-24 rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Sk key={i} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#08080c]">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center bg-[#111113] px-3 lg:h-20 lg:px-0">
        <div className="hidden h-full w-[280px] shrink-0 items-center border-r border-white/10 px-4 lg:flex">
          <Sk className="h-10 w-10 rounded-full" />
          <div className="ml-3 flex-1 space-y-2">
            <Sk className="h-4 w-20 rounded" />
            <Sk className="h-3 w-12 rounded" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between gap-3 lg:px-6">
          <div className="flex items-center gap-6">
            <Sk className="h-7 w-24 rounded-lg" />
            <Sk className="hidden h-11 w-[360px] rounded-2xl md:block" />
          </div>
          <div className="flex gap-2">
            <Sk className="h-10 w-20 rounded-xl" />
            <Sk className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex h-screen overflow-hidden pt-14 lg:pt-20">
        {/* Sidebar */}
        <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#1b1c20] p-4 lg:block">
          <SidebarGroupSkeleton />
          <SidebarGroupSkeleton />
          <div className="border-t border-white/10 pb-4" />
          <div className="mt-4 space-y-2">
            <Sk className="h-10 rounded-xl" />
            <Sk className="h-10 rounded-xl" />
            <Sk className="h-10 rounded-xl" />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 pb-24 md:p-6 lg:pb-6">
          <DashboardContentSkeleton />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-12 items-center justify-around border-t border-white/10 bg-[#111113] lg:hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Sk className="h-5 w-5 rounded" />
            <Sk className="h-2 w-8 rounded" />
          </div>
        ))}
      </nav>
    </div>
  );
}
