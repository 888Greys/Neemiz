"use client";

import { useCallback, useEffect, useState } from "react";

// The build this bundle was compiled from (baked at image build via the
// GIT_SHA arg). "dev" locally / when unset → version checking is disabled.
const BAKED_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev";
const POLL_MS = 3 * 60 * 1000; // re-check the server build every few minutes

/**
 * Detects when a newer build has been deployed while the user still has an old
 * bundle loaded (the classic "phone shows an old version after a deploy"
 * problem on a long-lived tab / home-screen app) and offers a one-tap refresh.
 *
 * It NEVER force-reloads — that could interrupt a live bet on a money app — it
 * only surfaces a dismissible prompt and lets the user choose when to refresh.
 */
export function VersionWatcher() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (BAKED_VERSION === "dev") return; // disabled in dev / unversioned builds
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      const serverVersion = data?.version;
      if (serverVersion && serverVersion !== "dev" && serverVersion !== BAKED_VERSION) {
        setUpdateReady(true);
      }
    } catch {
      // offline / transient — ignore, we'll check again next tick
    }
  }, []);

  useEffect(() => {
    if (BAKED_VERSION === "dev") return;
    // Small initial delay so it doesn't compete with first paint.
    const initial = window.setTimeout(check, 8000);
    const interval = window.setInterval(check, POLL_MS);
    // Returning to the tab is the most common moment a stale phone reappears.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setDismissed(false); // a fresh return re-surfaces a pending update
        void check();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  if (!updateReady || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[10000] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111316]/95 px-4 py-3 shadow-2xl backdrop-blur-md">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#087cff]/15 text-base">✨</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">New version available</p>
          <p className="text-[11px] text-slate-400">Refresh to get the latest update.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-xl bg-[#087cff] px-4 py-2 text-xs font-black text-white transition hover:bg-[#1a85ff] active:scale-[.97]"
        >
          Refresh
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg px-1.5 py-1 text-slate-500 transition hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
