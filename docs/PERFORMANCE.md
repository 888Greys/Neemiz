# Website Performance

Nezeem is optimized for users who may be far from the production database. The
main strategy is to avoid blocking page transitions on repeated network round
trips while keeping financial mutations authoritative on the server.

## Implemented Improvements

### Route prefetching

Use Next.js link prefetching for links currently visible to the user. Do not
prefetch every primary route from `AppShell`: on a self-hosted Next.js server,
that turns each visit into several extra server-render requests and competes
with real navigation traffic.

Primary desktop navigation links additionally prefetch on pointer or
keyboard-focus intent. Mobile navigation uses immediate visual feedback and
route skeletons without speculative requests. The root route has a lightweight
loading boundary so dynamic pages can respond immediately while their server
payload streams. A thin progress indicator confirms that navigation started,
and the whole-page fade is kept short so completed transitions are not visually
delayed.

Automatic viewport prefetch is disabled for dense navigation, Sports tabs,
league filters, fixture cards, P2P tabs, and mobile navigation. Next.js
otherwise speculatively renders every visible destination, which can turn one
Sports visit into dozens of `_rsc` requests on a self-hosted server. Only the
small desktop primary navigation uses intent-based prefetch.

Sentry browser events are sent directly to Sentry rather than tunneled through
the Next.js application. Tunneling telemetry through `/monitoring` adds
production requests during the same traffic spikes that need observability.

The production container runs two Next.js workers through Node's cluster
scheduler. This uses more than one CPU core while preserving a single container,
port, immutable image, health check, and blue-green deployment path. Keep
application state in Supabase or shared services; workers must remain stateless.

Large login, registration, profile, and wallet overlays are lazy-loaded only
when opened. Dashboard rows render a bounded preview rather than mounting the
entire game catalog; category pages remain the full-inventory view.

Sports fixture reads use a 15-second server cache. The fixture table is already
updated by cron, so repeated navigations should not repeat the same remote
database queries for every visitor. The initial Top tab is bounded to 24
upcoming fixtures, All Sports to 48, and tabs that do not display upcoming
fixtures do not query them.

### Stale-while-revalidate client cache

`lib/client-cache.ts` stores selected API responses in memory and
`sessionStorage`. P2P ads, P2P orders, wallet history, and bet history render
cached data immediately and refresh it in the background. Returning to a list
therefore does not show an empty state or spinner while the same data reloads.

The cache is invalidated after successful mutations so old financial state is
not retained after an order, transfer, or wallet action changes it.

### HTTP response caching

Read-heavy endpoints send bounded `Cache-Control` policies:

- Public P2P ads, spot prices, and FX rates use shared caching.
- User-specific orders, notifications, wallet transactions, bets, and Aviator
  history use short private caching with `stale-while-revalidate`.

This lets the browser or edge serve a recent response immediately while a fresh
response is obtained in the background.

### Optimistic actions

P2P actions such as marking an order paid, releasing, cancelling, disputing,
and toggling ads update the visible state immediately. The server remains the
source of truth. If a mutation fails, the UI restores the previous state and
shows the server error.

Financial endpoints use guarded database updates and transactions so optimistic
rendering cannot bypass balance checks or process the same state transition
twice.

### Realtime notifications

The notification dropdown keeps a short-lived local cache and subscribes to
Supabase Realtime for new notification rows. A slower polling fallback remains
for browsers or networks where the realtime connection is unavailable.

P2P chat uses the same realtime connection for new messages, receipt updates,
and ephemeral typing indicators. An eight-second polling fallback keeps chat
usable when realtime is blocked.

### Fewer requests

`GET /api/notifications` returns the notification list and unread count in one
response. Independent page requests are started in parallel where possible
instead of waiting for sequential database round trips.

Wallet balance reads are deduplicated across mounted components with a shared
short-lived client cache. Notification and P2P badge polling only runs while the
tab is visible and uses a one-minute fallback interval; Realtime and explicit
mutation refresh events remain the primary update mechanisms.

### Self-hosted request path

Supabase session middleware only runs for protected page routes. API handlers
perform their own authorization and public pages do not require a session
round trip. This is important on the VPS because middleware, rendering, and API
handlers share the same Next.js process, unlike Vercel's separate edge runtime.

The standalone Docker image must include Sharp's platform-specific `libvips`
package so image optimization does not repeatedly fail at runtime.

Public read endpoints must not run maintenance scans. KES ad backing is checked
when merchants create or reactivate ads; browsing ads stays a bounded indexed
read. Sports pages cap their initial fixture set so server-rendered HTML remains
small, with dedicated APIs supplying frequently refreshed live data.

### Database indexes

`prisma/migrations/20260606150000_performance_indexes_and_realtime/migration.sql`
adds indexes for the most common notification, transaction, P2P ad, P2P order,
bet, crypto balance, and deposit address filters and sort orders. It also adds
notifications to the Supabase Realtime publication when available.

Use `scripts/profile-performance.sql` with `EXPLAIN (ANALYZE, BUFFERS)` to check
production query plans before adding infrastructure or more indexes.

## Cache Rules

- Never cache mutation responses.
- Keep public market data caches longer than authenticated financial data.
- Invalidate affected list caches immediately after mutations.
- Render cached transaction details instantly, then revalidate in the
  background when the status can still change.
- Server-side balance validation and database transactions are mandatory even
  when the interface uses optimistic updates.

## Verification

For performance regressions:

1. Run a production build with `npm run build`.
2. Inspect browser Network timings for duplicate or sequential requests.
3. Test navigation once on a cold load and again with a warm session cache.
4. Run the relevant statements in `scripts/profile-performance.sql` against a
   production-sized dataset.
5. Check Vercel runtime logs for slow or repeated endpoints.

## Database Activation

Run Prisma migrations before enabling features that add tables, columns, storage
buckets, or realtime publications. For persistent Polymarket comments and P2P
chat receipts/images, run:

`prisma/migrations/20260606170000_comments_and_chat_receipts/migration.sql`

The application keeps legacy text chat operational if this migration has not
yet been applied, but comments, image uploads, and receipt states require it.
