export default function NeezemSkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "#08080c" }}
    >
      {/* NEZ + EEM wordmark — blinks */}
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          display: "flex",
          alignItems: "flex-end",
          gap: 0,
          lineHeight: 1,
          animation: "nz-blink 1.4s ease-in-out infinite",
        }}
      >
        <span
          style={{
            fontSize: "clamp(36px, 9vw, 60px)",
            fontWeight: 900,
            letterSpacing: "-0.045em",
            color: "#fff",
          }}
        >
          NEZ
        </span>
        <span
          style={{
            fontSize: "clamp(36px, 9vw, 60px)",
            fontWeight: 900,
            letterSpacing: "-0.045em",
            color: "#ff1838",
          }}
        >
          EEM
        </span>
      </div>

      <style>{`
        @keyframes nz-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
