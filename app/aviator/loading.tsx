export default function AviatorLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0c0d14 0%, #060709 100%)" }}
    >
      {/* ── Spinning conic rays ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-conic-gradient(rgba(255,24,56,0.05) 0deg 8deg, transparent 8deg 18deg)",
          animation: "nz-spin 4s linear infinite",
          transformOrigin: "center center",
        }}
      />

      {/* ── Radial glow ─────────────────────────────────────────────────── */}
      <div
        className="absolute rounded-full"
        style={{
          width: 340, height: 340,
          background:
            "radial-gradient(circle, rgba(255,24,56,0.13) 0%, rgba(255,24,56,0.04) 45%, transparent 70%)",
          animation: "nz-pulse 2.2s ease-in-out infinite",
        }}
      />

      {/* ── Brand content ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-0 select-none">

        {/* Plane icon */}
        <div
          className="mb-5 text-4xl"
          style={{ animation: "nz-bob 1.8s ease-in-out infinite" }}
        >
          ✈️
        </div>

        {/* NEZEEM wordmark */}
        <div
          className="flex items-end gap-0 leading-none"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <span
            className="font-black text-white"
            style={{
              fontSize: "clamp(40px, 10vw, 64px)",
              letterSpacing: "-0.045em",
            }}
          >
            NEZ
          </span>
          <span
            className="font-black"
            style={{
              fontSize: "clamp(40px, 10vw, 64px)",
              letterSpacing: "-0.045em",
              color: "#ff1838",
              textShadow: "0 0 40px rgba(255,24,56,0.55), 0 0 80px rgba(255,24,56,0.2)",
            }}
          >
            EEM
          </span>
        </div>

        {/* Subtitle */}
        <p
          className="mt-2 font-black uppercase tracking-[0.32em] text-white/30"
          style={{ fontSize: 11 }}
        >
          Aviator
        </p>

        {/* Shimmer bar */}
        <div
          className="relative mt-7 h-[2px] w-36 overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="absolute inset-y-0 w-1/2 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, #ff1838 50%, transparent)",
              animation: "nz-shimmer 1.3s ease-in-out infinite",
            }}
          />
        </div>

        {/* Provably fair tag */}
        <div className="mt-5 flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#31c45d", boxShadow: "0 0 6px #31c45d" }}
          />
          <span
            className="font-black uppercase tracking-[0.22em] text-white/20"
            style={{ fontSize: 9 }}
          >
            Provably Fair
          </span>
        </div>
      </div>

      {/* ── Keyframes ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes nz-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nz-pulse {
          0%, 100% { opacity: .55; transform: scale(.92); }
          50%       { opacity: 1;   transform: scale(1.06); }
        }
        @keyframes nz-bob {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50%       { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes nz-shimmer {
          0%   { left: -60%; }
          100% { left: 120%; }
        }
      `}</style>
    </div>
  );
}
