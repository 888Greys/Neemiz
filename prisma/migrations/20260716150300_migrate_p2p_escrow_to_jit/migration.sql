-- For active on-chain crypto SELL ads, calculate the lock amount and move it from locked to available
WITH ad_locks AS (
  SELECT 
    m.user_id,
    a.crypto,
    CASE 
      WHEN UPPER(a.crypto) = 'KES' THEN 'KES'
      WHEN UPPER(a.crypto) = 'USDT' THEN 'TRC20'
      WHEN UPPER(a.crypto) = 'USDC' THEN 'POLYGON'
      WHEN UPPER(a.crypto) = 'BTC' THEN 'BTC'
      WHEN UPPER(a.crypto) = 'ETH' THEN 'ERC20'
      WHEN UPPER(a.crypto) = 'BNB' THEN 'BEP20'
      WHEN UPPER(a.crypto) = 'MATIC' THEN 'POLYGON'
      ELSE 'TRC20'
    END as network,
    SUM(ROUND(CAST(a.available_amount * (1 + COALESCE(a.fee_rate, 0.02)) AS NUMERIC), 8)) as lock_amount
  FROM p2p_ads a
  JOIN merchant_profiles m ON a.merchant_id = m.id
  WHERE a.side = 'SELL' 
    AND a.is_active = true
    AND UPPER(a.crypto) IN ('USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'TRX', 'MATIC')
  GROUP BY m.user_id, a.crypto
)
UPDATE user_crypto_balances ub
SET 
  locked = GREATEST(0, ub.locked - al.lock_amount),
  available = ub.available + al.lock_amount
FROM ad_locks al
WHERE ub.user_id = al.user_id 
  AND ub.crypto = al.crypto
  AND ub.network = al.network;

-- Fallback to legacy P2PCryptoBalance (p2p_crypto_balances)
WITH ad_locks AS (
  SELECT 
    a.merchant_id,
    a.crypto,
    SUM(ROUND(CAST(a.available_amount * (1 + COALESCE(a.fee_rate, 0.02)) AS NUMERIC), 8)) as lock_amount
  FROM p2p_ads a
  WHERE a.side = 'SELL' 
    AND a.is_active = true
    AND UPPER(a.crypto) IN ('USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'TRX', 'MATIC')
  GROUP BY a.merchant_id, a.crypto
)
UPDATE p2p_crypto_balances pb
SET 
  locked = GREATEST(0, pb.locked - al.lock_amount),
  available = pb.available + al.lock_amount
FROM ad_locks al
WHERE pb.merchant_id = al.merchant_id 
  AND pb.crypto = al.crypto;
