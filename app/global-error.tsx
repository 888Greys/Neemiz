"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Errors that mean "this browser is running stale code from a previous
// deploy" — a chunk that no longer exists, or a server payload whose shape
// changed under it. The cure is simply to reload onto the new build.
function isDeploySkewError(error: Error): boolean {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    error?.name === "ChunkLoadError" ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);

    // Auto-recover from deploy-skew errors with a hard reload. Guard with a
    // timestamp: if we already reloaded within the last 10s and still landed
    // here, the reload didn't help (likely a misclassified/genuine bug), so
    // stop and show this page instead of looping. A skew error later still
    // gets its own reload.
    if (isDeploySkewError(error) && typeof window !== "undefined") {
      const KEY = "nz_skew_reload_at";
      const last = Number(sessionStorage.getItem(KEY) ?? "0");
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#101112] px-4 text-white">
        <main className="w-full max-w-md text-center">
          <h1 className="text-2xl font-black">Something went wrong</h1>
          <p className="mt-2 text-sm text-white/55">
            The error has been reported. Try loading the page again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-[#087cff] px-5 py-3 text-sm font-black text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
