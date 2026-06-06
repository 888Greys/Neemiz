# Website Performance

Nezeem is optimized for users who may be far from the production database. The
main strategy is to avoid blocking page transitions on repeated network round
trips while keeping financial mutations authoritative on the server.

## Implemented Improvements

### Route prefetching

`components/app-shell.tsx` prefetches the primary authenticated routes during
browser idle time. Next.js then has the route bundles ready before most clicks,
which removes repeated page-level loading screens.

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
