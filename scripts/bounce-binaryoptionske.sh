#!/usr/bin/env bash
# Recreate binaryoptionske-app on the same GHCR image Nezeem is currently serving.
set -euo pipefail
ENV=/opt/binaryoptionske/runtime.docker.env
LIVE=$(docker ps --format '{{.Names}}' | grep -E '^neemiz-app-300[78]$' | head -1 || true)
if [ -z "${LIVE}" ]; then
  echo "No live neemiz-app-3007/3008; falling back to newest local image tag"
  IMG="ghcr.io/888greys/neemiz:$(docker images ghcr.io/888greys/neemiz --format '{{.Tag}}' | grep -E '^[0-9a-f]{40}$' | head -1)"
else
  IMG=$(docker inspect "$LIVE" -f '{{.Config.Image}}')
fi
echo "[binary-bounce] using $IMG"
docker pull "$IMG" 2>/dev/null || true
docker rm -f binaryoptionske-app 2>/dev/null || true
docker run -d --name binaryoptionske-app --restart unless-stopped \
  --env-file "$ENV" \
  --network supabase-prod_default \
  -p 127.0.0.1:3010:3000 \
  "$IMG"
sleep 3
curl -sS -o /dev/null -w "binary=/binary -> %{http_code}\n" https://binaryoptionske.com/binary
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep binaryoptionske
