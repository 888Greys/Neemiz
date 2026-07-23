#!/usr/bin/env bash
# Seed staging (nez-test) copy-trading test accounts. Run ON the VPS as root.
set -euo pipefail

SERVICE=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" /opt/neemiz-staging/neemiz-staging.docker.env | cut -d= -f2-)
PASS="${STAGING_TEST_PASS:-NezeemTest@2030}"
AUTH="http://127.0.0.1:8000/auth/v1"

create_or_update() {
  local EMAIL="$1"
  local USERNAME="$2"
  echo "=== $EMAIL ==="

  local EXIST
  EXIST=$(curl -sS -m 20 \
    -H "apikey: ${SERVICE}" \
    -H "Authorization: Bearer ${SERVICE}" \
    "${AUTH}/admin/users?page=1&per_page=200" \
    | EMAIL="$EMAIL" python3 -c "
import os, sys, json
email = os.environ['EMAIL'].lower()
users = json.load(sys.stdin).get('users', [])
print(next((u['id'] for u in users if (u.get('email') or '').lower() == email), ''))
")

  local SID=""
  if [ -n "$EXIST" ]; then
    echo "auth exists ${EXIST} — update password + confirm"
    curl -sS -m 20 -X PUT "${AUTH}/admin/users/${EXIST}" \
      -H "apikey: ${SERVICE}" \
      -H "Authorization: Bearer ${SERVICE}" \
      -H "Content-Type: application/json" \
      -d "{\"password\":\"${PASS}\",\"email_confirm\":true}" \
      | python3 -c "import sys,json; u=json.load(sys.stdin); print('updated', u.get('id'), u.get('email'))"
    SID="$EXIST"
  else
    echo "creating auth user"
    SID=$(curl -sS -m 20 -X POST "${AUTH}/admin/users" \
      -H "apikey: ${SERVICE}" \
      -H "Authorization: Bearer ${SERVICE}" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"email_confirm\":true,\"user_metadata\":{\"username\":\"${USERNAME}\"}}" \
      | python3 -c "import sys,json; u=json.load(sys.stdin); print(u.get('id') or '')")
    echo "created ${SID}"
  fi

  if [ -z "$SID" ]; then
    echo "FAILED: no supabase id for ${EMAIL}" >&2
    return 1
  fi

  docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v sid="$SID" -v email="$EMAIL" -v username="$USERNAME" <<'SQL'
-- Relink orphan app rows / upsert by supabase_id or email.
UPDATE users
SET supabase_id = :'sid',
    wallet_balance = 1000000,
    username = COALESCE(NULLIF(username, ''), :'username'),
    is_active = true,
    updated_at = NOW()
WHERE lower(email) = lower(:'email');

INSERT INTO users (id, supabase_id, email, username, wallet_balance, currency, is_active, created_at, updated_at)
SELECT
  substr(md5(random()::text || clock_timestamp()::text), 1, 25),
  :'sid',
  :'email',
  :'username',
  1000000,
  'KES',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE lower(email) = lower(:'email') OR supabase_id = :'sid'
);

INSERT INTO transactions (id, user_id, type, amount, currency, status, reference, provider, metadata, created_at, updated_at)
SELECT
  substr(md5(random()::text || clock_timestamp()::text), 1, 25),
  u.id,
  'DEPOSIT',
  1000000,
  'KES',
  'COMPLETED',
  'staging-seed-1m-' || u.id || '-' || extract(epoch from now())::bigint,
  'admin_seed',
  '{"action":"staging_seed","amount":1000000}'::jsonb,
  NOW(),
  NOW()
FROM users u
WHERE lower(u.email) = lower(:'email');

SELECT email, username, wallet_balance::numeric AS bal, supabase_id
FROM users
WHERE lower(email) = lower(:'email');
SQL
}

create_or_update "toxicgreys001@gmail.com" "toxicgreys001"
create_or_update "goodhope22@gmail.com" "goodhope22"

# Fund current session account too (temp-mail signup used in UI)
docker exec supabase-db psql -U postgres -d postgres -c \
  "UPDATE users SET wallet_balance = 1000000, updated_at = NOW() WHERE email = 'winiwan395@suahi.com';"

echo "=== balances ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT email, username, wallet_balance::numeric AS bal FROM users WHERE email IN ('toxicgreys001@gmail.com','goodhope22@gmail.com','winiwan395@suahi.com') ORDER BY email;"
