import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Shared Deriv tick feed + tick-driven settle due-list. No-op when
    // DERIV_FEED=0 or WebSocket is unavailable. Fail-closed callers still fall
    // back to one-shot history; cron remains the abandoned-browser safety net.
    try {
      const { startTickSettlement } = await import("./lib/settle-boot");
      await startTickSettlement();
    } catch (err) {
      console.warn("[instrumentation] tick settlement start skipped", err);
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
