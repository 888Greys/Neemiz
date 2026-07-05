export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The build version (git sha) the SERVER is currently running. Clients compare
 * this against the NEXT_PUBLIC_BUILD_VERSION baked into their loaded bundle to
 * detect when a newer deploy is live and prompt a refresh. Never cached.
 */
export function GET() {
  return Response.json(
    { version: process.env.BUILD_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
