-- Release orphaned on-chain P2P locks (available ← locked excess).
--
-- Sell ads lock UserCryptoBalance at create. Pause returns the reserve; a bug
-- could leave locked > what active ads/orders still need (or leave everything
-- locked after the ad was deleted). Spendable balance then looks "gone".
--
-- For each on-chain asset row, keep only what is still required by:
--   1) active on-chain SELL ads: available_amount * (1 + fee_rate)
--   2) open BUY-ad orders where this user is the crypto seller (buyer lock)
-- Move any excess locked → available. Idempotent / no-op when already correct.
--
-- Does NOT touch wallet-backed local coins (KES, UGX, …) — those do not use
-- ad-level create locks. Also repairs legacy p2p_crypto_balances the same way.

WITH on_chain AS (
  SELECT unnest(ARRAY['USDT', 'USDC', 'BTC', 'ETH', 'BNB']) AS crypto
),
ad_need AS (
  SELECT
    mp.user_id,
    upper(a.crypto) AS crypto,
    COALESCE(SUM(a.available_amount * (1 + COALESCE(a.fee_rate, 0))), 0) AS need
  FROM merchant_profiles mp
  JOIN p2p_ads a ON a.merchant_id = mp.id
  JOIN on_chain oc ON oc.crypto = upper(a.crypto)
  WHERE a.is_active = true
    AND a.side = 'SELL'
  GROUP BY mp.user_id, upper(a.crypto)
),
order_need AS (
  SELECT
    o.buyer_id AS user_id,
    upper(o.crypto) AS crypto,
    COALESCE(SUM(o.crypto_amount), 0) AS need
  FROM p2p_orders o
  JOIN p2p_ads a ON a.id = o.ad_id
  JOIN on_chain oc ON oc.crypto = upper(o.crypto)
  WHERE o.status IN ('PENDING', 'PAID', 'DISPUTED')
    AND a.side = 'BUY'
  GROUP BY o.buyer_id, upper(o.crypto)
),
needed AS (
  SELECT user_id, crypto, SUM(need) AS need
  FROM (
    SELECT user_id, crypto, need FROM ad_need
    UNION ALL
    SELECT user_id, crypto, need FROM order_need
  ) parts
  GROUP BY user_id, crypto
)
UPDATE user_crypto_balances ucb
SET
  available = ucb.available + GREATEST(0, ucb.locked - COALESCE(sub.need, 0)),
  locked    = LEAST(ucb.locked, COALESCE(sub.need, 0)),
  updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT u.id, n.need
  FROM user_crypto_balances u
  JOIN on_chain oc ON upper(u.crypto) = oc.crypto
  LEFT JOIN needed n
    ON n.user_id = u.user_id
   AND n.crypto = upper(u.crypto)
) sub
WHERE ucb.id = sub.id
  AND ucb.locked > COALESCE(sub.need, 0);

-- Legacy merchant escrow rows (pre one-wallet). Same excess formula keyed by
-- merchant_id → user via merchant_profiles.
WITH on_chain AS (
  SELECT unnest(ARRAY['USDT', 'USDC', 'BTC', 'ETH', 'BNB']) AS crypto
),
ad_need AS (
  SELECT
    a.merchant_id,
    upper(a.crypto) AS crypto,
    COALESCE(SUM(a.available_amount * (1 + COALESCE(a.fee_rate, 0))), 0) AS need
  FROM p2p_ads a
  JOIN on_chain oc ON oc.crypto = upper(a.crypto)
  WHERE a.is_active = true
    AND a.side = 'SELL'
  GROUP BY a.merchant_id, upper(a.crypto)
)
UPDATE p2p_crypto_balances pcb
SET
  available = pcb.available + GREATEST(0, pcb.locked - COALESCE(sub.need, 0)),
  locked    = LEAST(pcb.locked, COALESCE(sub.need, 0)),
  total     = (pcb.available + GREATEST(0, pcb.locked - COALESCE(sub.need, 0)))
              + LEAST(pcb.locked, COALESCE(sub.need, 0)),
  updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT p.id, n.need
  FROM p2p_crypto_balances p
  JOIN on_chain oc ON upper(p.crypto) = oc.crypto
  LEFT JOIN ad_need n
    ON n.merchant_id = p.merchant_id
   AND n.crypto = upper(p.crypto)
) sub
WHERE pcb.id = sub.id
  AND pcb.locked > COALESCE(sub.need, 0);
