#!/usr/bin/env bash
# Recreate binaryoptionske-app on a given image (or Nezeem live image).
# On the VPS this lives at /opt/binaryoptionske/bounce.sh and is called from
# /opt/neemiz/deploy.sh after each successful Nezeem cutover.
set -euo pipefail
ENV=/opt/binaryoptionske/runtime.docker.env
IMG="${1:-}"
if [ -z "$IMG" ]; then
  LIVE=$(docker ps --format "{{.Names}}" | grep -E "^neemiz-app-300[78]$" | head -1 || true)
  if [ -z "$LIVE" ]; then
    echo "[binary-bounce] no live neemiz-app and no image arg"
    exit 1
  fi
  IMG=$(docker inspect "$LIVE" -f "{{.Config.Image}}")
fi
if [[ ! "$IMG" =~ ^ghcr\.io/888greys/neemiz: ]]; then
  echo "[binary-bounce] refusing unexpected image: $IMG"
  exit 1
fi
echo "[binary-bounce] deploying $IMG"
docker rm -f binaryoptionske-app >/dev/null 2>&1 || true
docker run -d \
  --name binaryoptionske-app \
  --restart unless-stopped \
  --network supabase-prod_default \
  --env-file "$ENV" \
  -p 127.0.0.1:3010:3000 \
  "$IMG" >/dev/null

ok=
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3010/binary || echo 000)
  if [ "$code" = "200" ] || [ "$code" = "307" ]; then
    ok=1
    echo "[binary-bounce] healthy after ${i} tries (http $code)"
    break
  fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "[binary-bounce] UNHEALTHY — check logs"
  docker logs --tail 40 binaryoptionske-app || true
  exit 1
fi
echo "[binary-bounce] done"
