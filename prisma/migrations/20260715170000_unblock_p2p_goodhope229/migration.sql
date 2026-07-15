-- Re-enable P2P money actions for goodhope229@gmail.com.
--
-- That account was added to system_settings.p2p_blocked_users (per-user P2P
-- kill switch in lib/p2p/user-guard.ts). There is no admin UI for the flag,
-- and owners without VPS/SQL access need a deploy-time data migration.
--
-- Idempotent: surgically strips this email from the comma list; no-op if the
-- row is missing or the email is already absent. Other blocked emails (if any)
-- are preserved. Empty string = nobody blocked (same as absent).
UPDATE "system_settings"
SET
  "value" = trim(BOTH ',' FROM regexp_replace(
    regexp_replace(
      "value",
      '(?i)(^|,)\s*goodhope229@gmail\.com\s*(?=,|$)',
      ',',
      'g'
    ),
    ',{2,}',
    ',',
    'g'
  )),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'p2p_blocked_users'
  AND "value" ~* 'goodhope229@gmail\.com';
