#!/usr/bin/env bash
# Recreate binarymarket-app on a given image (or Nezeem live image).
# On the VPS this lives at /opt/binarymarket/bounce.sh and is called from
# /opt/neemiz/deploy.sh after each successful Nezeem cutover.
set -euo pipefail
ENV=/opt/binarymarket/runtime.docker.env
IMG="${1:-}"
if [ -z "$IMG" ]; then
  LIVE=$(docker ps --format "{{.Names}}" | grep -E "^neemiz-app-300[78]$" | head -1 || true)
  if [ -z "$LIVE" ]; then
    echo "[binarymarket-bounce] no live neemiz-app and no image arg"
    exit 1
  fi
  IMG=$(docker inspect "$LIVE" -f "{{.Config.Image}}")
fi
if [[ ! "$IMG" =~ ^ghcr\.io/888greys/neemiz: ]]; then
  echo "[binarymarket-bounce] refusing unexpected image: $IMG"
  exit 1
fi
echo "[binarymarket-bounce] deploying $IMG"
docker rm -f binarymarket-app >/dev/null 2>&1 || true
docker run -d \
  --name binarymarket-app \
  --restart unless-stopped \
  --network supabase-prod_default \
  --env-file "$ENV" \
  -p 127.0.0.1:3012:3000 \
  "$IMG" >/dev/null

ok=
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3012/binary || echo 000)
  if [ "$code" = "200" ] || [ "$code" = "307" ]; then
    ok=1
    echo "[binarymarket-bounce] healthy after ${i} tries (http $code)"
    break
  fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "[binarymarket-bounce] UNHEALTHY — check logs"
  docker logs --tail 40 binarymarket-app || true
  exit 1
fi
echo "[binarymarket-bounce] done"
