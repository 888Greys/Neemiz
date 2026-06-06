"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
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
