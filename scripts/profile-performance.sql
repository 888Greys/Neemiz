-- Replace the sample IDs and values before running in Supabase SQL Editor.
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM notifications
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 30;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM transactions
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM p2p_ads
WHERE is_active = true
  AND side = 'SELL'
  AND crypto = 'USDT'
  AND fiat = 'KES'
  AND available_amount > 0
ORDER BY featured DESC, created_at DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM p2p_orders
WHERE buyer_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 50;
