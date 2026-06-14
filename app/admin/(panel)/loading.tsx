// Instant skeleton while an admin panel route resolves — mirrors the main
// site's perceived-speed pattern so admin navigation never shows a blank page.
export default function AdminPanelLoading() {
  return (
    <div className="min-h-screen animate-pulse p-4 md:p-6">
      <div className="mb-6 h-8 w-56 rounded-lg bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl ring-1 ring-white/[0.06] md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 bg-white/[0.025]" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-xl bg-white/[0.025] lg:col-span-2" />
        <div className="h-64 rounded-xl bg-white/[0.025]" />
      </div>
    </div>
  );
}
