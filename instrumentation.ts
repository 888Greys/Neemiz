import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Shared Deriv tick feed — one persistent WS per worker so bet/settle
    // paths don't open a fresh connection per request. No-op when DERIV_FEED=0
    // or WebSocket is unavailable. Fail-closed callers still fall back to
    // one-shot history fetches when the feed isn't ready.
    try {
      const { startDerivFeed } = await import("./lib/deriv-feed");
      startDerivFeed();
    } catch (err) {
      console.warn("[instrumentation] deriv feed start skipped", err);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
